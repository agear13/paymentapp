import type { AgreementAllowedMime } from '@/lib/agreement-analyzer/validation';
import type {
  AgreementExecutiveSummary,
  AgreementExtractionResult,
  AgreementReportJson,
} from '@/lib/agreement-analyzer/extraction/extraction-types';

export type AgreementExtractionProviderId = 'claude' | 'openai';

export type StructuredExtractionResult = {
  extraction: AgreementExtractionResult;
  modelName: string;
};

export type ImageTranscriptionResult = {
  text: string;
  modelName: string;
};

export type RelationshipClassificationResult = {
  relationshipType: string;
  modelName: string;
};

export type ExecutiveSummaryGenerationInput = {
  extractionJson: unknown;
  reportJson: AgreementReportJson;
  settlementReadinessScore: number;
};

export type ExecutiveSummaryGenerationResult = {
  summary: AgreementExecutiveSummary;
  modelName: string;
};

export interface AIExtractionProvider {
  readonly id: AgreementExtractionProviderId;
  readonly modelName: string;
  isConfigured(): boolean;
  extractStructuredObligations(normalizedText: string): Promise<StructuredExtractionResult>;
  transcribeImage(bytes: Buffer, mimeType: AgreementAllowedMime): Promise<ImageTranscriptionResult>;
  classifyRelationship(normalizedText: string): Promise<RelationshipClassificationResult>;
  generateExecutiveSummary(
    input: ExecutiveSummaryGenerationInput
  ): Promise<ExecutiveSummaryGenerationResult>;
}
