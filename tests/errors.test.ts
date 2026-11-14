import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiRequestError,
  safeApiPost,
  toUserFriendlyError,
} from '../src/lib/errors.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('toUserFriendlyError', () => {
  it('maps raw JSON parse, network, timeout, and clipboard errors to user-friendly copy', () => {
    assert.match(
      toUserFriendlyError(new SyntaxError("Unexpected token 'T', \"The page c\"... is not valid JSON")),
      /could not be read/i
    );
    assert.match(
      toUserFriendlyError(new TypeError('Failed to fetch')),
      /Unable to reach the server/i
    );
    assert.match(
      toUserFriendlyError(new Error('AbortError: request timed out')),
      /took too long/i
    );
    assert.match(
      toUserFriendlyError(new Error('NotAllowedError: Clipboard permission denied')),
      /Clipboard access is blocked/i
    );
    assert.match(
      toUserFriendlyError('RESOURCE_EXHAUSTED: prepayment credits'),
      /usage limit reached/i
    );
  });

  it('sanitizes restricted symbols from user-facing error messages', () => {
    const cleaned = toUserFriendlyError('Error: *Bad* input & $weird ^tokens #1 @dev');
    assert.equal(/[&*^$#@]/.test(cleaned), false);
    assert.match(cleaned, /\band\b/);
  });

  it('returns fallback when message is empty or unknown type', () => {
    assert.equal(toUserFriendlyError(null, 'Custom fallback'), 'Custom fallback');
    assert.equal(toUserFriendlyError('   ', 'Custom fallback'), 'Custom fallback');
  });
});

describe('safeApiPost', () => {
  it('returns parsed JSON payload on 200 OK', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: true, count: 3 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    const result = await safeApiPost<{ ok: boolean; count: number }>('/api/health', { ping: true });
    assert.deepEqual(result, { ok: true, count: 3 });
  });

  it('distinguishes user-fixable 400 errors from server outage 500/503 errors', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'Topic is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    await assert.rejects(
      () => safeApiPost('/api/diagnostic/turn', { topic: '' }),
      (err: unknown) =>
        err instanceof ApiRequestError &&
        err.kind === 'input' &&
        err.status === 400 &&
        /Check your input: Topic is required\./i.test(err.message)
    );

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          error: 'Server AI configuration is missing GEMINI_API_KEY.',
          code: 'MISSING_API_KEY',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    await assert.rejects(
      () => safeApiPost('/api/skill-tree/quiz', { node: 'functions' }),
      (err: unknown) =>
        err instanceof ApiRequestError &&
        err.kind === 'server' &&
        err.status === 503 &&
        err.code === 'MISSING_API_KEY' &&
        /AI service unavailable \(server error\): .*GEMINI_API_KEY/i.test(err.message)
    );

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'Upstream model crashed.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    await assert.rejects(
      () => safeApiPost('/api/videos/search', { query: 'python' }),
      (err: unknown) =>
        err instanceof ApiRequestError &&
        err.kind === 'server' &&
        err.status === 500 &&
        /Server error: Upstream model crashed\./i.test(err.message)
    );
  });

  it('maps non-JSON 404 or 503 responses to safe status messages without leaking raw HTML', async () => {
    globalThis.fetch = (async () =>
      new Response('The page could not be found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      })) as typeof fetch;

    await assert.rejects(
      () => safeApiPost('/api/missing', {}),
      (err: unknown) =>
        err instanceof ApiRequestError &&
        err.kind === 'not_found' &&
        /temporarily unavailable/i.test(err.message)
    );
  });

  it('converts fetch network errors and timeouts cleanly into ApiRequestError', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;

    await assert.rejects(
      () => safeApiPost('/api/skill-tree/quiz', { node: 'functions' }),
      (err: unknown) =>
        err instanceof ApiRequestError &&
        err.kind === 'network' &&
        /Unable to reach the server/i.test(err.message)
    );

    globalThis.fetch = (async () => {
      const abortErr = new Error('The operation was aborted.');
      abortErr.name = 'AbortError';
      throw abortErr;
    }) as typeof fetch;

    await assert.rejects(
      () => safeApiPost('/api/skill-tree/quiz', { node: 'functions' }),
      (err: unknown) =>
        err instanceof ApiRequestError &&
        err.kind === 'timeout' &&
        /took too long/i.test(err.message)
    );
  });
});
