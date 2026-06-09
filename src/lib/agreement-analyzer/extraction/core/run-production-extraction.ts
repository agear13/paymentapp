import {
  getAgreementExtractionProvider,
  getAgreementExtractionProviderApiKeyError,
} from '@/lib/agreement-analyzer/ai/get-agreement-extraction-provider';
import { resolveAgreementExtractionProviderId } from '@/lib/agreement-analyzer/ai/provider-config';
import type { AgreementExtractionProviderId } from '@/lib/agreement-analyzer/ai/types';
import type { AgreementAllowedMime } from '@/lib/agreement-analyzer/validation';
import { buildAgreementReportJson } from '@/lib/agreement-analyzer/extraction/core/build-report-json';
import {
  AgreementDocumentParseError,
  extractDocumentText,
} from '@/lib/agreement-analyzer/extraction/core/document-parsers';
import type {
  AgreementExtractionFailureJson,
  AgreementExtractionResult,
  AgreementReportJson,
} from '@/lib/agreement-analyzer/extraction/extraction-types';
import { extractStructuredObligationsFromText } from '@/lib/agreement-analyzer/extraction/core/structured-extraction';
import { normalizeAgreementText } from '@/lib/agreement-analyzer/extraction/core/normalize-text';

export type ProductionExtractionSuccess = {
  success: true;
  extraction: AgreementExtractionResult;
  reportJson: AgreementReportJson;
  extractedText: string;
  modelName: string;
  providerId: AgreementExtractionProviderId;
  processingDurationMs: number;
};

export type ProductionExtractionFailure = {
  success: false;
  error: string;
  stage: AgreementExtractionFailureJson['stage'];
  extractedText: string | null;
  modelName: string | null;
  providerId: AgreementExtractionProviderId;
  processingDurationMs: number;
};

export type ProductionExtractionResult = ProductionExtractionSuccess | ProductionExtractionFailure;

/**
 * Core extraction pipeline shared by production processing and benchmark runs.
 */
export async function runProductionAgreementExtraction(input: {
  bytes: Buffer;
  mimeType: AgreementAllowedMime;
  providerId?: AgreementExtractionProviderId | string | null;
}): Promise<ProductionExtractionResult> {
  const startedAt = Date.now();
  const providerId = resolveAgreementExtractionProviderId(input.providerId);
  const provider = getAgreementExtractionProvider(providerId);
  let extractedText: string | null = null;
  let modelName: string | null = null;

  try {
    if (!provider.isConfigured()) {
      throw Object.assign(new Error(getAgreementExtractionProviderApiKeyError(providerId)), {
        stage: 'openai_extraction' as const,
      });
    }

    const textResult = await extractDocumentText(input.bytes, input.mimeType, providerId);
    extractedText = textResult.text;
    if (textResult.kind === 'image') {
      modelName = textResult.modelName;
    }

    const normalizedText = normalizeAgreementText(extractedText);
    if (!normalizedText) {
      throw Object.assign(new Error('No extractable text content after normalization.'), {
        stage: 'normalization' as const,
      });
    }

    const structured = await extractStructuredObligationsFromText(normalizedText, providerId);
    modelName = structured.modelName;
    const reportJson = buildAgreementReportJson(structured.extraction);

    return {
      success: true,
      extraction: structured.extraction,
      reportJson,
      extractedText: normalizedText,
      modelName: structured.modelName,
      providerId,
      processingDurationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown extraction error';
    const stage =
      error instanceof AgreementDocumentParseError
        ? 'text_extraction'
        : ((error as { stage?: AgreementExtractionFailureJson['stage'] }).stage ??
          (message.includes('OPENAI') || message.includes('ANTHROPIC')
            ? 'openai_extraction'
            : 'text_extraction'));

    return {
      success: false,
      error: message,
      stage,
      extractedText,
      modelName,
      providerId,
      processingDurationMs: Date.now() - startedAt,
    };
  }
}
