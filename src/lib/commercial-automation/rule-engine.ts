/**
 * Rule Engine — combine triggers, conditions, and actions.
 *
 * Rules are configuration-driven. Default rules catalog provided;
 * policies enable subsets per business type.
 */

import {
  CommercialActionKind,
  CommercialConditionKind,
  CommercialTriggerKind,
  type AutomationPolicy,
  type AutomationPolicyId,
  type CommercialRule,
} from '@/lib/commercial-automation/types';

/** Default rules catalog — one engine, configurable policies. */
export const DEFAULT_COMMERCIAL_RULES: CommercialRule[] = [
  {
    id: 'rule:agreement_approved_request_payout',
    name: 'Request Payout Details on Agreement Approval',
    description: 'When agreement is approved and payout details are missing, send workspace reminder.',
    trigger: CommercialTriggerKind.AgreementApproved,
    conditions: [{ kind: CommercialConditionKind.PayoutDetailsMissing }],
    actions: [
      { kind: CommercialActionKind.InviteParticipantWorkspace },
      { kind: CommercialActionKind.RequestPayoutDetails },
      { kind: CommercialActionKind.CreateActivityEvent },
    ],
    enabled: true,
    policyId: null,
  },
  {
    id: 'rule:invoice_created_export',
    name: 'Export Invoice on Creation',
    description: 'When invoice is created, queue export to accounting.',
    trigger: CommercialTriggerKind.InvoiceCreated,
    conditions: [],
    actions: [
      { kind: CommercialActionKind.ExportInvoice },
      { kind: CommercialActionKind.QueueAccountingExport },
      { kind: CommercialActionKind.CreateActivityEvent },
    ],
    enabled: true,
    policyId: null,
  },
  {
    id: 'rule:invoice_overdue_reminder',
    name: 'Payment Reminder for Overdue Invoice',
    description: 'When invoice is outstanding 7+ days without payment, send reminder.',
    trigger: CommercialTriggerKind.InvoiceOverdue,
    conditions: [
      { kind: CommercialConditionKind.InvoiceOutstanding },
      { kind: CommercialConditionKind.PaymentLate, params: { days: 7 } },
    ],
    actions: [
      { kind: CommercialActionKind.SendReminder },
      { kind: CommercialActionKind.NotifyMerchant },
      { kind: CommercialActionKind.CreateActivityEvent },
    ],
    enabled: true,
    policyId: null,
  },
  {
    id: 'rule:settlement_ready_release',
    name: 'Release Settlement When Eligible',
    description: 'When settlement is eligible and all participants approved, release settlement.',
    trigger: CommercialTriggerKind.SettlementReady,
    conditions: [
      { kind: CommercialConditionKind.SettlementEligible },
      { kind: CommercialConditionKind.AllParticipantsApproved },
    ],
    actions: [
      { kind: CommercialActionKind.OpenSettlement },
      { kind: CommercialActionKind.ReleaseSettlement },
      { kind: CommercialActionKind.NotifyParticipant },
      { kind: CommercialActionKind.QueueAccountingExport },
      { kind: CommercialActionKind.CreateActivityEvent },
    ],
    enabled: true,
    policyId: null,
    conditionMode: 'all',
  },
  {
    id: 'rule:payment_received_refresh',
    name: 'Refresh Forecast on Payment',
    description: 'When payment is received, refresh commercial forecast.',
    trigger: CommercialTriggerKind.PaymentReceived,
    conditions: [],
    actions: [
      { kind: CommercialActionKind.RefreshForecast },
      { kind: CommercialActionKind.CreateActivityEvent },
    ],
    enabled: true,
    policyId: null,
  },
  {
    id: 'rule:forecast_risk_alert',
    name: 'Forecast Risk Alert',
    description: 'When forecast risk is raised, notify merchant and refresh forecast.',
    trigger: CommercialTriggerKind.ForecastRiskRaised,
    conditions: [{ kind: CommercialConditionKind.ForecastConfidenceAboveThreshold, params: { threshold: 'tentative' } }],
    actions: [
      { kind: CommercialActionKind.RefreshForecast },
      { kind: CommercialActionKind.NotifyMerchant },
      { kind: CommercialActionKind.CreateActivityEvent },
    ],
    enabled: true,
    policyId: null,
  },
  {
    id: 'rule:timing_approaching_reminder',
    name: 'Commercial Timing Approaching',
    description: 'When commercial timing is within 7 days, generate tasks and refresh forecast.',
    trigger: CommercialTriggerKind.CommercialTimingApproaching,
    conditions: [{ kind: CommercialConditionKind.CommercialTimingWithinDays, params: { days: 7 } }],
    actions: [
      { kind: CommercialActionKind.GenerateTask },
      { kind: CommercialActionKind.RefreshForecast },
      { kind: CommercialActionKind.CreateActivityEvent },
    ],
    enabled: true,
    policyId: null,
  },
  {
    id: 'rule:agreement_created_setup',
    name: 'Agreement Created Setup',
    description: 'When agreement is created, refresh forecast and create activity.',
    trigger: CommercialTriggerKind.AgreementCreated,
    conditions: [],
    actions: [
      { kind: CommercialActionKind.RefreshForecast },
      { kind: CommercialActionKind.CreateActivityEvent },
    ],
    enabled: true,
    policyId: null,
  },
];

/** Automation Policies — collections of rules per business type. */
export const AUTOMATION_POLICIES: AutomationPolicy[] = [
  {
    id: 'default',
    name: 'Default Policy',
    description: 'Standard commercial automation for all business types.',
    ruleIds: DEFAULT_COMMERCIAL_RULES.map((r) => r.id),
    enabled: true,
  },
  {
    id: 'hospitality',
    name: 'Hospitality Policy',
    description: 'Automation for hospitality — fast settlement, payout reminders.',
    ruleIds: [
      'rule:agreement_approved_request_payout',
      'rule:invoice_overdue_reminder',
      'rule:settlement_ready_release',
      'rule:payment_received_refresh',
      'rule:forecast_risk_alert',
    ],
    enabled: true,
  },
  {
    id: 'events',
    name: 'Events Policy',
    description: 'Automation for events — timing-driven, service period tracking.',
    ruleIds: [
      'rule:agreement_created_setup',
      'rule:invoice_created_export',
      'rule:timing_approaching_reminder',
      'rule:payment_received_refresh',
      'rule:settlement_ready_release',
    ],
    enabled: true,
  },
  {
    id: 'construction',
    name: 'Construction Policy',
    description: 'Automation for construction — milestone payments, approval tracking.',
    ruleIds: [
      'rule:agreement_approved_request_payout',
      'rule:invoice_created_export',
      'rule:invoice_overdue_reminder',
      'rule:settlement_ready_release',
    ],
    enabled: true,
  },
  {
    id: 'professional_services',
    name: 'Professional Services Policy',
    description: 'Automation for professional services — invoice export, payment reminders.',
    ruleIds: [
      'rule:invoice_created_export',
      'rule:invoice_overdue_reminder',
      'rule:payment_received_refresh',
      'rule:agreement_approved_request_payout',
    ],
    enabled: true,
  },
];

/** Resolve rules for a policy. */
export function resolveRulesForPolicy(
  policyId: AutomationPolicyId = 'default',
  customRules?: CommercialRule[]
): CommercialRule[] {
  if (customRules) return customRules.filter((r) => r.enabled);

  const policy = AUTOMATION_POLICIES.find((p) => p.id === policyId && p.enabled);
  if (!policy) {
    return DEFAULT_COMMERCIAL_RULES.filter((r) => r.enabled);
  }

  return DEFAULT_COMMERCIAL_RULES.filter(
    (r) => r.enabled && policy.ruleIds.includes(r.id)
  );
}

/** Find rules matching a trigger. */
export function findRulesForTrigger(
  trigger: CommercialTriggerKind,
  rules: CommercialRule[]
): CommercialRule[] {
  return rules.filter((r) => r.enabled && r.trigger === trigger);
}

/** Get policy by ID. */
export function getAutomationPolicy(
  policyId: AutomationPolicyId
): AutomationPolicy | undefined {
  return AUTOMATION_POLICIES.find((p) => p.id === policyId);
}

/** List all policies. */
export function listAutomationPolicies(): AutomationPolicy[] {
  return AUTOMATION_POLICIES.filter((p) => p.enabled);
}

/** Register a custom rule (returns new rule — caller manages persistence). */
export function createCommercialRule(
  partial: Omit<CommercialRule, 'id' | 'enabled'> & { id?: string; enabled?: boolean }
): CommercialRule {
  return {
    id: partial.id ?? `rule:custom:${Date.now()}`,
    enabled: partial.enabled ?? true,
    ...partial,
  };
}
