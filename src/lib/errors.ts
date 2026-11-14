const RESTRICTED_CHARS = /[*^$#@]/g;

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
    return 'The service returned an unexpected response. Please try again in a moment.';
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
    return 'The request took too long to complete. Please try again.';
  }

  if (lower.includes('notallowederror') || lower.includes('clipboard')) {
    return 'Clipboard access is blocked in this browser window. You can download your notes instead.';
  }

  if (lower.includes('resource_exhausted') || lower.includes('prepayment credits')) {
    return 'AI service credits are currently depleted. Top up billing or explore Demo Mode.';
  }

  if (lower.includes('api_key_error') || lower.includes('api_key_invalid')) {
    return 'The AI service key is missing or invalid. Please check server configuration.';
  }

  if (!raw.trim()) {
    return fallback;
  }

  return cleanErrorCopy(raw) || fallback;
}

function mapStatusFallback(status: number): string {
  if (status === 400) {
    return 'Please check your input and try again.';
  }
  if (status === 404) {
    return 'This service route is temporarily unavailable. Please refresh the page and try again.';
  }
  if (status === 402 || status === 429) {
    return 'AI service usage limits were reached. Please wait a moment or try Demo Mode.';
  }
  if (status === 403) {
    return 'Access to this AI service request was declined. Please check configuration.';
  }
  if (status === 503) {
    return 'The AI service is not configured or temporarily unavailable. Please try again shortly.';
  }
  if (status >= 500) {
    return 'The AI service encountered a temporary issue. Please try again shortly.';
  }
  return 'Could not complete your request. Please try again.';
}

export async function safeApiPost<T>(url: string, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const rawText = await res.text();
  let parsed: Record<string, unknown> | null = null;

  if (rawText.trim()) {
    try {
      const candidate = JSON.parse(rawText) as unknown;
      if (candidate && typeof candidate === 'object') {
        parsed = candidate as Record<string, unknown>;
      }
    } catch {
      parsed = null;
    }
  }

  if (!parsed) {
    throw new Error(mapStatusFallback(res.status));
  }

  if (!res.ok) {
    const serverErr =
      typeof parsed.error === 'string' && parsed.error.trim()
        ? parsed.error
        : mapStatusFallback(res.status);
    throw new Error(toUserFriendlyError(serverErr, mapStatusFallback(res.status)));
  }

  return parsed as unknown as T;
}
