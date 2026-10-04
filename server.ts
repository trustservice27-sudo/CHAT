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
const PORT = Number(process.env.PORT) || 3000;
const distPath = path.resolve(__dirname, 'dist');
const hasDist = fs.existsSync(path.resolve(distPath, 'index.html'));
const isProduction = process.env.NODE_ENV === 'production' || (hasDist && process.env.NODE_ENV !== 'development');

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
app.get('/api/events', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send current state from Google Cloud SQL database to new connection
  try {
    const [messagesList, onlineUsersList, typersList] = await Promise.all([
      getDbMessages(),
      getDbOnlineUsers(),
      getDbTypers(),
    ]);

    const initData = {
      type: 'init',
      messages: messagesList,
      onlineUsers: onlineUsersList,
      typingUsers: typersList,
    };
    res.write(`data: ${JSON.stringify(initData)}\n\n`);
  } catch (err) {
    console.error('Error sending initial state from Cloud SQL:', err);
    res.write(`data: ${JSON.stringify({ type: 'init', messages: [], onlineUsers: [], typingUsers: [] })}\n\n`);
  }

  sseClients.add(res);

  const pingInterval = setInterval(() => {
    try {
      res.write(':ping\n\n');
    } catch {
      clearInterval(pingInterval);
      sseClients.delete(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(pingInterval);
    sseClients.delete(res);
  });
});

// API: Get messages directly from Google Cloud SQL
app.get('/api/messages', async (req, res) => {
  try {
    const list = await getDbMessages();
    res.json({ success: true, messages: list });
  } catch (err: any) {
    console.error('Failed to get messages from Cloud SQL:', err);
    res.status(500).json({ success: false, error: err.message || 'Database error' });
  }
});

// API: Save message into Google Cloud SQL & broadcast in real-time
app.post('/api/messages', async (req, res) => {
  try {
    const { userId, displayName, text, photoURL } = req.body || {};
    const trimmed = (text || '').trim();
    if (!trimmed || !userId) {
      res.status(400).json({ success: false, error: 'Invalid message payload' });
      return;
    }

    const savedMessage = await insertDbMessage(
      userId,
      displayName || 'Anonymous',
      trimmed,
      photoURL
    );

    if (!savedMessage) {
      throw new Error('Failed to save message to Google Cloud database');
    }

    // Broadcast instantaneously to all other online connected users across the world!
    broadcastSSE({
      type: 'new_message',
      message: savedMessage,
    });

    res.status(200).json({ success: true, message: savedMessage });
  } catch (err: any) {
    console.error('Error saving message to Cloud SQL:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// API: Online presence update in Google Cloud SQL
app.post('/api/presence', async (req, res) => {
  const { userId, displayName } = req.body || {};
  if (userId) {
    try {
      await upsertDbPresence(userId, displayName || 'Member');
      const activeUsers = await getDbOnlineUsers();
      broadcastSSE({
        type: 'presence',
        onlineUsers: activeUsers,
      });
    } catch (err) {
      console.error('Presence error in Cloud SQL:', err);
    }
  }
  res.json({ success: true });
});

// API: Online typing status update in Google Cloud SQL
app.post('/api/typing', async (req, res) => {
  const { userId, displayName, isTyping } = req.body || {};
  if (userId) {
    try {
      await upsertDbTyping(userId, displayName || 'Member', Boolean(isTyping));
      const activeTypers = await getDbTypers();
      broadcastSSE({
        type: 'typing',
        typingUsers: activeTypers,
      });
    } catch (err) {
      console.error('Typing error in Cloud SQL:', err);
    }
  }
  res.json({ success: true });
});

// API: Clear chat password verification & execution in Google Cloud SQL
app.post('/api/clear-chat', async (req, res) => {
  try {
    const enteredPassword = (req.body?.password || '').trim();
    const envPassword = (process.env.CLEAR_PASSWORD || 'ADMIN').trim().toUpperCase();

    // Support ADMIN, admin, and custom CLEAR_PASSWORD
    const validPasswords = new Set(['ADMIN', envPassword]);

    if (!enteredPassword || !validPasswords.has(enteredPassword.toUpperCase())) {
      res.status(401).json({ 
        success: false, 
        error: 'Incorrect password. Access denied.' 
      });
      return;
    }

    const mode = req.body?.mode;
    if (mode === 'everything_and_new_user') {
      await clearDbEverything();
    } else {
      await clearDbMessages();
    }

    // Broadcast clear event to all online connected clients worldwide
    broadcastSSE({
      type: 'clear',
    });

    res.status(200).json({ 
      success: true, 
      authorized: true, 
      message: 'Authorization verified. Google Cloud database cleared.' 
    });
  } catch (err: any) {
    console.error('Error clearing Cloud SQL database:', err);
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
