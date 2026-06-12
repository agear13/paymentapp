export type ExtractionConfidence = 'high' | 'medium' | 'low' | 'absent';
export type ExtractorEntryPoint = 'project_create' | 'participant_add' | 'onboarding';
export type ParticipationModelOption =
  | 'fixed_payout'
  | 'revenue_share'
  | 'hybrid'
  | 'customer_attribution';

export type MilestoneCategory = 'financial' | 'performance';
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
}

export interface ExtractedParty {
  id: string;
  name: ExtractionField<string>;
  email: ExtractionField<string | null>;
  role: ExtractionField<string>;
  participationModel: ExtractionField<ParticipationModelOption>;
  fixedAmount: ExtractionField<number | null>;
  revenueSharePct: ExtractionField<number | null>;
  /** Performance obligations — deliverables, assets, service outputs. */
  deliverables: ExtractionField<string[]>;
  /** Financial and performance milestones with deadlines. */
  milestones: ExtractedMilestone[];
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
  parties: ExtractedParty[];
  paymentTerms: ExtractedPaymentTerm[];
  uncertainties: ExtractionUncertainty[];
  overallConfidence: ExtractionConfidence;
  sourceHint: string | null;
  extractedAt: string;
  /** Tracks obligation schema generation for lifecycle/settlement features. */
  schemaVersion?: 'v1' | 'v2';
}

export const EXTRACTOR_VERSION = 'v2' as const;
export const EXTRACTOR_CREATED_VIA = 'ai_conversation_import' as const;