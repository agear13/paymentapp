import type { AgreementExtractionProviderId } from '@/lib/agreement-analyzer/ai/types';

export const AGREEMENT_EXTRACTION_PROVIDER_ENV = 'AGREEMENT_EXTRACTION_PROVIDER';
export const DEFAULT_AGREEMENT_EXTRACTION_PROVIDER: AgreementExtractionProviderId = 'claude';

const PROVIDER_IDS: AgreementExtractionProviderId[] = ['claude', 'openai'];

export function resolveAgreementExtractionProviderId(
  override?: string | null
): AgreementExtractionProviderId {
  const candidate = (override ?? process.env[AGREEMENT_EXTRACTION_PROVIDER_ENV] ?? '')
    .trim()
    .toLowerCase();

  if (PROVIDER_IDS.includes(candidate as AgreementExtractionProviderId)) {
    return candidate as AgreementExtractionProviderId;
  }

  return DEFAULT_AGREEMENT_EXTRACTION_PROVIDER;
}

export function getClaudeAgreementExtractionModel(): string {
  return process.env.AGREEMENT_EXTRACTION_MODEL?.trim() || 'claude-sonnet-4-6';
}

export function getClaudeAgreementVisionModel(): string {
  return process.env.AGREEMENT_VISION_MODEL?.trim() || getClaudeAgreementExtractionModel();
}

export function getOpenAIAgreementExtractionModel(): string {
  return process.env.AGREEMENT_EXTRACTION_MODEL?.trim() || 'gpt-4o';
}

export function getOpenAIAgreementVisionModel(): string {
  return process.env.AGREEMENT_VISION_MODEL?.trim() || getOpenAIAgreementExtractionModel();
}

export function getProviderApiKeyEnvName(providerId: AgreementExtractionProviderId): string {
  return providerId === 'claude' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
}
