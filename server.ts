import express, { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const distPath = path.resolve(__dirname, 'dist');
const hasDist = fs.existsSync(path.resolve(distPath, 'index.html'));
const isProduction = process.env.NODE_ENV === 'production' || (hasDist && process.env.NODE_ENV !== 'development');

app.use(express.json());

// ==========================================
// Central Online Database (Server Store)
// ==========================================
const dataDir = path.resolve(__dirname, 'database_store');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const messagesDbFile = path.resolve(dataDir, 'online_messages.json');

interface OnlineMessage {
  id: string;
  userId: string;
  displayName: string;
  photoURL?: string;
  text: string;
  createdAt: { seconds: number; nanoseconds: number };
  readBy?: string[];
  seenBy?: { userId: string; displayName: string; seenAt: number }[];
}

let onlineMessages: OnlineMessage[] = [];

try {
  if (fs.existsSync(messagesDbFile)) {
    const raw = fs.readFileSync(messagesDbFile, 'utf-8');
    onlineMessages = JSON.parse(raw);
  }
} catch {
  onlineMessages = [];
}

function persistOnlineDatabase() {
  try {
    fs.writeFileSync(messagesDbFile, JSON.stringify(onlineMessages.slice(-500), null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving to online database:', err);
  }
}

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

// Active Users & Typing in Online Database
const onlineUsersMap = new Map<string, { userId: string; displayName: string; lastActive: number }>();
const onlineTypersMap = new Map<string, { userId: string; displayName: string; timestamp: number }>();

function getOnlineUsersList() {
  const now = Date.now();
  const list = [];
  for (const [uid, user] of onlineUsersMap.entries()) {
    if (now - user.lastActive < 45000) {
      list.push({
        userId: user.userId,
        displayName: user.displayName,
        lastActive: { seconds: Math.floor(user.lastActive / 1000), nanoseconds: 0 }
      });
    } else {
      onlineUsersMap.delete(uid);
    }
  }
  return list;
}

function getActiveTypersList() {
  const now = Date.now();
  const list = [];
  for (const [uid, typer] of onlineTypersMap.entries()) {
    if (now - typer.timestamp < 5000) {
      list.push({
        userId: typer.userId,
        displayName: typer.displayName,
        isTyping: true,
        timestamp: typer.timestamp
      });
    } else {
      onlineTypersMap.delete(uid);
    }
  }
  return list;
}

// Real-Time Server-Sent Events (SSE) Stream
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Initial online database state
  const initData = {
    type: 'init',
    messages: onlineMessages,
    onlineUsers: getOnlineUsersList(),
    typingUsers: getActiveTypersList()
  };
  res.write(`data: ${JSON.stringify(initData)}\n\n`);

  sseClients.add(res);

  const pingInterval = setInterval(() => {
    try {
      res.write(':ping\n\n');
    } catch {
      clearInterval(pingInterval);
      sseClients.delete(res);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(pingInterval);
    sseClients.delete(res);
  });
});

// API: Get messages from online database
app.get('/api/messages', (req, res) => {
  res.json({ success: true, messages: onlineMessages });
});

// API: Save message to online database & broadcast to all users
app.post('/api/messages', (req, res) => {
  try {
    const { userId, displayName, text, photoURL } = req.body || {};
    const trimmed = (text || '').trim();
    if (!trimmed || !userId) {
      res.status(400).json({ success: false, error: 'Invalid message payload' });
      return;
    }

    const newMessage: OnlineMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      displayName: displayName || 'Anonymous',
      photoURL,
      text: trimmed,
      createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      readBy: [userId],
      seenBy: [{
        userId,
        displayName: displayName || 'Anonymous',
        seenAt: Date.now()
      }]
    };

    onlineMessages.push(newMessage);
    if (onlineMessages.length > 500) {
      onlineMessages = onlineMessages.slice(-500);
    }
    persistOnlineDatabase();

    // Broadcast instantaneously to all other connected online users!
    broadcastSSE({
      type: 'new_message',
      message: newMessage
    });

    res.status(200).json({ success: true, message: newMessage });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// API: Online presence update
app.post('/api/presence', (req, res) => {
  const { userId, displayName } = req.body || {};
  if (userId) {
    onlineUsersMap.set(userId, {
      userId,
      displayName: displayName || 'Member',
      lastActive: Date.now()
    });
    broadcastSSE({
      type: 'presence',
      onlineUsers: getOnlineUsersList()
    });
  }
  res.json({ success: true });
});

// API: Online typing status update
app.post('/api/typing', (req, res) => {
  const { userId, displayName, isTyping } = req.body || {};
  if (userId) {
    if (isTyping) {
      onlineTypersMap.set(userId, {
        userId,
        displayName: displayName || 'Member',
        timestamp: Date.now()
      });
    } else {
      onlineTypersMap.delete(userId);
    }
    broadcastSSE({
      type: 'typing',
      typingUsers: getActiveTypersList()
    });
  }
  res.json({ success: true });
});

// API: Clear chat status
app.get('/api/clear-status', (req, res) => {
  res.json({
    configured: true,
    hasCustomPassword: Boolean(process.env.CLEAR_PASSWORD),
    defaultPasswordUsed: !process.env.CLEAR_PASSWORD
  });
});

// API: Clear chat password verification & execution in Online Database
app.post('/api/clear-chat', (req, res) => {
  try {
    const enteredPassword = (req.body?.password || '').trim();
    const serverPassword = (process.env.CLEAR_PASSWORD || 'ADMIN').trim();

    if (!enteredPassword || enteredPassword.toUpperCase() !== serverPassword.toUpperCase()) {
      res.status(401).json({ 
        success: false, 
        error: 'Incorrect passcode. Access denied.' 
      });
      return;
    }

    // Clear online database messages
    onlineMessages = [];
    persistOnlineDatabase();

    // Broadcast clear event to all online connected clients
    broadcastSSE({
      type: 'clear'
    });

    res.status(200).json({ 
      success: true, 
      authorized: true, 
      message: 'Authorization verified. Online database cleared.' 
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (isProduction && hasDist) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
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
