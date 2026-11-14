import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http, { type Server } from 'node:http';
import vercelHandler from '../api/index.js';
import {
  API_ROUTES,
  handleApiHttpRequest,
  normalizePathname,
} from '../api/_lib/router.js';

async function withServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void> | void,
  fn: (baseUrl: string) => Promise<void>
): Promise<void> {
  const server: Server = http.createServer((req, res) => {
    void handler(req, res);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new Error('Failed to bind ephemeral test port');
  }

  try {
    await fn(`http://127.0.0.1:${addr.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('API router normalization and endpoint handling', () => {
  it('normalizes paths with query strings, trailing slashes, and missing prefixes', () => {
    assert.equal(normalizePathname(undefined), '/api');
    assert.equal(normalizePathname('/'), '/api');
    assert.equal(normalizePathname('/api/'), '/api');
    assert.equal(normalizePathname('/api/health/'), '/api/health');
    assert.equal(normalizePathname('/health?foo=bar'), '/api/health');
    assert.equal(normalizePathname('/api/skill-tree/quiz?x=1'), '/api/skill-tree/quiz');
  });

  it('serves API metadata, health, CORS preflight, and security headers', async () => {
    await withServer(handleApiHttpRequest, async (baseUrl) => {
      const rootRes = await fetch(`${baseUrl}/api`);
      assert.equal(rootRes.status, 200);
      assert.equal(rootRes.headers.get('x-content-type-options'), 'nosniff');
      const rootJson = (await rootRes.json()) as {
        status: string;
        routes: string[];
      };
      assert.equal(rootJson.status, 'ok');
      assert.equal(rootJson.routes.length, API_ROUTES.length);

      const healthRes = await fetch(`${baseUrl}/api/health`);
      assert.equal(healthRes.status, 200);
      const healthJson = (await healthRes.json()) as {
        status: string;
        routesCount: number;
      };
      assert.equal(healthJson.status, 'ok');
      assert.equal(healthJson.routesCount, API_ROUTES.length);

      const optionsRes = await fetch(`${baseUrl}/api/skill-tree/quiz`, {
        method: 'OPTIONS',
      });
      assert.equal(optionsRes.status, 204);
      assert.equal(optionsRes.headers.get('allow'), 'GET, POST, OPTIONS');
    });
  });

  it('handles Vercel __api_path rewrites through api/index.ts', async () => {
    await withServer(vercelHandler, async (baseUrl) => {
      const healthRes = await fetch(`${baseUrl}/api?__api_path=health`);
      assert.equal(healthRes.status, 200);
      const healthJson = (await healthRes.json()) as { status: string };
      assert.equal(healthJson.status, 'ok');

      const validationRes = await fetch(
        `${baseUrl}/api?__api_path=videos/search`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '' }),
        }
      );
      assert.equal(validationRes.status, 400);
      const validationJson = (await validationRes.json()) as { error: string };
      assert.match(validationJson.error, /search query/i);
    });
  });

  it('returns structured 400 and 404 JSON on invalid JSON, missing fields, and unknown endpoints', async () => {
    await withServer(handleApiHttpRequest, async (baseUrl) => {
      const badJsonRes = await fetch(`${baseUrl}/api/skill-tree/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid-json',
      });
      assert.equal(badJsonRes.status, 400);
      const badJsonBody = (await badJsonRes.json()) as { error: string };
      assert.match(badJsonBody.error, /Invalid JSON/i);

      const missingTopicRes = await fetch(`${baseUrl}/api/diagnostic/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: '   ' }),
      });
      assert.equal(missingTopicRes.status, 400);

      const unknownRes = await fetch(`${baseUrl}/api/non-existent-route`, {
        method: 'POST',
      });
      assert.equal(unknownRes.status, 404);
      const unknownJson = (await unknownRes.json()) as { error: string };
      assert.match(unknownJson.error, /not found/i);
    });
  });

  it('accepts string and object node payloads on /api/skill-tree/quiz and surfaces MISSING_API_KEY cleanly', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      await withServer(handleApiHttpRequest, async (baseUrl) => {
        const stringNodeRes = await fetch(`${baseUrl}/api/skill-tree/quiz`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ node: 'functions' }),
        });
        assert.equal(stringNodeRes.status, 503);
        const stringNodeJson = (await stringNodeRes.json()) as {
          code: string;
          error: string;
        };
        assert.equal(stringNodeJson.code, 'MISSING_API_KEY');

        const missingNodeRes = await fetch(`${baseUrl}/api/skill-tree/quiz`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        assert.equal(missingNodeRes.status, 400);
      });
    } finally {
      if (prevKey !== undefined) {
        process.env.GEMINI_API_KEY = prevKey;
      } else {
        delete process.env.GEMINI_API_KEY;
      }
    }
  });
});
