import { getAgreementExtractionProvider } from '@/lib/agreement-analyzer/ai/get-agreement-extraction-provider';
import type { AgreementExtractionProviderId } from '@/lib/agreement-analyzer/ai/types';
import type { AgreementExtractionResult } from '@/lib/agreement-analyzer/extraction/extraction-types';

export async function extractStructuredObligationsFromText(
  normalizedText: string,
  providerId?: AgreementExtractionProviderId | string | null
): Promise<{ extraction: AgreementExtractionResult; modelName: string }> {
  const provider = getAgreementExtractionProvider(providerId);
  return provider.extractStructuredObligations(normalizedText);
}
