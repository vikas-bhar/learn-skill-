import type { ServerResponse } from 'node:http';
import { handleApiHttpRequest, type ApiRequest } from './_lib/router.js';

export default async function handler(req: ApiRequest, res: ServerResponse): Promise<void> {
  try {
    const parsed = new URL(req.url || '/api', 'http://localhost');
    const rewrittenSubpath = parsed.searchParams.get('__api_path');

    if (rewrittenSubpath) {
      const cleanSubpath = rewrittenSubpath.replace(/^\/+/, '');
      parsed.searchParams.delete('__api_path');
      const qs = parsed.searchParams.toString();
      req.url = cleanSubpath ? `/api/${cleanSubpath}${qs ? `?${qs}` : ''}` : `/api${qs ? `?${qs}` : ''}`;
      req.originalUrl = req.url;
    } else if (!parsed.pathname.startsWith('/api')) {
      const suffix = parsed.pathname === '/' ? '' : parsed.pathname;
      const qs = parsed.searchParams.toString();
      req.url = `/api${suffix}${qs ? `?${qs}` : ''}`;
      req.originalUrl = req.url;
    }

    await handleApiHttpRequest(req, res);
  } catch (error) {
    console.error('Fatal /api handler error:', error);
    if (!res.writableEnded && !res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Internal API invocation error.' }));
    }
  }
}
