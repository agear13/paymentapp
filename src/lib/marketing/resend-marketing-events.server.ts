import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';

/**
 * Resend Automation trigger for new website subscribers.
 * @see https://resend.com/docs/api-reference/events/send-event
 */
export const MARKETING_SUBSCRIBER_CREATED_EVENT = 'marketing.subscriber.created';

/**
 * Resend Automation stop signal when a subscriber creates a Provvy account.
 */
export const MARKETING_SUBSCRIBER_CONVERTED_EVENT = 'marketing.subscriber.converted';

const RESEND_EVENTS_SEND_URL = 'https://api.resend.com/events/send';

export type MarketingSubscriberCreatedEventInput = {
  signupId: string;
  email: string;
  source: string;
  landingPage?: string | null;
};

export type MarketingSubscriberConvertedEventInput = {
  email: string;
  source?: string | null;
};

export type MarketingEventResult = {
  emitted: boolean;
  reason?: string;
  error?: string | null;
};

export type MarketingEventDeps = {
  sendEventFn?: (input: {
    event: string;
    email: string;
    payload: Record<string, string>;
  }) => Promise<{ success: boolean; error?: string | null }>;
  fetchFn?: typeof fetch;
  getApiKeyFn?: () => string | undefined;
};

function readResendError(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const record = body as { message?: unknown; error?: unknown };
  if (typeof record.message === 'string' && record.message) return record.message;
  if (typeof record.error === 'string' && record.error) return record.error;
  return fallback;
}

async function defaultSendResendEvent(input: {
  event: string;
  email: string;
  payload: Record<string, string>;
  deps: MarketingEventDeps;
}): Promise<{ success: boolean; error?: string | null }> {
  const apiKey = (input.deps.getApiKeyFn ?? (() => process.env.RESEND_API_KEY?.trim()))();
  if (!apiKey) {
    return { success: false, error: 'RESEND_API_KEY not set' };
  }

  const fetchFn = input.deps.fetchFn ?? fetch;
  const response = await fetchFn(RESEND_EVENTS_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event: input.event,
      email: input.email,
      payload: input.payload,
    }),
  });

  if (!response.ok) {
    let parsed: unknown = null;
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }
    return {
      success: false,
      error: readResendError(parsed, `Resend events.send failed with HTTP ${response.status}`),
    };
  }

  return { success: true };
}

export async function emitMarketingSubscriberCreatedEvent(
  input: MarketingSubscriberCreatedEventInput,
  deps: MarketingEventDeps = {}
): Promise<MarketingEventResult> {
  try {
    if (!input.email || !input.email.includes('@')) {
      return { emitted: false, reason: 'invalid_email' };
    }

    const existing = await prisma.marketing_waitlist_signups.findUnique({
      where: { id: input.signupId },
      select: { subscriber_created_event_at: true },
    });

    if (existing?.subscriber_created_event_at) {
      return { emitted: false, reason: 'already_emitted' };
    }

    const sendEvent =
      deps.sendEventFn ??
      (async (eventInput) =>
        defaultSendResendEvent({ ...eventInput, deps }));

    const result = await sendEvent({
      event: MARKETING_SUBSCRIBER_CREATED_EVENT,
      email: input.email,
      payload: {
        source: input.source,
        landing_page: input.landingPage ?? '',
      },
    });

    if (result.success) {
      await prisma.marketing_waitlist_signups.update({
        where: { id: input.signupId },
        data: { subscriber_created_event_at: new Date() },
      });
      return { emitted: true };
    }

    log.warn('marketing.subscriber.created event emission failed', {
      signupId: input.signupId,
      error: result.error || 'unknown_error',
    });
    return { emitted: false, reason: 'provider_error', error: result.error || null };
  } catch (err) {
    log.error('emitMarketingSubscriberCreatedEvent failed open', {
      signupId: input.signupId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      emitted: false,
      reason: 'unexpected_error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function emitMarketingSubscriberConvertedEvent(
  input: MarketingSubscriberConvertedEventInput,
  deps: MarketingEventDeps = {}
): Promise<MarketingEventResult> {
  try {
    if (!input.email || !input.email.includes('@')) {
      return { emitted: false, reason: 'invalid_email' };
    }

    const alreadyEmitted = await prisma.marketing_waitlist_signups.findFirst({
      where: {
        email: input.email,
        subscriber_converted_event_at: { not: null },
      },
      select: { id: true },
    });

    if (alreadyEmitted) {
      return { emitted: false, reason: 'already_emitted' };
    }

    const sendEvent =
      deps.sendEventFn ??
      (async (eventInput) =>
        defaultSendResendEvent({ ...eventInput, deps }));

    const result = await sendEvent({
      event: MARKETING_SUBSCRIBER_CONVERTED_EVENT,
      email: input.email,
      payload: {
        source: input.source ?? '',
      },
    });

    if (result.success) {
      await prisma.marketing_waitlist_signups.updateMany({
        where: { email: input.email },
        data: { subscriber_converted_event_at: new Date() },
      });
      return { emitted: true };
    }

    log.warn('marketing.subscriber.converted event emission failed', {
      error: result.error || 'unknown_error',
    });
    return { emitted: false, reason: 'provider_error', error: result.error || null };
  } catch (err) {
    log.error('emitMarketingSubscriberConvertedEvent failed open', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      emitted: false,
      reason: 'unexpected_error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
