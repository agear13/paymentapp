import { getAgreementExtractionProvider } from '@/lib/agreement-analyzer/ai/get-agreement-extraction-provider';
import type { AgreementExtractionProviderId } from '@/lib/agreement-analyzer/ai/types';
import type { AgreementAllowedMime } from '@/lib/agreement-analyzer/validation';

export async function extractAgreementTextFromImage(
  bytes: Buffer,
  mimeType: AgreementAllowedMime,
  providerId?: AgreementExtractionProviderId | string | null
): Promise<{ text: string; modelName: string }> {
  const provider = getAgreementExtractionProvider(providerId);
  return provider.transcribeImage(bytes, mimeType);
}
