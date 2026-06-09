import { AgreementExtractionResultSchema } from '@/lib/agreement-analyzer/extraction/extraction-types';
import { AgreementReportJsonSchema } from '@/lib/agreement-analyzer/report-types';
import type { NormalizedActualExtraction } from '@/lib/agreement-analyzer/evaluation/evaluation-types';

function emptyActual(): NormalizedActualExtraction {
  return {
    parties: [],
    revenueSplits: [],
    obligations: [],
    risks: [],
    missingInformation: [],
  };
}

/**
 * Accepts raw extraction JSON shapes used in the pipeline:
 * - OpenAI extraction (`AgreementExtractionResult`)
 * - Public report payload (`AgreementReportJson`)
 * - Evaluation fixture wrapper `{ extraction: ... }` or `{ report: ... }`
 */
export function normalizeActualExtraction(input: unknown): NormalizedActualExtraction | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const record = input as Record<string, unknown>;

  if (record.extraction && typeof record.extraction === 'object') {
    return normalizeActualExtraction(record.extraction);
  }
  if (record.report && typeof record.report === 'object') {
    return normalizeActualExtraction(record.report);
  }

  const extractionParsed = AgreementExtractionResultSchema.safeParse(record);
  if (extractionParsed.success) {
    return {
      commercialRelationshipType: extractionParsed.data.documentType,
      parties: extractionParsed.data.parties,
      revenueSplits: extractionParsed.data.revenueSplits,
      obligations: extractionParsed.data.obligations,
      risks: extractionParsed.data.risks,
      missingInformation: extractionParsed.data.missingInformation,
    };
  }

  const reportParsed = AgreementReportJsonSchema.safeParse(record);
  if (reportParsed.success) {
    return {
      parties: reportParsed.data.parties,
      revenueSplits: reportParsed.data.revenueSplits,
      obligations: reportParsed.data.obligations,
      risks: reportParsed.data.risks,
      missingInformation: reportParsed.data.missingInformation,
    };
  }

  if (
    Array.isArray(record.parties) ||
    Array.isArray(record.revenueSplits) ||
    Array.isArray(record.obligations)
  ) {
    return {
      commercialRelationshipType:
        typeof record.commercialRelationshipType === 'string'
          ? record.commercialRelationshipType
          : typeof record.documentType === 'string'
            ? record.documentType
            : undefined,
      parties: Array.isArray(record.parties) ? record.parties : [],
      revenueSplits: Array.isArray(record.revenueSplits) ? record.revenueSplits : [],
      obligations: Array.isArray(record.obligations) ? record.obligations : [],
      risks: Array.isArray(record.risks) ? record.risks : [],
      missingInformation: Array.isArray(record.missingInformation)
        ? record.missingInformation
        : [],
    };
  }

  return emptyActual();
}
