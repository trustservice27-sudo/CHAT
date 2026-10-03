import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

// API: Clear chat status
app.get('/api/clear-status', (req, res) => {
  res.json({
    configured: true,
    hasCustomPassword: Boolean(process.env.CLEAR_PASSWORD),
    defaultPasswordUsed: !process.env.CLEAR_PASSWORD
  });
});

// API: Clear chat password verification
app.post('/api/clear-chat', (req, res) => {
  try {
    const enteredPassword = (req.body?.password || '').trim();
    const serverPassword = (process.env.CLEAR_PASSWORD || 'ADMIN').trim();

    if (!enteredPassword || enteredPassword !== serverPassword) {
      res.status(401).json({ 
        success: false, 
        error: 'Incorrect security code. Access denied.' 
      });
      return;
    }

    res.status(200).json({ 
      success: true, 
      authorized: true, 
      message: 'Authorization verified. Messages cleared.' 
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer();
