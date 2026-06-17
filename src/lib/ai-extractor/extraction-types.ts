import type { AgreementType } from './classify-agreement-type';
import type { ExtractionReadinessAssessment } from './extraction-readiness';
import type { ServiceCategory } from './service-category';

export type { AgreementType, ServiceCategory };
export type { ExtractionReadinessAssessment, ReadinessDimension, ReadinessDimensionScore } from './extraction-readiness';

export type ExtractionConfidence = 'high' | 'medium' | 'low' | 'absent';
export type ExtractorEntryPoint = 'project_create' | 'participant_add' | 'onboarding';
export type ParticipationModelOption =
  | 'fixed_payout'
  | 'revenue_share'
  | 'hybrid'
  | 'customer_attribution';

export type MilestoneCategory = 'financial' | 'performance';
export type ObligationStatus =
  | 'draft'
  | 'confirmed'
  | 'pending'
  | 'conditional'
  | 'fulfilled'
  | 'disputed';
export type SettlementEventType =
  | 'fixed_fee'
  | 'revenue_share'
  | 'bonus'
  | 'milestone'
  | 'attribution';
export type CurrencyConfidenceState = 'CONFIRMED' | 'ASSUMED' | 'UNKNOWN';
export type SourceType = 'whatsapp' | 'email' | 'slack' | 'sms' | 'meeting_notes' | 'other';

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  slack: 'Slack',
  sms: 'SMS',
  meeting_notes: 'Meeting Notes',
  other: 'Other',
};

export interface ExtractionField<T> {
  value: T;
  confidence: ExtractionConfidence;
  rawSnippet?: string;
}

export interface ExtractionUncertainty {
  field: string;
  issue: string;
  snippet?: string;
}

export interface ExtractedMilestone {
  description: ExtractionField<string>;
  deadline: ExtractionField<string | null>;
  category: ExtractionField<MilestoneCategory>;
  status?: ObligationStatus;
}

export interface ExtractedCondition {
  description: ExtractionField<string>;
  dependsOn: ExtractionField<string | null>;
  status?: ObligationStatus;
}

export interface ExtractedDependency {
  obligation: ExtractionField<string>;
  dependsOn: ExtractionField<string>;
  status?: ObligationStatus;
}

export interface ExtractedSettlementEvent {
  partyId: ExtractionField<string>;
  partyName: ExtractionField<string>;
  type: ExtractionField<SettlementEventType>;
  amount: ExtractionField<number | null>;
  percentage: ExtractionField<number | null>;
  trigger: ExtractionField<string | null>;
  condition: ExtractionField<string | null>;
  status: ObligationStatus;
}

export interface ExtractedDeliverable {
  description: ExtractionField<string>;
  category: ExtractionField<ServiceCategory | null>;
}

export interface ExtractedConditionalPayment {
  trigger: ExtractionField<string>;
  amount: ExtractionField<number | null>;
  rawSnippet?: string;
}

export interface ExtractedSettlementRule {
  trigger: ExtractionField<string>;
  basis: ExtractionField<string | null>;
  rawSnippet?: string;
}

export interface ExtractedParty {
  id: string;
  name: ExtractionField<string>;
  email: ExtractionField<string | null>;
  role: ExtractionField<string>;
  participationModel: ExtractionField<ParticipationModelOption>;
  fixedAmount: ExtractionField<number | null>;
  revenueSharePct: ExtractionField<number | null>;
  /** Structured performance obligations — deliverables, assets, service outputs. */
  deliverables: ExtractedDeliverable[];
  /** Legacy string-list deliverables from schema v3 responses. */
  deliverablesLegacy?: ExtractionField<string[]>;
  /** Conditional bonuses and performance-tied payouts — not revenue share. */
  conditionalPayments: ExtractedConditionalPayment[];
  /** Financial and performance milestones with deadlines. */
  milestones: ExtractedMilestone[];
  /** Normalized commercial service categories (MARKETING, PHOTOGRAPHY, …). */
  serviceCategories: ExtractionField<ServiceCategory[]>;
  conditions: ExtractedCondition[];
  dependencies: ExtractedDependency[];
  notes: ExtractionField<string | null>;
}

export interface ExtractedPaymentTerm {
  description: ExtractionField<string>;
  amount: ExtractionField<number | null>;
  currency: ExtractionField<string | null>;
  dueCondition: ExtractionField<string | null>;
}

export interface ExtractionResult {
  projectName: ExtractionField<string | null>;
  projectDescription: ExtractionField<string | null>;
  projectValue: ExtractionField<number | null>;
  currency: ExtractionField<string | null>;
  counterparty: ExtractionField<string | null>;
  agreementType?: ExtractionField<AgreementType | null>;
  parties: ExtractedParty[];
  paymentTerms: ExtractedPaymentTerm[];
  settlementRules?: ExtractedSettlementRule[];
  settlementEvents?: ExtractedSettlementEvent[];
  readinessAssessment?: ExtractionReadinessAssessment;
  uncertainties: ExtractionUncertainty[];
  overallConfidence: ExtractionConfidence;
  sourceHint: string | null;
  extractedAt: string;
  /** Tracks obligation schema generation for lifecycle/settlement features. */
  schemaVersion?: 'v1' | 'v2' | 'v3' | 'v4';
}

export const EXTRACTOR_VERSION = 'v4' as const;
export const EXTRACTOR_CREATED_VIA = 'ai_conversation_import' as const;