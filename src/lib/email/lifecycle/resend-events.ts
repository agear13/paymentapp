import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';

/**
 * Event name that must match the Resend Automation trigger.
 * The installed `resend` SDK (6.6.0) does not expose `events.send`;
 * this helper uses the documented HTTP API instead.
 * @see https://resend.com/docs/api-reference/events/send-event
 */
export const WORKSPACE_CREATED_EVENT_NAME = 'workspace.created';

/**
 * lifecycle_email_sends campaign_key used only to record that the
 * Resend event was emitted. This is not an email campaign and must
 * not be treated as Welcome / AI Advisor / later nurture sends.
 */
export const WORKSPACE_CREATED_EVENT_RECORD_KEY = 'workspace_created_event';

const RESEND_EVENTS_SEND_URL = 'https://api.resend.com/events/send';

export type WorkspaceCreatedEventInput = {
  email: string;
  userId: string;
  organizationId: string;
  workspaceName?: string | null;
};

export type WorkspaceCreatedEventResult = {
  emitted: boolean;
  reason?: string;
  error?: string | null;
};

export type WorkspaceCreatedEventDeps = {
  sendEventFn?: (input: WorkspaceCreatedEventInput) => Promise<{
    success: boolean;
    error?: string | null;
  }>;
  findEventRecordFn?: (userId: string) => Promise<boolean>;
  recordEventFn?: (record: {
    userId: string;
    organizationId: string;
    email: string;
    status: 'sent' | 'failed';
    errorMessage?: string | null;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
};

async function defaultFindEventRecord(userId: string): Promise<boolean> {
  const existing = await prisma.lifecycle_email_sends.findFirst({
    where: {
      user_id: userId,
      campaign_key: WORKSPACE_CREATED_EVENT_RECORD_KEY,
      status: 'sent',
    },
    select: { id: true },
  });
  return Boolean(existing);
}

async function defaultRecordEvent(record: {
  userId: string;
  organizationId: string;
  email: string;
  status: 'sent' | 'failed';
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.lifecycle_email_sends.upsert({
      where: {
        user_id_campaign_key: {
          user_id: record.userId,
          campaign_key: WORKSPACE_CREATED_EVENT_RECORD_KEY,
        },
      },
      create: {
        user_id: record.userId,
        organization_id: record.organizationId || null,
        email: record.email,
        campaign_key: WORKSPACE_CREATED_EVENT_RECORD_KEY,
        status: record.status,
        sent_at: record.status === 'sent' ? new Date() : null,
        error_message: record.errorMessage || null,
        metadata: (record.metadata as object) || null,
      },
      update: {
        status: record.status,
        sent_at: record.status === 'sent' ? new Date() : undefined,
        error_message: record.errorMessage || null,
        metadata: (record.metadata as object) || undefined,
      },
    });
  } catch (err) {
    log.warn('Failed to persist workspace.created event state', {
      userId: record.userId,
      organizationId: record.organizationId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function readResendError(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const record = body as { message?: unknown; error?: unknown };
  if (typeof record.message === 'string' && record.message) return record.message;
  if (typeof record.error === 'string' && record.error) return record.error;
  if (record.error && typeof record.error === 'object') {
    const nested = record.error as { message?: unknown };
    if (typeof nested.message === 'string' && nested.message) return nested.message;
  }
  return fallback;
}

async function defaultSendWorkspaceCreatedEvent(
  input: WorkspaceCreatedEventInput
): Promise<{ success: boolean; error?: string | null }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { success: false, error: 'RESEND_API_KEY not set' };
  }

  const response = await fetch(RESEND_EVENTS_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event: WORKSPACE_CREATED_EVENT_NAME,
      email: input.email,
      payload: {
        userId: input.userId,
        organizationId: input.organizationId,
        workspaceName: input.workspaceName || '',
      },
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

/**
 * Emit the Resend Automation trigger for a newly created workspace.
 * Fails open: never throws to the caller.
 */
export async function emitWorkspaceCreatedEvent(
  input: WorkspaceCreatedEventInput,
  deps: WorkspaceCreatedEventDeps = {}
): Promise<WorkspaceCreatedEventResult> {
  try {
    if (!input.email || !input.email.includes('@')) {
      return { emitted: false, reason: 'invalid_email' };
    }

    const findEvent = deps.findEventRecordFn ?? defaultFindEventRecord;
    const alreadyEmitted = await findEvent(input.userId);
    if (alreadyEmitted) {
      return { emitted: false, reason: 'already_emitted' };
    }

    const sendEvent = deps.sendEventFn ?? defaultSendWorkspaceCreatedEvent;
    const result = await sendEvent(input);
    const recordEvent = deps.recordEventFn ?? defaultRecordEvent;

    if (result.success) {
      await recordEvent({
        userId: input.userId,
        organizationId: input.organizationId,
        email: input.email,
        status: 'sent',
        metadata: {
          event: WORKSPACE_CREATED_EVENT_NAME,
          workspaceName: input.workspaceName || null,
        },
      });
      return { emitted: true };
    }

    log.warn('workspace.created event emission failed', {
      userId: input.userId,
      organizationId: input.organizationId,
      error: result.error || 'unknown_error',
    });

    return { emitted: false, reason: 'provider_error', error: result.error || null };
  } catch (err) {
    log.error('emitWorkspaceCreatedEvent failed open', {
      userId: input.userId,
      organizationId: input.organizationId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      emitted: false,
      reason: 'unexpected_error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
