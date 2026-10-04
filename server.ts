import express from 'express';
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

// API: Clear chat status
app.get('/api/clear-status', (req, res) => {
  res.json({
    configured: true,
    hasCustomPassword: Boolean(process.env.CLEAR_PASSWORD),
    defaultPasswordUsed: !process.env.CLEAR_PASSWORD
  });
});

// API: Clear chat password verification for clearing the online database
app.post('/api/clear-chat', (req, res) => {
  try {
    const enteredPassword = (req.body?.password || '').trim();
    const serverPassword = (process.env.CLEAR_PASSWORD || 'ADMIN').trim();

    if (!enteredPassword || enteredPassword.toUpperCase() !== serverPassword.toUpperCase()) {
      res.status(401).json({ 
        success: false, 
        error: 'Incorrect security code. Access denied.' 
      });
      return;
    }

    res.status(200).json({ 
      success: true, 
      authorized: true, 
      message: 'Authorization verified.' 
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
