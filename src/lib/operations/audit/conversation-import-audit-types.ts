import type {
  ExtractionConfidence,
  ExtractorEntryPoint,
  ParticipationModelOption,
} from '@/lib/ai-extractor/extraction-types';

export type ConversationImportPartyRecord = {
  name: string;
  role: string;
  email?: string;
  participationModel: ParticipationModelOption;
  fixedAmount: number | null;
  revenueSharePct: number | null;
  partyConfidence: ExtractionConfidence;
  nameConfidence: ExtractionConfidence;
  participationModelConfidence: ExtractionConfidence;
  amountConfidence: ExtractionConfidence;
};

export type ConversationImportExtractionSummary = {
  oneLiner: string;
  participantCount: number;
  fixedPayoutCount: number;
  revenueShareCount: number;
  attributionCount: number;
  agreementTypeLabel: string;
  overallConfidence: ExtractionConfidence;
};

/** Persisted on deal_payload — survives snapshot sync and DB reload. */
export type ConversationImportAuditRecord = {
  id: string;
  importedAt: string;
  extractedAt: string;
  sourceType: string;
  extractorVersion: string;
  entryPoint: ExtractorEntryPoint;
  rawConversationText: string;
  extractionSummary: ConversationImportExtractionSummary;
  parties: ConversationImportPartyRecord[];
};

export type ConversationImportAuditPayload = {
  importId: string;
  rawConversationText: string;
  importedAt: string;
  extractedAt: string;
  sourceType?: string;
  extractorVersion?: string;
  entryPoint?: ExtractorEntryPoint;
  extractionSummary: ConversationImportExtractionSummary;
  parties: ConversationImportPartyRecord[];
};
