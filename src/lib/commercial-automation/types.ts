/**
 * Commercial Automation — canonical domain types.
 *
 * Deterministic rule engine that orchestrates commercial operations.
 * Automation consumes the commercial model — it never owns it.
 *
 * Commercial Agreements define intent.
 * Commercial Workflows coordinate execution.
 * Commercial Forecasting predicts future state.
 * Commercial Automation executes operational work.
 */

import type { CommercialEventKind } from '@/lib/commercial/commercial-event-bus';
import type { CommercialForecastingResult } from '@/lib/commercial-forecasting/types';
import type { ParticipantWorkflowBundle } from '@/lib/commercial/workflows/types';
import type { CommercialForecastingInput } from '@/lib/commercial-forecasting/types';

/* ─── Triggers ─────────────────────────────────────────────────────────────── */

export enum CommercialTriggerKind {
  AgreementCreated = 'agreement_created',
  AgreementApproved = 'agreement_approved',
  ParticipantAdded = 'participant_added',
  ParticipantApproved = 'participant_approved',
  ParticipantWorkspaceCreated = 'participant_workspace_created',
  PayoutDetailsSubmitted = 'payout_details_submitted',
  InvoiceCreated = 'invoice_created',
  InvoiceExported = 'invoice_exported',
  InvoiceOverdue = 'invoice_overdue',
  PaymentReceived = 'payment_received',
  PartialPaymentReceived = 'partial_payment_received',
  SettlementReady = 'settlement_ready',
  SettlementReleased = 'settlement_released',
  CommercialTimingApproaching = 'commercial_timing_approaching',
  ServicePeriodStarted = 'service_period_started',
  ServicePeriodEnded = 'service_period_ended',
  ForecastRiskRaised = 'forecast_risk_raised',
  Manual = 'manual',
}

export const COMMERCIAL_TRIGGER_LABELS: Record<CommercialTriggerKind, string> = {
  [CommercialTriggerKind.AgreementCreated]: 'Agreement Created',
  [CommercialTriggerKind.AgreementApproved]: 'Agreement Approved',
  [CommercialTriggerKind.ParticipantAdded]: 'Participant Added',
  [CommercialTriggerKind.ParticipantApproved]: 'Participant Approved',
  [CommercialTriggerKind.ParticipantWorkspaceCreated]: 'Participant Workspace Created',
  [CommercialTriggerKind.PayoutDetailsSubmitted]: 'Payout Details Submitted',
  [CommercialTriggerKind.InvoiceCreated]: 'Invoice Created',
  [CommercialTriggerKind.InvoiceExported]: 'Invoice Exported',
  [CommercialTriggerKind.InvoiceOverdue]: 'Invoice Overdue',
  [CommercialTriggerKind.PaymentReceived]: 'Payment Received',
  [CommercialTriggerKind.PartialPaymentReceived]: 'Partial Payment Received',
  [CommercialTriggerKind.SettlementReady]: 'Settlement Ready',
  [CommercialTriggerKind.SettlementReleased]: 'Settlement Released',
  [CommercialTriggerKind.CommercialTimingApproaching]: 'Commercial Timing Approaching',
  [CommercialTriggerKind.ServicePeriodStarted]: 'Service Period Started',
  [CommercialTriggerKind.ServicePeriodEnded]: 'Service Period Ended',
  [CommercialTriggerKind.ForecastRiskRaised]: 'Forecast Risk Raised',
  [CommercialTriggerKind.Manual]: 'Manual Trigger',
};

/** Maps commercial event bus kinds to automation triggers. */
export const COMMERCIAL_EVENT_TO_TRIGGER: Partial<Record<CommercialEventKind, CommercialTriggerKind>> = {
  agreement_negotiated: CommercialTriggerKind.AgreementCreated,
  agreement_approved: CommercialTriggerKind.AgreementApproved,
  invoice_requested: CommercialTriggerKind.InvoiceCreated,
  invoice_exported: CommercialTriggerKind.InvoiceExported,
  revenue_confirmed: CommercialTriggerKind.PaymentReceived,
  settlement_ready: CommercialTriggerKind.SettlementReady,
  payment_released: CommercialTriggerKind.SettlementReleased,
  supplier_onboarding_started: CommercialTriggerKind.ParticipantWorkspaceCreated,
  supplier_details_submitted: CommercialTriggerKind.PayoutDetailsSubmitted,
};

export type CommercialTrigger = {
  kind: CommercialTriggerKind;
  label: string;
  occurredAt: string;
  projectId: string;
  dealId?: string | null;
  participantId?: string | null;
  paymentLinkId?: string | null;
  metadata?: Record<string, unknown>;
};

/* ─── Conditions ───────────────────────────────────────────────────────────── */

export enum CommercialConditionKind {
  AgreementApproved = 'agreement_approved',
  ParticipantApproved = 'participant_approved',
  PayoutDetailsMissing = 'payout_details_missing',
  InvoiceOutstanding = 'invoice_outstanding',
  PaymentLate = 'payment_late',
  SettlementEligible = 'settlement_eligible',
  SettlementComplete = 'settlement_complete',
  CommercialTimingWithinDays = 'commercial_timing_within_days',
  ForecastConfidenceAboveThreshold = 'forecast_confidence_above_threshold',
  OutstandingObligations = 'outstanding_obligations',
  OutstandingApprovals = 'outstanding_approvals',
  AccountingSyncComplete = 'accounting_sync_complete',
  AllParticipantsApproved = 'all_participants_approved',
}

export type CommercialCondition = {
  kind: CommercialConditionKind;
  /** Optional parameters — e.g. days for timing, threshold for confidence. */
  params?: Record<string, unknown>;
};

export type ConditionEvaluationResult = {
  kind: CommercialConditionKind;
  satisfied: boolean;
  reason: string;
};

/* ─── Actions ──────────────────────────────────────────────────────────────── */

export enum CommercialActionKind {
  GenerateInvoice = 'generate_invoice',
  ExportInvoice = 'export_invoice',
  SendReminder = 'send_reminder',
  NotifyParticipant = 'notify_participant',
  NotifyMerchant = 'notify_merchant',
  NotifyBookkeeper = 'notify_bookkeeper',
  RequestPayoutDetails = 'request_payout_details',
  OpenSettlement = 'open_settlement',
  ReleaseSettlement = 'release_settlement',
  QueueAccountingExport = 'queue_accounting_export',
  RefreshForecast = 'refresh_forecast',
  RefreshParticipantWorkspace = 'refresh_participant_workspace',
  CreateActivityEvent = 'create_activity_event',
  CreateAuditEntry = 'create_audit_entry',
  UpdateWorkflowState = 'update_workflow_state',
  GenerateTask = 'generate_task',
  InviteParticipantWorkspace = 'invite_participant_workspace',
}

export const COMMERCIAL_ACTION_LABELS: Record<CommercialActionKind, string> = {
  [CommercialActionKind.GenerateInvoice]: 'Generate Invoice',
  [CommercialActionKind.ExportInvoice]: 'Export Invoice',
  [CommercialActionKind.SendReminder]: 'Send Reminder',
  [CommercialActionKind.NotifyParticipant]: 'Notify Participant',
  [CommercialActionKind.NotifyMerchant]: 'Notify Merchant',
  [CommercialActionKind.NotifyBookkeeper]: 'Notify Bookkeeper',
  [CommercialActionKind.RequestPayoutDetails]: 'Request Payout Details',
  [CommercialActionKind.OpenSettlement]: 'Open Settlement',
  [CommercialActionKind.ReleaseSettlement]: 'Release Settlement',
  [CommercialActionKind.QueueAccountingExport]: 'Queue Accounting Export',
  [CommercialActionKind.RefreshForecast]: 'Refresh Forecast',
  [CommercialActionKind.RefreshParticipantWorkspace]: 'Refresh Participant Workspace',
  [CommercialActionKind.CreateActivityEvent]: 'Create Activity Event',
  [CommercialActionKind.CreateAuditEntry]: 'Create Audit Entry',
  [CommercialActionKind.UpdateWorkflowState]: 'Update Workflow State',
  [CommercialActionKind.GenerateTask]: 'Generate Task',
  [CommercialActionKind.InviteParticipantWorkspace]: 'Invite Participant Workspace',
};

export type CommercialAction = {
  kind: CommercialActionKind;
  params?: Record<string, unknown>;
};

export type ActionExecutionResult = {
  kind: CommercialActionKind;
  status: 'planned' | 'executed' | 'skipped' | 'failed';
  label: string;
  message: string;
  activityEventId?: string | null;
  notificationId?: string | null;
  error?: string | null;
};

/* ─── Rules ────────────────────────────────────────────────────────────────── */

export type CommercialRule = {
  id: string;
  name: string;
  description: string;
  trigger: CommercialTriggerKind;
  conditions: CommercialCondition[];
  actions: CommercialAction[];
  enabled: boolean;
  /** Policy this rule belongs to — null for global rules. */
  policyId?: string | null;
  /** Condition combination: all must pass, or any. */
  conditionMode?: 'all' | 'any';
};

/* ─── Automation Policies ──────────────────────────────────────────────────── */

export type AutomationPolicyId =
  | 'hospitality'
  | 'events'
  | 'construction'
  | 'professional_services'
  | 'default';

export type AutomationPolicy = {
  id: AutomationPolicyId;
  name: string;
  description: string;
  /** Rule IDs enabled for this policy. */
  ruleIds: string[];
  enabled: boolean;
};

/* ─── Notifications ──────────────────────────────────────────────────────── */

export enum AutomationNotificationKind {
  AgreementReminder = 'agreement_reminder',
  PayoutReminder = 'payout_reminder',
  SettlementReleased = 'settlement_released',
  PaymentReceived = 'payment_received',
  InvoiceOverdue = 'invoice_overdue',
  WorkspaceInvitation = 'workspace_invitation',
  ForecastAlert = 'forecast_alert',
  PaymentReminder = 'payment_reminder',
  InvoiceExported = 'invoice_exported',
}

export type AutomationNotificationEvent = {
  id: string;
  kind: AutomationNotificationKind;
  title: string;
  message: string;
  recipientRole: 'merchant' | 'participant' | 'bookkeeper' | 'operator';
  projectId: string;
  participantId?: string | null;
  channel: 'in_app' | 'email' | 'sms' | 'push' | 'slack' | 'webhook';
  createdAt: string;
  dedupeKey: string;
};

/* ─── Activity & Audit ─────────────────────────────────────────────────────── */

export type AutomationActivityEvent = {
  id: string;
  label: string;
  description: string;
  projectId: string;
  participantId?: string | null;
  ruleId: string;
  actionKind: CommercialActionKind;
  occurredAt: string;
  icon: 'success' | 'info' | 'warning' | 'automation';
};

export type AutomationAuditEntry = {
  id: string;
  ruleId: string;
  ruleName: string;
  trigger: CommercialTriggerKind;
  conditions: ConditionEvaluationResult[];
  actions: ActionExecutionResult[];
  occurredAt: string;
  durationMs: number;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  error?: string | null;
  retryCount?: number;
};

/* ─── Execution ────────────────────────────────────────────────────────────── */

export type CommercialExecution = {
  executionId: string;
  ruleId: string;
  ruleName: string;
  trigger: CommercialTrigger;
  conditions: ConditionEvaluationResult[];
  actions: ActionExecutionResult[];
  notifications: AutomationNotificationEvent[];
  activityEvents: AutomationActivityEvent[];
  auditEntry: AutomationAuditEntry;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  startedAt: string;
  completedAt: string;
  durationMs: number;
};

export type CommercialAutomationResult = {
  trigger: CommercialTrigger;
  executions: CommercialExecution[];
  notifications: AutomationNotificationEvent[];
  activityEvents: AutomationActivityEvent[];
  auditEntries: AutomationAuditEntry[];
  rulesEvaluated: number;
  rulesMatched: number;
  rulesExecuted: number;
};

/* ─── Input context ────────────────────────────────────────────────────────── */

export type ParticipantAutomationContext = {
  participantId: string;
  participantName: string;
  agreementApproved: boolean;
  payoutDetailsSubmitted: boolean;
  workspaceCreated: boolean;
  workflow?: ParticipantWorkflowBundle | null;
};

export type InvoiceAutomationContext = {
  paymentLinkId: string;
  invoiceAmount: number;
  amountPaid: number;
  exported: boolean;
  outstanding: boolean;
  overdue: boolean;
  daysOverdue?: number;
};

export type CommercialAutomationInput = {
  projectId: string;
  dealId?: string | null;
  agreementId?: string | null;
  currency: string;
  /** Active automation policy for this project. */
  policyId?: AutomationPolicyId;
  /** Trigger that initiated evaluation. */
  trigger: CommercialTrigger;
  participants?: ParticipantAutomationContext[];
  invoices?: InvoiceAutomationContext[];
  forecastingInput?: CommercialForecastingInput | null;
  forecast?: CommercialForecastingResult | null;
  /** Custom rules override — defaults to policy rules when unset. */
  rules?: CommercialRule[];
  asOfDate?: string;
  /** Previously executed rule IDs for deduplication within a window. */
  recentExecutions?: string[];
};

/** Scheduled automation job descriptor. */
export type ScheduledAutomationJob = {
  id: string;
  ruleId: string;
  trigger: CommercialTriggerKind;
  scheduledFor: string;
  description: string;
  status: 'pending' | 'executed' | 'cancelled';
};
