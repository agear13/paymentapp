/**
 * Commercial Notification Dispatch
 *
 * Server-side utility that persists operator notifications for commercial
 * workflow milestones. This is the single point of dispatch for all
 * Commercial OS notifications.
 *
 * Architecture rules:
 *   - This module is the ONLY place that calls createNotification() for
 *     commercial workflow events. No component may dispatch commercial
 *     notifications independently.
 *   - Every event maps to exactly ONE notification with ONE recommended action.
 *   - Notifications are idempotent: duplicate events for the same
 *     project + participant + eventKind are silently skipped.
 *   - Errors are caught and logged — notifications never block the main workflow.
 *
 * Usage (from an API route):
 * ```typescript
 * await dispatchCommercialNotification({
 *   organizationId,
 *   eventKind: 'agreement_approved',
 *   projectId: deal.id,
 *   participantId: participant.id,
 *   participantName: participant.name,
 * });
 * ```
 */

import 'server-only';
import { prisma } from '@/lib/server/prisma';
import { v4 as uuidv4 } from 'uuid';
import type { CommercialEventKind } from '@/lib/commercial/commercial-event-bus';

/* ─── Notification templates ─────────────────────────────────────────────── */

type CommercialNotificationTemplate = {
  title: (ctx: NotificationContext) => string;
  message: (ctx: NotificationContext) => string;
  consequence: (ctx: NotificationContext) => string;
  action: string;
  actionPath: (ctx: NotificationContext) => string;
};

type NotificationContext = {
  participantName: string;
  projectId: string;
  participantId?: string;
  amount?: number;
  currency?: string;
};

const TEMPLATES: Partial<Record<CommercialEventKind, CommercialNotificationTemplate>> = {
  agreement_approved: {
    title: (ctx) => `${ctx.participantName} approved the agreement`,
    message: (ctx) =>
      `${ctx.participantName} has accepted the commercial terms. A payment setup link has been sent to them automatically.`,
    consequence: () => 'Payment setup unlocks invoice generation and settlement.',
    action: 'Prepare for payment',
    actionPath: (ctx) =>
      ctx.participantId
        ? `/dashboard/projects/${encodeURIComponent(ctx.projectId)}/participants/${encodeURIComponent(ctx.participantId)}/onboard`
        : `/dashboard/projects/${encodeURIComponent(ctx.projectId)}/participants?focus=onboarding`,
  },

  supplier_onboarding_started: {
    title: (ctx) => `${ctx.participantName} opened payment setup`,
    message: (ctx) =>
      `${ctx.participantName} has started completing their payment information.`,
    consequence: () => 'Await submission before proceeding to accounting.',
    action: 'View payment setup',
    actionPath: (ctx) =>
      ctx.participantId
        ? `/dashboard/projects/${encodeURIComponent(ctx.projectId)}/participants/${encodeURIComponent(ctx.participantId)}/onboard`
        : `/dashboard/projects/${encodeURIComponent(ctx.projectId)}/participants?focus=onboarding`,
  },

  supplier_details_submitted: {
    title: (ctx) => `${ctx.participantName} submitted payment information`,
    message: (ctx) =>
      `${ctx.participantName} has submitted their bank details, ABN, and GST status. Review and approve to proceed with Xero export.`,
    consequence: () => 'Review is required before the invoice can be exported to Xero.',
    action: 'Review payment information',
    actionPath: (ctx) =>
      ctx.participantId
        ? `/dashboard/projects/${encodeURIComponent(ctx.projectId)}/participants/${encodeURIComponent(ctx.participantId)}/review`
        : `/dashboard/projects/${encodeURIComponent(ctx.projectId)}/participants?focus=onboarding`,
  },

  supplier_onboarding_approved: {
    title: (ctx) => `${ctx.participantName}'s payment information approved`,
    message: (ctx) =>
      `Payment details for ${ctx.participantName} have been verified. The invoice is ready to export to Xero.`,
    consequence: () => 'Export the invoice to Xero to complete accounting before settlement.',
    action: 'Export to Xero',
    actionPath: (ctx) =>
      `/dashboard/projects/${encodeURIComponent(ctx.projectId)}/funding?section=accounting`,
  },

  supplier_invoice_generated: {
    title: (ctx) => `Draft invoice generated for ${ctx.participantName}`,
    message: (ctx) =>
      `A draft invoice was automatically generated for ${ctx.participantName} from the approved commercial terms. A payment setup link has been emailed to them.`,
    consequence: () => 'The supplier will confirm the invoice and provide payment details.',
    action: 'View payment setup',
    actionPath: (ctx) =>
      ctx.participantId
        ? `/dashboard/projects/${encodeURIComponent(ctx.projectId)}/participants/${encodeURIComponent(ctx.participantId)}/onboard`
        : `/dashboard/projects/${encodeURIComponent(ctx.projectId)}/participants?focus=onboarding`,
  },

  supplier_invoice_exported: {
    title: (ctx) => `${ctx.participantName}'s invoice exported to Xero`,
    message: (ctx) =>
      `Invoice for ${ctx.participantName} was successfully exported to Xero. Await revenue collection to fund the obligation.`,
    consequence: () => 'Accounting is complete. Settlement can begin once revenue is received.',
    action: 'Review funding status',
    actionPath: (ctx) =>
      `/dashboard/projects/${encodeURIComponent(ctx.projectId)}/funding`,
  },

  invoice_approved: {
    title: (ctx) => `Invoice approved for ${ctx.participantName}`,
    message: (ctx) =>
      `The commercial invoice for ${ctx.participantName} has been approved and is ready for Xero export.`,
    consequence: () => 'Export the invoice to complete the accounting workflow.',
    action: 'Export to Xero',
    actionPath: (ctx) =>
      `/dashboard/projects/${encodeURIComponent(ctx.projectId)}/funding?section=accounting`,
  },

  invoice_exported: {
    title: (ctx) => `Invoice exported to Xero for ${ctx.participantName}`,
    message: (ctx) =>
      `The accounting export for ${ctx.participantName} is complete. Xero has been updated.`,
    consequence: () => 'Accounting is reconciled. Proceed to settlement when revenue is received.',
    action: 'View commercial timeline',
    actionPath: (ctx) => `/dashboard/projects/${encodeURIComponent(ctx.projectId)}`,
  },

  revenue_confirmed: {
    title: () => 'Revenue confirmed',
    message: (ctx) =>
      ctx.amount
        ? `${ctx.currency ?? 'AUD'} ${ctx.amount.toLocaleString()} in revenue has been confirmed. Settlement readiness is being evaluated.`
        : 'Revenue has been confirmed. Settlement readiness is being evaluated.',
    consequence: () => 'Settlement can begin once all obligations are funded.',
    action: 'View settlement readiness',
    actionPath: (ctx) =>
      `/dashboard/projects/${encodeURIComponent(ctx.projectId)}/funding`,
  },

  settlement_ready: {
    title: () => 'Settlement ready',
    message: (ctx) =>
      `All commercial obligations for this agreement are funded and ready for payment release.`,
    consequence: () => 'Release payments to all participants to complete the commercial cycle.',
    action: 'Release payments',
    actionPath: (ctx) =>
      `/dashboard/projects/${encodeURIComponent(ctx.projectId)}/payouts`,
  },

  payment_released: {
    title: (ctx) => `Payment released to ${ctx.participantName}`,
    message: (ctx) =>
      `The commercial obligation to ${ctx.participantName} has been fulfilled. Payment released successfully.`,
    consequence: () => 'Commercial performance will update to reflect this settlement.',
    action: 'View commercial performance',
    actionPath: (ctx) => `/dashboard/projects/${encodeURIComponent(ctx.projectId)}`,
  },

  settlement_completed: {
    title: () => 'Agreement fully settled',
    message: () =>
      'All commercial obligations have been fulfilled. The agreement is now operationally complete.',
    consequence: () =>
      'Review commercial performance to understand the final commercial outcome.',
    action: 'View commercial performance',
    actionPath: (ctx) => `/dashboard/projects/${encodeURIComponent(ctx.projectId)}`,
  },
};

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type DispatchCommercialNotificationInput = {
  /** The operator's organization ID (for notification ownership). */
  organizationId: string;
  /** Optional: the operator's email for in-app delivery. */
  operatorEmail?: string | null;
  /** The commercial event kind. */
  eventKind: CommercialEventKind;
  /** The project/agreement ID. */
  projectId: string;
  /** The participant involved, if applicable. */
  participantId?: string;
  /** Display name of the participant. */
  participantName?: string;
  /** Optional monetary amount for context. */
  amount?: number;
  /** Optional currency. */
  currency?: string;
};

/* ─── Idempotency key ────────────────────────────────────────────────────── */

/**
 * Generates a deterministic key for this event so we can check for duplicates.
 * Format: `commercial:{eventKind}:{projectId}:{participantId?}`
 */
function buildIdempotencyKey(input: DispatchCommercialNotificationInput): string {
  const parts = ['commercial', input.eventKind, input.projectId];
  if (input.participantId) parts.push(input.participantId);
  return parts.join(':');
}

/* ─── Core dispatch function ─────────────────────────────────────────────── */

/**
 * Dispatch a single commercial workflow notification.
 *
 * - Idempotent: skips if a notification with the same event key already exists.
 * - Never throws: errors are caught and logged. Notifications never block workflows.
 * - Requires `organizationId` to scope the notification correctly.
 */
export async function dispatchCommercialNotification(
  input: DispatchCommercialNotificationInput
): Promise<void> {
  const template = TEMPLATES[input.eventKind];
  if (!template) return; // Event kind not tracked — silently skip

  const idempotencyKey = buildIdempotencyKey(input);
  const ctx: NotificationContext = {
    participantName: input.participantName ?? 'Participant',
    projectId: input.projectId,
    participantId: input.participantId,
    amount: input.amount,
    currency: input.currency,
  };

  try {
    // Idempotency check: skip if notification already exists for this event
    const existing = await prisma.notifications.findFirst({
      where: {
        organization_id: input.organizationId,
        data: {
          path: ['idempotencyKey'],
          equals: idempotencyKey,
        },
      },
      select: { id: true },
    });

    if (existing) return; // Already dispatched — skip

    await prisma.notifications.create({
      data: {
        id: uuidv4(),
        organization_id: input.organizationId,
        user_email: input.operatorEmail ?? undefined,
        type: 'SYSTEM_ALERT',
        title: template.title(ctx),
        message: template.message(ctx),
        data: {
          idempotencyKey,
          eventKind: input.eventKind,
          projectId: input.projectId,
          participantId: input.participantId,
          consequence: template.consequence(ctx),
          action: template.action,
          actionUrl: template.actionPath(ctx),
        },
        read: false,
        email_sent: false,
      },
    });
  } catch (err) {
    // Notifications must never block the main workflow
    console.error('[dispatchCommercialNotification] Failed to create notification:', {
      eventKind: input.eventKind,
      projectId: input.projectId,
      participantId: input.participantId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Dispatch multiple commercial notifications in sequence.
 * Errors from individual dispatches are isolated — one failure does not prevent others.
 */
export async function dispatchCommercialNotifications(
  inputs: DispatchCommercialNotificationInput[]
): Promise<void> {
  for (const input of inputs) {
    await dispatchCommercialNotification(input);
  }
}
