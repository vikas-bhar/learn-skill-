const RESTRICTED_CHARS = /[*^$#@]/g;
const DEFAULT_API_TIMEOUT_MS = 45000;

export type ApiErrorKind =
  | 'input'
  | 'server'
  | 'rate_limit'
  | 'auth'
  | 'not_found'
  | 'network'
  | 'timeout'
  | 'unknown';

export class ApiRequestError extends Error {
  status?: number;
  code?: string;
  kind: ApiErrorKind;

  constructor(
    message: string,
    options: { status?: number; code?: string; kind: ApiErrorKind }
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = options.status;
    this.code = options.code;
    this.kind = options.kind;
  }
}

function cleanErrorCopy(msg: string): string {
  return msg
    .replace(/\s*&\s*/g, ' and ')
    .replace(RESTRICTED_CHARS, '')
    .trim();
}

export function toUserFriendlyError(
  err: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (err instanceof ApiRequestError && err.message.trim()) {
    return cleanErrorCopy(err.message) || fallback;
  }

  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
      ? err
      : '';

  const lower = raw.toLowerCase();

  if (
    lower.includes('unexpected token') ||
    lower.includes('is not valid json') ||
    lower.includes('json.parse') ||
    lower.includes('syntaxerror')
  ) {
    return 'Server response could not be read. Please try again in a moment.';
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('network request failed')
  ) {
    return 'Unable to reach the server right now. Check your internet connection and try again.';
  }

  if (lower.includes('aborterror') || lower.includes('timed out') || lower.includes('timeout')) {
    return 'The AI service took too long to respond. Please try again.';
  }

  if (lower.includes('notallowederror') || lower.includes('clipboard')) {
    return 'Clipboard access is blocked in this browser window. You can download your notes instead.';
  }

  if (lower.includes('resource_exhausted') || lower.includes('prepayment credits')) {
    return 'AI service usage limit reached. Please wait a moment or explore Demo Mode.';
  }

  if (lower.includes('api_key_error') || lower.includes('api_key_invalid')) {
    return 'Server AI configuration issue: the AI API key is invalid or lacks permissions.';
  }

  if (!raw.trim()) {
    return fallback;
  }

  return cleanErrorCopy(raw) || fallback;
}

function classifyHttpStatus(status: number, code?: string): ApiErrorKind {
  if (status === 400 || status === 422) return 'input';
  if (status === 402 || status === 429 || code === 'RESOURCE_EXHAUSTED') return 'rate_limit';
  if (status === 401 || status === 403 || code === 'API_KEY_ERROR') return 'auth';
  if (status === 404) return 'not_found';
  if (status >= 500 || code === 'MISSING_API_KEY') return 'server';
  return 'unknown';
}

function mapStatusFallback(status: number): string {
  if (status === 400 || status === 422) {
    return 'Check your input and try again.';
  }
  if (status === 404) {
    return 'This service route is temporarily unavailable. Please refresh the page and try again.';
  }
  if (status === 402 || status === 429) {
    return 'AI service usage limits were reached. Please wait a moment or try Demo Mode.';
  }
  if (status === 401 || status === 403) {
    return 'Access to this AI service request was declined. Please check configuration.';
  }
  if (status === 503) {
    return 'AI service unavailable: the server is not configured or temporarily down. Please try again shortly.';
  }
  if (status >= 500) {
    return 'Server outage or temporary AI service error. Please try again shortly.';
  }
  return 'Could not complete your request. Please try again.';
}

function formatHttpErrorMessage(
  status: number,
  serverMessage: string | null,
  code?: string
): { message: string; kind: ApiErrorKind } {
  const kind = classifyHttpStatus(status, code);
  const cleanedDetail = serverMessage ? cleanErrorCopy(serverMessage) : '';

  if (kind === 'input') {
    const detail = cleanedDetail || 'Please review your entry and try again.';
    const message = detail.toLowerCase().startsWith('check your input')
      ? detail
      : `Check your input: ${detail}`;
    return { message, kind };
  }

  if (kind === 'server') {
    if (status === 503 || code === 'MISSING_API_KEY') {
      const detail =
        cleanedDetail || 'Server AI configuration is missing or unavailable.';
      return {
        message: `AI service unavailable (server error): ${detail}`,
        kind,
      };
    }
    const detail =
      cleanedDetail || 'The AI service encountered a temporary server error.';
    return {
      message: `Server error: ${detail}`,
      kind,
    };
  }

  if (kind === 'rate_limit') {
    return {
      message:
        cleanedDetail ||
        'AI service usage limits were reached. Please wait a moment or try Demo Mode.',
      kind,
    };
  }

  if (kind === 'auth') {
    return {
      message:
        cleanedDetail ||
        'Access to this AI service request was declined. Please check configuration.',
      kind,
    };
  }

  if (kind === 'not_found') {
    return {
      message: mapStatusFallback(404),
      kind,
    };
  }

  return {
    message: cleanedDetail || mapStatusFallback(status),
    kind,
  };
}

export async function safeApiPost<T>(
  url: string,
  payload: unknown,
  timeoutMs = DEFAULT_API_TIMEOUT_MS
): Promise<T> {
  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timerId =
    controller && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller?.signal,
    });
  } catch (err) {
    const lower =
      err instanceof Error ? err.message.toLowerCase() : String(err ?? '').toLowerCase();
    const isAbort =
      (err instanceof Error && err.name === 'AbortError') || lower.includes('abort');
    if (isAbort) {
      throw new ApiRequestError(
        'The AI service took too long to respond. Please try again.',
        { kind: 'timeout' }
      );
    }
    throw new ApiRequestError(
      'Unable to reach the server right now. Check your internet connection and try again.',
      { kind: 'network' }
    );
  } finally {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
  }

  let rawText = '';
  try {
    rawText = await res.text();
  } catch {
    throw new ApiRequestError(mapStatusFallback(res.status), {
      status: res.status,
      kind: classifyHttpStatus(res.status),
    });
  }

  let parsed: Record<string, unknown> | null = null;
  if (rawText.trim()) {
    try {
      const candidate = JSON.parse(rawText) as unknown;
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        parsed = candidate as Record<string, unknown>;
      }
    } catch {
      parsed = null;
    }
  }

  if (!parsed) {
    const { message, kind } = formatHttpErrorMessage(res.status, null);
    throw new ApiRequestError(message, { status: res.status, kind });
  }

  if (!res.ok) {
    const serverCode = typeof parsed.code === 'string' ? parsed.code : undefined;
    const serverErr =
      typeof parsed.error === 'string' && parsed.error.trim() ? parsed.error : null;
    const { message, kind } = formatHttpErrorMessage(res.status, serverErr, serverCode);
    throw new ApiRequestError(message, {
      status: res.status,
      code: serverCode,
      kind,
    });
  }

  return parsed as unknown as T;
}
