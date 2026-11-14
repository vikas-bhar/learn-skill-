import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mountApiRoutes } from './server/apiApp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const KNOWN_CLIENT_PATHS = new Set(['/', '/index.html']);

function isHtmlPageRequest(req: Request): boolean {
  if (req.method !== 'GET') return false;
  if (req.path.startsWith('/api')) return false;
  if (req.path.startsWith('/@') || req.path.startsWith('/src/') || req.path.startsWith('/node_modules/')) {
    return false;
  }
  const accept = req.headers.accept || '';
  if (!accept.includes('text/html') && accept !== '*/*') return false;
  const lastSegment = req.path.split('/').pop() || '';
  if (lastSegment.includes('.') && !lastSegment.endsWith('.html')) return false;
  return true;
}

async function startServer() {
  const app = express();
  mountApiRoutes(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(async (req: Request, res: Response, next) => {
      if (isHtmlPageRequest(req) && !KNOWN_CLIENT_PATHS.has(req.path)) {
        try {
          const templatePath = path.join(__dirname, 'index.html');
          const template = fs.readFileSync(templatePath, 'utf-8');
          const html = await vite.transformIndexHtml(req.originalUrl, template);
          res.status(404).set({ 'Content-Type': 'text/html' }).end(html);
          return;
        } catch (err) {
          vite.ssrFixStacktrace(err as Error);
        }
      }
      next();
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      if (KNOWN_CLIENT_PATHS.has(req.path)) {
        res.sendFile(path.join(distPath, 'index.html'));
        return;
      }
      const notFoundPath = path.join(distPath, '404.html');
      const target = fs.existsSync(notFoundPath) ? notFoundPath : path.join(distPath, 'index.html');
      res.status(404).sendFile(target);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SynapsePath full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
