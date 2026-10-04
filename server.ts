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
  getAllDbUsers,
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

let lastClearTimestamp = Date.now();

// In-memory active typers map with real live typing text preview
interface ActiveTyper {
  userId: string;
  displayName: string;
  isTyping: boolean;
  timestamp: number;
  text?: string;
}
const activeTypers = new Map<string, ActiveTyper>();

function getActiveTypersList(): ActiveTyper[] {
  const now = Date.now();
  const list: ActiveTyper[] = [];
  for (const [uid, typer] of activeTypers.entries()) {
    if (typer.isTyping && now - typer.timestamp < 6000) {
      list.push(typer);
    } else {
      activeTypers.delete(uid);
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
// 100% online cloud database powered
app.get('/api/events', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  try {
    const [initialMessages, onlineList, allUsersList] = await Promise.all([
      getDbMessages(),
      getDbOnlineUsers(),
      getAllDbUsers(),
    ]);

    const initData = {
      type: 'init',
      messages: initialMessages,
      onlineUsers: onlineList,
      allUsers: allUsersList,
      typingUsers: getActiveTypersList(),
      lastClearTimestamp,
    };
    res.write(`data: ${JSON.stringify(initData)}\n\n`);
  } catch (err) {
    console.error('Error in SSE init from online database:', err);
    res.write(`data: ${JSON.stringify({ type: 'init', messages: [], onlineUsers: [], allUsers: [], typingUsers: [], lastClearTimestamp })}\n\n`);
  }

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

// API: Get all users who have joined this website from online cloud storage
app.get('/api/users', async (req, res) => {
  try {
    const users = await getAllDbUsers();
    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Database error', users: [] });
  }
});

// API: Get messages directly from online cloud storage
app.get('/api/messages', async (req, res) => {
  try {
    const list = await getDbMessages();
    res.json({ success: true, messages: list, lastClearTimestamp });
  } catch (err: any) {
    console.error('Error fetching online messages:', err);
    res.status(500).json({ success: false, error: 'Database error', messages: [] });
  }
});

// API: Save message directly to online cloud storage
app.post('/api/messages', async (req, res) => {
  try {
    const { userId, displayName, text, photoURL } = req.body || {};
    const trimmed = (text || '').trim();
    if (!trimmed || !userId) {
      res.status(400).json({ success: false, error: 'Invalid message' });
      return;
    }

    // Save directly to online database
    const saved = await insertDbMessage(
      userId,
      displayName || 'Anonymous',
      trimmed,
      photoURL
    );

    if (!saved) {
      throw new Error('Failed to save to online storage');
    }

    // Update presence
    upsertDbPresence(userId, displayName || 'Anonymous').catch(() => {});
    // Clear typing in online database and memory
    activeTypers.delete(userId);
    upsertDbTyping(userId, displayName || 'Anonymous', false).catch(() => {});

    // Broadcast immediately in real-time
    broadcastSSE({
      type: 'new_message',
      message: saved,
    });

    res.status(200).json({ success: true, message: saved });
  } catch (err: any) {
    console.error('Error saving message to online database:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// API: Online presence update directly in online cloud storage
app.post('/api/presence', async (req, res) => {
  const { userId, displayName } = req.body || {};
  if (userId) {
    try {
      await upsertDbPresence(userId, displayName || 'Member');
      const [onlineList, allUsersList] = await Promise.all([
        getDbOnlineUsers(),
        getAllDbUsers(),
      ]);

      broadcastSSE({
        type: 'presence',
        onlineUsers: onlineList,
        allUsers: allUsersList,
      });

      res.json({ success: true, onlineUsers: onlineList, allUsers: allUsersList });
      return;
    } catch (err) {
      console.error('Error updating presence in online database:', err);
    }
  }
  const fallbackList = await getDbOnlineUsers().catch(() => []);
  const allFallback = await getAllDbUsers().catch(() => []);
  res.json({ success: true, onlineUsers: fallbackList, allUsers: allFallback });
});

// API: Typing status directly with live typing message text
app.post('/api/typing', async (req, res) => {
  const { userId, displayName, isTyping, text } = req.body || {};
  if (userId) {
    try {
      if (isTyping) {
        activeTypers.set(userId, {
          userId,
          displayName: displayName || 'Member',
          isTyping: true,
          timestamp: Date.now(),
          text: (text || '').slice(0, 120),
        });
      } else {
        activeTypers.delete(userId);
      }

      upsertDbTyping(userId, displayName || 'Member', Boolean(isTyping)).catch(() => {});
      const typersList = getActiveTypersList();

      broadcastSSE({
        type: 'typing',
        typingUsers: typersList,
      });

      res.json({ success: true, typingUsers: typersList });
      return;
    } catch (err) {
      console.error('Error updating typing:', err);
    }
  }
  const fallbackTypers = getActiveTypersList();
  res.json({ success: true, typingUsers: fallbackTypers });
});

// API: High-frequency polling endpoint directly querying online cloud database
app.get('/api/online-status', async (req, res) => {
  try {
    const [onlineUsers, allUsers, currentMessages] = await Promise.all([
      getDbOnlineUsers(),
      getAllDbUsers(),
      getDbMessages(),
    ]);

    res.json({
      success: true,
      onlineUsers,
      allUsers,
      typingUsers: getActiveTypersList(),
      messageCount: currentMessages.length,
      lastClearTimestamp,
      lastMessageId: currentMessages.length > 0 ? currentMessages[currentMessages.length - 1].id : null,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Database read error' });
  }
});

// API: Clear chat directly in online cloud storage for EVERY user
app.post('/api/clear-chat', async (req, res) => {
  try {
    lastClearTimestamp = Date.now();

    // Clear online cloud storage directly
    if (req.body?.mode === 'everything_and_new_user') {
      await clearDbEverything();
    } else {
      await clearDbMessages();
    }

    // Broadcast clear event to all screens worldwide
    broadcastSSE({
      type: 'clear',
      lastClearTimestamp,
    });

    res.status(200).json({ 
      success: true, 
      authorized: true, 
      lastClearTimestamp,
      message: 'Online cloud database cleared successfully.' 
    });
  } catch (err: any) {
    console.error('Clear error in online database:', err);
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
