/**
 * Action Engine — plan and execute reusable automation actions.
 *
 * Actions are composable. Side effects are described, not performed —
 * callers handle persistence and dispatch.
 */

import {
  COMMERCIAL_ACTION_LABELS,
  CommercialActionKind,
  AutomationNotificationKind,
  type ActionExecutionResult,
  type AutomationActivityEvent,
  type AutomationNotificationEvent,
  type CommercialAction,
  type CommercialAutomationInput,
  type CommercialRule,
} from '@/lib/commercial-automation/types';

export type ActionPlan = {
  action: CommercialAction;
  result: ActionExecutionResult;
  notification?: AutomationNotificationEvent | null;
  activityEvent?: AutomationActivityEvent | null;
};

function actionId(ruleId: string, kind: CommercialActionKind, index: number): string {
  return `${ruleId}:${kind}:${index}`;
}

function buildNotificationForAction(
  kind: CommercialActionKind,
  input: CommercialAutomationInput,
  rule: CommercialRule,
  index: number
): AutomationNotificationEvent | null {
  const base = {
    projectId: input.projectId,
    participantId: input.trigger.participantId ?? null,
    createdAt: input.trigger.occurredAt,
    channel: 'in_app' as const,
  };

  switch (kind) {
    case CommercialActionKind.SendReminder:
      return {
        ...base,
        id: `notif:reminder:${input.projectId}:${index}`,
        kind: AutomationNotificationKind.PaymentReminder,
        title: 'Payment reminder sent',
        message: 'A payment reminder was sent for an outstanding invoice.',
        recipientRole: 'merchant',
        dedupeKey: `payment_reminder:${input.projectId}`,
      };

    case CommercialActionKind.RequestPayoutDetails:
      return {
        ...base,
        id: `notif:payout:${input.projectId}:${index}`,
        kind: AutomationNotificationKind.PayoutReminder,
        title: 'Payout details requested',
        message: 'Participant workspace reminder sent to collect payout details.',
        recipientRole: 'participant',
        dedupeKey: `payout_reminder:${input.projectId}:${input.trigger.participantId ?? 'all'}`,
      };

    case CommercialActionKind.NotifyParticipant:
      return {
        ...base,
        id: `notif:participant:${input.projectId}:${index}`,
        kind: AutomationNotificationKind.WorkspaceInvitation,
        title: 'Participant notified',
        message: rule.description,
        recipientRole: 'participant',
        dedupeKey: `notify_participant:${input.projectId}:${input.trigger.participantId}`,
      };

    case CommercialActionKind.ReleaseSettlement:
      return {
        ...base,
        id: `notif:settlement:${input.projectId}:${index}`,
        kind: AutomationNotificationKind.SettlementReleased,
        title: 'Settlement released',
        message: 'Settlement has been released to participants.',
        recipientRole: 'participant',
        dedupeKey: `settlement_released:${input.projectId}`,
      };

    case CommercialActionKind.RefreshForecast:
      return {
        ...base,
        id: `notif:forecast:${input.projectId}:${index}`,
        kind: AutomationNotificationKind.ForecastAlert,
        title: 'Forecast updated',
        message: 'Commercial forecast refreshed after automation.',
        recipientRole: 'operator',
        dedupeKey: `forecast_refresh:${input.projectId}`,
      };

    default:
      return null;
  }
}

function buildActivityForAction(
  kind: CommercialActionKind,
  input: CommercialAutomationInput,
  rule: CommercialRule,
  index: number
): AutomationActivityEvent {
  const labels: Partial<Record<CommercialActionKind, string>> = {
    [CommercialActionKind.SendReminder]: 'Payment Reminder Sent',
    [CommercialActionKind.ExportInvoice]: 'Invoice Exported',
    [CommercialActionKind.ReleaseSettlement]: 'Settlement Released',
    [CommercialActionKind.RefreshForecast]: 'Forecast Updated',
    [CommercialActionKind.QueueAccountingExport]: 'Accounting Sync Queued',
    [CommercialActionKind.InviteParticipantWorkspace]: 'Workspace Invitation Sent',
    [CommercialActionKind.RequestPayoutDetails]: 'Payout Details Requested',
    [CommercialActionKind.GenerateInvoice]: 'Invoice Generated',
  };

  return {
    id: actionId(rule.id, kind, index),
    label: labels[kind] ?? COMMERCIAL_ACTION_LABELS[kind],
    description: rule.description,
    projectId: input.projectId,
    participantId: input.trigger.participantId ?? null,
    ruleId: rule.id,
    actionKind: kind,
    occurredAt: input.trigger.occurredAt,
    icon: 'automation',
  };
}

/** Plan a single action execution. */
export function planAction(
  action: CommercialAction,
  input: CommercialAutomationInput,
  rule: CommercialRule,
  index: number
): ActionPlan {
  const label = COMMERCIAL_ACTION_LABELS[action.kind];

  const result: ActionExecutionResult = {
    kind: action.kind,
    status: 'planned',
    label,
    message: `${label} planned by rule "${rule.name}"`,
  };

  const createsActivity = [
    CommercialActionKind.CreateActivityEvent,
    CommercialActionKind.SendReminder,
    CommercialActionKind.ExportInvoice,
    CommercialActionKind.ReleaseSettlement,
    CommercialActionKind.RefreshForecast,
    CommercialActionKind.QueueAccountingExport,
    CommercialActionKind.InviteParticipantWorkspace,
    CommercialActionKind.RequestPayoutDetails,
    CommercialActionKind.GenerateInvoice,
  ].includes(action.kind);

  const createsNotification = [
    CommercialActionKind.SendReminder,
    CommercialActionKind.NotifyParticipant,
    CommercialActionKind.NotifyMerchant,
    CommercialActionKind.NotifyBookkeeper,
    CommercialActionKind.RequestPayoutDetails,
    CommercialActionKind.ReleaseSettlement,
    CommercialActionKind.RefreshForecast,
  ].includes(action.kind);

  const activityEvent = createsActivity
    ? buildActivityForAction(action.kind, input, rule, index)
    : action.kind === CommercialActionKind.CreateActivityEvent
      ? buildActivityForAction(CommercialActionKind.CreateActivityEvent, input, rule, index)
      : null;

  const notification = createsNotification
    ? buildNotificationForAction(action.kind, input, rule, index)
    : null;

  if (activityEvent) {
    result.activityEventId = activityEvent.id;
    result.status = 'executed';
  }

  if (notification) {
    result.notificationId = notification.id;
    result.status = 'executed';
  }

  return { action, result, notification, activityEvent };
}

/** Plan all actions for a rule. */
export function planActions(
  rule: CommercialRule,
  input: CommercialAutomationInput
): ActionPlan[] {
  return rule.actions.map((action, index) => planAction(action, input, rule, index));
}
