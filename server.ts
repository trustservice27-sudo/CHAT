import express from 'express';
import type { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config();

import {
  getDbMessages,
  insertDbMessage,
  upsertDbPresence,
  getDbOnlineUsers,
  upsertDbTyping,
  getDbTypers,
  clearDbMessages,
  clearDbEverything,
} from './src/db/queries.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const distPath = path.resolve(__dirname, 'dist');
const hasDist = fs.existsSync(path.resolve(distPath, 'index.html'));
const isProduction = process.env.NODE_ENV === 'production' || (hasDist && process.env.NODE_ENV !== 'development');

// Resilient Fallback Storage (Ensures messages work seamlessly even across container boundary or network fluctuations)
const dataDir = path.resolve(__dirname, 'database_store');
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch {}
}
const primaryBackup = path.resolve(dataDir, 'cloud_chat_store.json');
const tempBackup = path.resolve('/tmp', 'cloud_chat_store.json');

interface StoredMessage {
  id: string;
  userId: string;
  displayName: string;
  photoURL?: string;
  text: string;
  createdAt: { seconds: number; nanoseconds: number };
}

let cachedMessages: StoredMessage[] = [];

try {
  if (fs.existsSync(primaryBackup)) {
    cachedMessages = JSON.parse(fs.readFileSync(primaryBackup, 'utf-8'));
  } else if (fs.existsSync(tempBackup)) {
    cachedMessages = JSON.parse(fs.readFileSync(tempBackup, 'utf-8'));
  }
} catch {
  cachedMessages = [];
}

function persistBackupStore() {
  const content = JSON.stringify(cachedMessages.slice(-500), null, 2);
  try {
    fs.writeFileSync(primaryBackup, content, 'utf-8');
  } catch {}
  try {
    fs.writeFileSync(tempBackup, content, 'utf-8');
  } catch {}
}

// Global In-Memory Online Users & Typers Map (Fast, cross-client sync)
const activeUsersMap = new Map<string, { userId: string; displayName: string; lastActive: number }>();
const activeTypersMap = new Map<string, { userId: string; displayName: string; updatedAt: number }>();

function getActiveOnlineUsers() {
  const now = Date.now();
  const list = [];
  for (const [uid, user] of activeUsersMap.entries()) {
    if (now - user.lastActive < 45000) {
      list.push({
        userId: user.userId,
        displayName: user.displayName,
        lastActive: { seconds: Math.floor(user.lastActive / 1000), nanoseconds: 0 }
      });
    } else {
      activeUsersMap.delete(uid);
    }
  }
  return list;
}

function getActiveTypers() {
  const now = Date.now();
  const list = [];
  for (const [uid, t] of activeTypersMap.entries()) {
    if (now - t.updatedAt < 5000) {
      list.push({
        userId: t.userId,
        displayName: t.displayName,
        isTyping: true,
        timestamp: t.updatedAt
      });
    } else {
      activeTypersMap.delete(uid);
    }
  }
  return list;
}

// CORS & JSON body parser
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.json());

// Active SSE Connections for Real-Time Live Messaging
const sseClients = new Set<Response>();

function broadcastSSE(data: object) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Real-Time Server-Sent Events (SSE) Stream
// With X-Accel-Buffering: no to prevent Cloud Run / mobile proxy buffering
app.get('/api/events', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let initialMessages = cachedMessages;
  try {
    const dbList = await getDbMessages();
    if (dbList && dbList.length > 0) {
      initialMessages = dbList;
      cachedMessages = dbList;
      persistBackupStore();
    }
  } catch (err) {
    console.warn('Initial load using fallback cache:', err);
  }

  const onlineList = getActiveOnlineUsers();
  const typersList = getActiveTypers();

  const initData = {
    type: 'init',
    messages: initialMessages,
    onlineUsers: onlineList,
    typingUsers: typersList,
  };
  res.write(`data: ${JSON.stringify(initData)}\n\n`);

  sseClients.add(res);

  const pingInterval = setInterval(() => {
    try {
      res.write(':keepalive\n\n');
    } catch {
      clearInterval(pingInterval);
      sseClients.delete(res);
    }
  }, 10000);

  req.on('close', () => {
    clearInterval(pingInterval);
    sseClients.delete(res);
  });
});

// API: Get messages
app.get('/api/messages', async (req, res) => {
  try {
    let list = cachedMessages;
    try {
      const dbList = await getDbMessages();
      if (dbList && dbList.length > 0) {
        list = dbList;
        cachedMessages = dbList;
        persistBackupStore();
      }
    } catch (e) {
      console.warn('Reading from resilient cache:', e);
    }
    res.json({ success: true, messages: list });
  } catch (err: any) {
    res.json({ success: true, messages: cachedMessages });
  }
});

// API: Save message
app.post('/api/messages', async (req, res) => {
  try {
    const { userId, displayName, text, photoURL } = req.body || {};
    const trimmed = (text || '').trim();
    if (!trimmed || !userId) {
      res.status(400).json({ success: false, error: 'Invalid message' });
      return;
    }

    const newMessage: StoredMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      displayName: displayName || 'Anonymous',
      photoURL,
      text: trimmed,
      createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
    };

    // Save to resilient cache immediately
    cachedMessages.push(newMessage);
    if (cachedMessages.length > 500) {
      cachedMessages = cachedMessages.slice(-500);
    }
    persistBackupStore();

    // Async save to Cloud SQL
    insertDbMessage(userId, displayName || 'Anonymous', trimmed, photoURL)
      .then((sqlSaved) => {
        if (sqlSaved) {
          // Update id if needed
          const idx = cachedMessages.findIndex((m) => m.id === newMessage.id);
          if (idx !== -1) {
            cachedMessages[idx].id = sqlSaved.id;
            persistBackupStore();
          }
        }
      })
      .catch((err) => console.warn('Cloud SQL insert note:', err));

    // Clear typing for this user
    activeTypersMap.delete(userId);

    // Broadcast in real-time to all connected users
    broadcastSSE({
      type: 'new_message',
      message: newMessage,
    });

    res.status(200).json({ success: true, message: newMessage });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// API: Presence update (Returns active users directly for mobile polling)
app.post('/api/presence', async (req, res) => {
  const { userId, displayName } = req.body || {};
  if (userId) {
    activeUsersMap.set(userId, {
      userId,
      displayName: displayName || 'Member',
      lastActive: Date.now(),
    });

    // Background sync to Cloud SQL
    upsertDbPresence(userId, displayName || 'Member').catch(() => {});

    const usersList = getActiveOnlineUsers();
    broadcastSSE({
      type: 'presence',
      onlineUsers: usersList,
    });

    res.json({ success: true, onlineUsers: usersList });
    return;
  }
  res.json({ success: true, onlineUsers: getActiveOnlineUsers() });
});

// API: Typing status update (Returns typers directly for mobile polling)
app.post('/api/typing', async (req, res) => {
  const { userId, displayName, isTyping } = req.body || {};
  if (userId) {
    if (isTyping) {
      activeTypersMap.set(userId, {
        userId,
        displayName: displayName || 'Member',
        updatedAt: Date.now(),
      });
    } else {
      activeTypersMap.delete(userId);
    }

    // Background sync to Cloud SQL
    upsertDbTyping(userId, displayName || 'Member', Boolean(isTyping)).catch(() => {});

    const typersList = getActiveTypers();
    broadcastSSE({
      type: 'typing',
      typingUsers: typersList,
    });

    res.json({ success: true, typingUsers: typersList });
    return;
  }
  res.json({ success: true, typingUsers: getActiveTypers() });
});

// API: Mobile status poll (Every phone polls this every 2 seconds for guaranteed multi-phone live sync)
app.get('/api/online-status', (req, res) => {
  res.json({
    success: true,
    onlineUsers: getActiveOnlineUsers(),
    typingUsers: getActiveTypers(),
    messageCount: cachedMessages.length,
    lastMessageId: cachedMessages.length > 0 ? cachedMessages[cachedMessages.length - 1].id : null,
  });
});

// API: Clear chat with secret password
app.post('/api/clear-chat', async (req, res) => {
  try {
    const enteredPassword = (req.body?.password || '').trim();
    const envPassword = (process.env.CLEAR_PASSWORD || 'ADMIN').trim().toUpperCase();

    // Accept ADMIN, admin, 1234, password, or custom env password
    const validPasswords = new Set(['ADMIN', '1234', 'PASSWORD', envPassword]);

    if (!enteredPassword || !validPasswords.has(enteredPassword.toUpperCase())) {
      res.status(401).json({ 
        success: false, 
        error: 'Incorrect passcode. Access denied.' 
      });
      return;
    }

    // 1. Wipe resilient cache
    cachedMessages = [];
    persistBackupStore();

    // 2. Wipe active users/typing if everything requested
    if (req.body?.mode === 'everything_and_new_user') {
      activeUsersMap.clear();
      activeTypersMap.clear();
      clearDbEverything().catch(() => {});
    } else {
      clearDbMessages().catch(() => {});
    }

    // 3. Broadcast clear event to all screens worldwide
    broadcastSSE({
      type: 'clear',
    });

    res.status(200).json({ 
      success: true, 
      authorized: true, 
      message: 'Chat history cleared successfully.' 
    });
  } catch (err: any) {
    console.error('Clear error:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (isProduction && hasDist) {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer();
