import type { Server } from 'http';
import { createApiApp } from '../server/apiApp';

interface RouteCheck {
  method: 'GET' | 'POST';
  path: string;
  body?: Record<string, unknown>;
}

const ROUTES_TO_CHECK: RouteCheck[] = [
  { method: 'GET', path: '/api' },
  { method: 'POST', path: '/api' },
  { method: 'GET', path: '/api/health' },
  { method: 'POST', path: '/api/diagnostic/turn', body: { topic: '' } },
  { method: 'POST', path: '/api/skill-tree/generate', body: { topic: '' } },
  { method: 'POST', path: '/api/skill-tree/quiz', body: {} },
  { method: 'POST', path: '/api/skill-tree/evaluate', body: {} },
  { method: 'POST', path: '/api/skill-tree/final-exam/generate', body: { topic: '' } },
  { method: 'POST', path: '/api/skill-tree/final-exam/evaluate', body: {} },
  { method: 'POST', path: '/api/videos/search', body: { query: '' } },
  { method: 'POST', path: '/api/videos/quiz', body: {} },
  { method: 'POST', path: '/api/videos/evaluate', body: {} },
  { method: 'POST', path: '/api/videos/summarize', body: {} },
  { method: 'POST', path: '/api/skill-tree/projects/generate', body: { topic: '' } },
  { method: 'POST', path: '/api/skill-tree/projects/evaluate', body: {} },
];

async function main() {
  let server: Server | null = null;
  let baseUrl = (process.env.API_BASE_URL || '').replace(/\/+$/, '');

  if (!baseUrl) {
    const app = createApiApp();
    const started = await new Promise<Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    server = started;
    const addr = started.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('Failed to bind ephemeral smoke-test port');
    }
    baseUrl = `http://127.0.0.1:${addr.port}`;
  }

  console.log(`Running SkillPath AI API smoke checks against ${baseUrl}...`);
  let failures = 0;

  try {
    for (const check of ROUTES_TO_CHECK) {
      const url = `${baseUrl}${check.path}`;
      const res = await fetch(url, {
        method: check.method,
        headers: check.method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body: check.method === 'POST' ? JSON.stringify(check.body || {}) : undefined,
      });

      const rawText = await res.text();
      let isJson = false;
      try {
        JSON.parse(rawText);
        isJson = true;
      } catch {
        isJson = false;
      }

      if (res.status === 404 || !isJson) {
        failures++;
        console.error(
          `FAIL ${check.method} ${check.path} -> HTTP ${res.status}, isJson=${isJson}, body=${rawText.slice(0, 120)}`
        );
      } else {
        console.log(`PASS ${check.method} ${check.path} -> HTTP ${res.status} (JSON)`);
      }
    }
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
  }

  if (failures > 0) {
    console.error(`\nAPI smoke test failed with ${failures} failing route(s).`);
    process.exit(1);
  }
  console.log(`\nAll ${ROUTES_TO_CHECK.length} API route checks passed with non-404 JSON responses.`);
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
