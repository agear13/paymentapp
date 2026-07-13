/**
 * Shared types for the Participant Commercial Workspace.
 * Used by portal derivation, API responses, and reusable commercial UI components.
 */

export type PortalAgreementStatus =
  | 'approved'
  | 'awaiting_acceptance'
  | 'not_sent'
  | 'draft';

export type CommercialStepStatus = 'complete' | 'active' | 'waiting' | 'pending';

export type CommercialLifecycleStep = {
  id: string;
  label: string;
  status: CommercialStepStatus;
};

export type CommercialMetricField =
  | 'current_earnings'
  | 'pending_settlement'
  | 'paid_to_date'
  | 'revenue_generated'
  | 'attributed_sales'
  | 'orders'
  | 'conversions'
  | 'commission_earned'
  | 'average_order_value'
  | 'referral_link'
  | 'promo_code';

export type CommercialMetricValue = {
  field: CommercialMetricField;
  label: string;
  value: string;
  emptyMessage?: string;
};

export type ParticipantCommercialPerformance = {
  /** Which metric fields are applicable for this participant's earnings model. */
  supportedFields: CommercialMetricField[];
  metrics: CommercialMetricValue[];
  hasRecordedActivity: boolean;
};

export type SettlementExplanation = {
  statusLabel: string;
  blockingReason: string | null;
  nextStep: string;
  isBlocked: boolean;
};

export type PortalObligationSnapshot = {
  id: string;
  status: string;
  amountOwed: number;
  currency: string;
  dueDate: string | null;
  explanation: string;
};

export type PortalAttributionActivity = {
  attributedSales: number;
  orders: number;
  commissionEarned: number;
  currency: string;
};

export type ParticipantPortalContext = {
  obligations: PortalObligationSnapshot[];
  attributionActivity: PortalAttributionActivity | null;
  syncedAt: string;
};

export type PortalCommercialSection =
  | {
      kind: 'fixed_fee';
      amount: string;
      dueDate: string | null;
      dueDateLabel: string | null;
    }
  | {
      kind: 'revenue_share';
      percentage: string;
      revenueSource: string;
      settlement: string;
    }
  | {
      kind: 'commission';
      percentage: string;
      attributionType: 'promo_code' | 'referral_link' | 'none';
      attributionValue: string | null;
    }
  | {
      kind: 'milestone';
      label: string;
      amount: string | null;
      trigger: string | null;
    }
  | {
      kind: 'custom';
      label: string;
      detail: string;
    };

export type PortalAgreementSection = {
  deliverables: string[];
  commercialObligations: string[];
  paymentEvents: string[];
  settlementRules: string[];
  conditionalPayments: string[];
};

export type PortalPaymentTimelineItem = {
  id: string;
  dateLabel: string;
  title: string;
  status: CommercialStepStatus;
  detail?: string;
};

export type CommercialWorkspaceSection = 'overview' | 'terms' | 'payments' | 'activity';

import type { ParticipantCommercialState } from '@/lib/participant-portal/participant-workspace-state';

export type WorkflowStatusLabels = {
  commercial: string;
  settlement: string;
  accounting: string;
};

export type ParticipantCommercialWorkspaceModel = {
  participantName: string;
  participantRole: string;
  participantSubtitle: string;
  projectName: string;
  agreementStatus: PortalAgreementStatus;
  agreementStatusLabel: string;
  lifecycleSteps: CommercialLifecycleStep[];
  commercialSections: PortalCommercialSection[];
  agreement: PortalAgreementSection;
  performance: ParticipantCommercialPerformance;
  settlement: SettlementExplanation;
  paymentTimeline: PortalPaymentTimelineItem[];
  intelligence: string | null;
  currency: string;
  syncedAt: string;
  hasEarningsConfiguration: boolean;
  commercialState: ParticipantCommercialState;
  workflowStatus: WorkflowStatusLabels;
};
