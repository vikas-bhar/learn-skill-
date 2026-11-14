import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from '../server/apiApp';

const apiApp = createApiApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (!req.url || !req.url.startsWith('/api')) {
    const suffix = req.url ? (req.url.startsWith('/') ? req.url : `/${req.url}`) : '';
    req.url = `/api${suffix}`;
  }
  return apiApp(req as Parameters<typeof apiApp>[0], res as Parameters<typeof apiApp>[1]);
}
