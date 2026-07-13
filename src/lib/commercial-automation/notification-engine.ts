/**
 * Notification Engine — create notification events, never send directly.
 *
 * Future adapters (Email, SMS, Slack, Webhook) consume notification events.
 */

import {
  AutomationNotificationKind,
  type AutomationNotificationEvent,
  type CommercialAutomationInput,
  type CommercialExecution,
} from '@/lib/commercial-automation/types';

export type NotificationAdapterKind =
  | 'email'
  | 'sms'
  | 'whatsapp'
  | 'push'
  | 'slack'
  | 'webhook'
  | 'in_app';

export type NotificationAdapterRegistration = {
  kind: NotificationAdapterKind;
  label: string;
  /** Whether adapter is implemented — extension point only. */
  implemented: boolean;
};

const NOTIFICATION_ADAPTERS: NotificationAdapterRegistration[] = [
  { kind: 'in_app', label: 'In-App', implemented: true },
  { kind: 'email', label: 'Email (Resend)', implemented: false },
  { kind: 'sms', label: 'SMS (Twilio)', implemented: false },
  { kind: 'whatsapp', label: 'WhatsApp', implemented: false },
  { kind: 'push', label: 'Push', implemented: false },
  { kind: 'slack', label: 'Slack', implemented: false },
  { kind: 'webhook', label: 'Webhook (Zapier)', implemented: false },
];

/** List registered notification adapters. */
export function listNotificationAdapters(): NotificationAdapterRegistration[] {
  return NOTIFICATION_ADAPTERS;
}

/** Deduplicate notifications by dedupeKey. */
export function deduplicateNotifications(
  notifications: AutomationNotificationEvent[]
): AutomationNotificationEvent[] {
  const seen = new Set<string>();
  return notifications.filter((n) => {
    if (seen.has(n.dedupeKey)) return false;
    seen.add(n.dedupeKey);
    return true;
  });
}

/** Collect notifications from executions. */
export function collectNotificationsFromExecutions(
  executions: CommercialExecution[]
): AutomationNotificationEvent[] {
  const all = executions.flatMap((e) => e.notifications);
  return deduplicateNotifications(all);
}

/** Build a standalone notification event. */
export function buildAutomationNotification(
  kind: AutomationNotificationKind,
  input: CommercialAutomationInput,
  overrides: Partial<AutomationNotificationEvent> = {}
): AutomationNotificationEvent {
  const titles: Record<AutomationNotificationKind, string> = {
    [AutomationNotificationKind.AgreementReminder]: 'Agreement reminder',
    [AutomationNotificationKind.PayoutReminder]: 'Payout details reminder',
    [AutomationNotificationKind.SettlementReleased]: 'Settlement released',
    [AutomationNotificationKind.PaymentReceived]: 'Payment received',
    [AutomationNotificationKind.InvoiceOverdue]: 'Invoice overdue',
    [AutomationNotificationKind.WorkspaceInvitation]: 'Workspace invitation',
    [AutomationNotificationKind.ForecastAlert]: 'Forecast alert',
    [AutomationNotificationKind.PaymentReminder]: 'Payment reminder',
    [AutomationNotificationKind.InvoiceExported]: 'Invoice exported',
  };

  return {
    id: `notif:${kind}:${input.projectId}:${Date.now()}`,
    kind,
    title: titles[kind],
    message: overrides.message ?? `Automation notification: ${titles[kind]}`,
    recipientRole: overrides.recipientRole ?? 'operator',
    projectId: input.projectId,
    participantId: input.trigger.participantId ?? null,
    channel: 'in_app',
    createdAt: input.trigger.occurredAt,
    dedupeKey: `${kind}:${input.projectId}`,
    ...overrides,
  };
}
