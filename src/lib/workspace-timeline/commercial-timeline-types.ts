/**
 * Canonical account-level commercial timeline.
 *
 * This is a view-model over existing domain records — not a second event store.
 * Every event must have a real occurrence timestamp from the source record.
 */

export const COMMERCIAL_TIMELINE_CATEGORIES = [
  'payment',
  'agreement',
  'settlement',
  'referral',
  'accounting',
  'connected_system',
  'system',
] as const;

export type CommercialTimelineCategory = (typeof COMMERCIAL_TIMELINE_CATEGORIES)[number];

export const COMMERCIAL_TIMELINE_FILTERS = [
  'all',
  'payment',
  'agreement',
  'settlement',
  'referral',
  'accounting',
  'system',
] as const;

export type CommercialTimelineFilter = (typeof COMMERCIAL_TIMELINE_FILTERS)[number];

export const COMMERCIAL_TIMELINE_IMPORTANCE = ['primary', 'supporting', 'system'] as const;

/** Presentation-only rank. Does not change chronology or underlying records. */
export type CommercialTimelineImportance = (typeof COMMERCIAL_TIMELINE_IMPORTANCE)[number];

export type CommercialTimelineMoney = {
  amount: number;
  currency?: string;
};

export const TIMELINE_SOURCE_LIMIT = 250;

export type CommercialTimelineAccountStatus = 'ok' | 'no_organization';

export type CommercialTimelineCompleteness = {
  complete: boolean;
  truncatedSources: string[];
  sourceLimit: number;
};

export const EMPTY_TIMELINE_COMPLETENESS: CommercialTimelineCompleteness = {
  complete: true,
  truncatedSources: [],
  sourceLimit: TIMELINE_SOURCE_LIMIT,
};

export type CommercialTimelineEvent = {
  id: string;
  occurredAt: string;
  category: CommercialTimelineCategory;
  action: string;
  title: string;
  description?: string;
  importance: CommercialTimelineImportance;
  amount?: CommercialTimelineMoney;
  currency?: string;
  sourceName?: string;
  relationshipName?: string;
  participantName?: string;
  href?: string;
  entityType: string;
  entityId: string;
  paymentLinkId?: string;
  paymentEventId?: string;
  dealId?: string;
  participantId?: string;
  agreementId?: string;
  commissionObligationId?: string;
  obligationId?: string;
  payoutId?: string;
  payoutBatchId?: string;
};

export type TimelineParticipantOption = {
  id: string;
  name: string;
};

export type CommercialTimelineGroup = {
  key: string;
  label: string;
  events: CommercialTimelineEvent[];
};

export type PaymentLinkTimelineRow = {
  id: string;
  organizationId: string;
  shortCode: string;
  status: string;
  amount: number;
  currency: string;
  description: string;
  invoiceReference: string | null;
  xeroInvoiceNumber: string | null;
  customerName: string | null;
  paymentMethod: string | null;
  referralLinkId: string | null;
  createdAt: string;
  pilotDealId?: string | null;
};

export type PaymentEventTimelineRow = {
  id: string;
  organizationId: string | null;
  paymentLinkId: string | null;
  eventType: string;
  paymentMethod: string | null;
  amount: number | null;
  currency: string | null;
  receivedAt: string | null;
  createdAt: string;
};

export type XeroSyncTimelineRow = {
  id: string;
  paymentLinkId: string;
  syncType: string;
  status: string;
  createdAt: string;
  xeroInvoiceId: string | null;
  xeroPaymentId: string | null;
  errorMessage: string | null;
};

export type WorkflowAgreementTimelineRow = {
  id: string;
  organizationId: string;
  title: string | null;
  originalFilename: string | null;
  workflowSlug: string | null;
  createdAt: string;
  extractedAt: string | null;
  approvedAt: string | null;
  bootstrappedAt: string | null;
  dealId?: string | null;
};

export type OrganizationWorkflowTimelineRow = {
  id: string;
  organizationId: string;
  templateSlug: string;
  createdAt: string;
  deployedAt: string;
};

export type ParticipantTimelineRow = {
  id: string;
  name: string;
  dealId: string;
  createdAt: string;
  organizationId?: string | null;
};

export type PilotObligationTimelineRow = {
  id: string;
  organizationId: string | null;
  dealId: string;
  participantId: string | null;
  participantName: string | null;
  amount: number;
  currency: string;
  createdAt: string;
  paymentEventId?: string | null;
  paymentLinkId?: string | null;
};

export type PayoutBatchTimelineRow = {
  id: string;
  organizationId: string;
  currency: string;
  totalAmount: number;
  createdAt: string;
  submittedAt: string | null;
  participantNames?: string[];
};

export type PayoutTimelineRow = {
  id: string;
  organizationId: string;
  batchId: string;
  userId: string;
  participantId?: string | null;
  participantName: string | null;
  currency: string;
  netAmount: number;
  status: string;
  paidAt: string | null;
  failedReason: string | null;
  createdAt: string;
};

export type CommissionItemTimelineRow = {
  id: string;
  amount: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  payoutId: string | null;
  paymentLinkId: string | null;
  participantId: string | null;
  participantName: string | null;
  invoiceReference: string | null;
  commissionObligationId?: string | null;
};

export type ReferralLinkTimelineRow = {
  id: string;
  organizationId: string;
  code: string;
  createdAt: string;
  participantId?: string | null;
  participantName?: string | null;
};

export type ConnectedSystemTimelineRow = {
  id: string;
  provider: string;
  createdAt: string;
};

export type CommercialTimelineSources = {
  organizationId: string;
  organizationCreatedAt?: string | null;
  /** Deal ids proven to belong to this organisation. Ambiguous deals are omitted. */
  organizationDealIds?: string[];
  paymentLinks: PaymentLinkTimelineRow[];
  paymentEvents: PaymentEventTimelineRow[];
  xeroConnection: { id: string; connectedAt: string } | null;
  xeroSyncs: XeroSyncTimelineRow[];
  workflowAgreements: WorkflowAgreementTimelineRow[];
  workflows: OrganizationWorkflowTimelineRow[];
  participants: ParticipantTimelineRow[];
  pilotObligations: PilotObligationTimelineRow[];
  payoutBatches: PayoutBatchTimelineRow[];
  payouts: PayoutTimelineRow[];
  commissionItems: CommissionItemTimelineRow[];
  referralLinks: ReferralLinkTimelineRow[];
  connectedSystems: ConnectedSystemTimelineRow[];
};

export type CommercialTimelineResult = {
  organizationId: string;
  events: CommercialTimelineEvent[];
  hasCommercialActivity: boolean;
  completeness?: CommercialTimelineCompleteness;
};
