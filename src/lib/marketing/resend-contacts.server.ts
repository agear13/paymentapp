import 'server-only';

import { loggers } from '@/lib/logger';

const RESEND_CONTACTS_URL = 'https://api.resend.com/contacts';

export type UpsertMarketingResendContactInput = {
  email: string;
  source: string;
  landingPage?: string | null;
  unsubscribed?: boolean;
};

export type UpsertMarketingResendContactResult = {
  success: boolean;
  contactId?: string | null;
  error?: string | null;
  skipped?: boolean;
};

export type MarketingResendContactDeps = {
  fetchFn?: typeof fetch;
  getApiKeyFn?: () => string | undefined;
  getSegmentIdFn?: () => string | undefined;
};

function readResendError(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const record = body as { message?: unknown; error?: unknown };
  if (typeof record.message === 'string' && record.message) return record.message;
  if (typeof record.error === 'string' && record.error) return record.error;
  return fallback;
}

function defaultGetApiKey(): string | undefined {
  return process.env.RESEND_API_KEY?.trim();
}

function defaultGetSegmentId(): string | undefined {
  return process.env.RESEND_MARKETING_SEGMENT_ID?.trim() || undefined;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function createContact(
  input: UpsertMarketingResendContactInput,
  deps: MarketingResendContactDeps
): Promise<UpsertMarketingResendContactResult> {
  const apiKey = (deps.getApiKeyFn ?? defaultGetApiKey)();
  if (!apiKey) {
    return { success: false, skipped: true, error: 'RESEND_API_KEY not set' };
  }

  const fetchFn = deps.fetchFn ?? fetch;
  const segmentId = (deps.getSegmentIdFn ?? defaultGetSegmentId)();
  const body: Record<string, unknown> = {
    email: input.email,
    unsubscribed: input.unsubscribed ?? false,
    properties: {
      source: input.source,
      ...(input.landingPage ? { landing_page: input.landingPage } : {}),
    },
  };

  if (segmentId) {
    body.segments = [{ id: segmentId }];
  }

  const response = await fetchFn(RESEND_CONTACTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const parsed = await parseJsonResponse(response);

  if (response.ok) {
    const contactId =
      parsed && typeof parsed === 'object' && typeof (parsed as { id?: unknown }).id === 'string'
        ? (parsed as { id: string }).id
        : null;
    return { success: true, contactId };
  }

  if (response.status === 409) {
    return updateContactByEmail(input, deps);
  }

  return {
    success: false,
    error: readResendError(parsed, `Resend contacts.create failed with HTTP ${response.status}`),
  };
}

async function updateContactByEmail(
  input: UpsertMarketingResendContactInput,
  deps: MarketingResendContactDeps
): Promise<UpsertMarketingResendContactResult> {
  const apiKey = (deps.getApiKeyFn ?? defaultGetApiKey)();
  if (!apiKey) {
    return { success: false, skipped: true, error: 'RESEND_API_KEY not set' };
  }

  const fetchFn = deps.fetchFn ?? fetch;
  const encodedEmail = encodeURIComponent(input.email);
  const response = await fetchFn(`${RESEND_CONTACTS_URL}/${encodedEmail}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      unsubscribed: input.unsubscribed ?? false,
      properties: {
        source: input.source,
        ...(input.landingPage ? { landing_page: input.landingPage } : {}),
      },
    }),
  });

  const parsed = await parseJsonResponse(response);
  if (response.ok) {
    const contactId =
      parsed && typeof parsed === 'object' && typeof (parsed as { id?: unknown }).id === 'string'
        ? (parsed as { id: string }).id
        : null;
    return { success: true, contactId };
  }

  return {
    success: false,
    error: readResendError(parsed, `Resend contacts.update failed with HTTP ${response.status}`),
  };
}

/**
 * Create or update a global Resend contact for a website subscriber.
 * Does not send email — contact creation only.
 */
export async function upsertMarketingResendContact(
  input: UpsertMarketingResendContactInput,
  deps: MarketingResendContactDeps = {}
): Promise<UpsertMarketingResendContactResult> {
  try {
    if (!input.email || !input.email.includes('@')) {
      return { success: false, error: 'invalid_email' };
    }

    return await createContact(input, deps);
  } catch (err) {
    loggers.api.warn('Resend marketing contact upsert failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'unexpected_error',
    };
  }
}

/**
 * Mark a Resend contact as globally unsubscribed from marketing broadcasts.
 */
export async function unsubscribeMarketingResendContact(
  email: string,
  deps: MarketingResendContactDeps = {}
): Promise<UpsertMarketingResendContactResult> {
  return updateContactByEmail(
    { email, source: 'unsubscribe', unsubscribed: true },
    deps
  );
}
