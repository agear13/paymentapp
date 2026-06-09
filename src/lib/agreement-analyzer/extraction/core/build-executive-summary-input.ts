import type {
  AgreementExtractionResult,
  AgreementReportJson,
} from '@/lib/agreement-analyzer/extraction/extraction-types';

export type ExecutiveSummaryStructuredInput = {
  documentType: string | null;
  parties: unknown[];
  roles: unknown[];
  revenueSplits: unknown[];
  paymentConditions: unknown[];
  obligations: unknown[];
  risks: unknown[];
  missingInformation: unknown[];
  confidenceScore: number | null;
  partyCount: number;
  obligationCount: number;
  paymentConditionCount: number;
  riskCount: number;
  missingInformationCount: number;
  settlementReadinessScore: number;
  settlementReadiness: AgreementReportJson['settlementReadiness'];
};

function readDocumentType(extractionJson: unknown): string | null {
  if (
    extractionJson &&
    typeof extractionJson === 'object' &&
    'documentType' in extractionJson &&
    typeof extractionJson.documentType === 'string'
  ) {
    const value = extractionJson.documentType.trim();
    return value.length > 0 ? value : null;
  }
  return null;
}

function readConfidenceScore(extractionJson: unknown): number | null {
  if (
    extractionJson &&
    typeof extractionJson === 'object' &&
    'confidenceScore' in extractionJson &&
    typeof extractionJson.confidenceScore === 'number'
  ) {
    return extractionJson.confidenceScore;
  }
  return null;
}

function readArrayField(extractionJson: unknown, field: keyof AgreementExtractionResult): unknown[] {
  if (
    extractionJson &&
    typeof extractionJson === 'object' &&
    field in extractionJson &&
    Array.isArray((extractionJson as Record<string, unknown>)[field])
  ) {
    return (extractionJson as Record<string, unknown>)[field] as unknown[];
  }
  return [];
}

export function buildExecutiveSummaryStructuredInput(input: {
  extractionJson: unknown;
  reportJson: AgreementReportJson;
  settlementReadinessScore: number;
}): ExecutiveSummaryStructuredInput {
  return {
    documentType: readDocumentType(input.extractionJson),
    parties: readArrayField(input.extractionJson, 'parties'),
    roles: readArrayField(input.extractionJson, 'roles'),
    revenueSplits: readArrayField(input.extractionJson, 'revenueSplits'),
    paymentConditions: readArrayField(input.extractionJson, 'paymentConditions'),
    obligations: readArrayField(input.extractionJson, 'obligations'),
    risks: readArrayField(input.extractionJson, 'risks'),
    missingInformation: readArrayField(input.extractionJson, 'missingInformation'),
    confidenceScore: readConfidenceScore(input.extractionJson),
    partyCount: input.reportJson.parties.length,
    obligationCount: input.reportJson.obligations.length,
    paymentConditionCount: input.reportJson.paymentConditions.length,
    riskCount: input.reportJson.risks.length,
    missingInformationCount: input.reportJson.missingInformation.length,
    settlementReadinessScore: input.settlementReadinessScore,
    settlementReadiness: input.reportJson.settlementReadiness,
  };
}
