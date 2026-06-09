import { ClaudeExtractionProvider } from '@/lib/agreement-analyzer/ai/claude-extraction-provider';
import { OpenAIExtractionProvider } from '@/lib/agreement-analyzer/ai/openai-extraction-provider';
import { resolveAgreementExtractionProviderId } from '@/lib/agreement-analyzer/ai/provider-config';
import type {
  AgreementExtractionProviderId,
  AIExtractionProvider,
} from '@/lib/agreement-analyzer/ai/types';

const providerCache = new Map<AgreementExtractionProviderId, AIExtractionProvider>();

export function getAgreementExtractionProvider(
  providerId?: AgreementExtractionProviderId | string | null
): AIExtractionProvider {
  const resolvedId = resolveAgreementExtractionProviderId(providerId);
  const cached = providerCache.get(resolvedId);
  if (cached) {
    return cached;
  }

  const provider =
    resolvedId === 'openai' ? new OpenAIExtractionProvider() : new ClaudeExtractionProvider();
  providerCache.set(resolvedId, provider);
  return provider;
}

export function getAgreementExtractionProviderApiKeyError(providerId: AgreementExtractionProviderId): string {
  return providerId === 'claude'
    ? 'ANTHROPIC_API_KEY is not configured'
    : 'OPENAI_API_KEY is not configured';
}
