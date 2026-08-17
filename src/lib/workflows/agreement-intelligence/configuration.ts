import type { AgreementIntelligenceConfiguration } from '@/lib/workflows/agreement-intelligence/types';
import { DEFAULT_AGREEMENT_INTELLIGENCE_CONFIGURATION } from '@/lib/workflows/agreement-intelligence/types';

const SUPPORTED_CURRENCIES = new Set(['AUD', 'USD']);

export function parseAgreementIntelligenceConfiguration(
  input: unknown
): AgreementIntelligenceConfiguration {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ...DEFAULT_AGREEMENT_INTELLIGENCE_CONFIGURATION };
  }

  const raw = input as Record<string, unknown>;
  const defaultSettlementCurrency =
    typeof raw.defaultSettlementCurrency === 'string' &&
    SUPPORTED_CURRENCIES.has(raw.defaultSettlementCurrency)
      ? (raw.defaultSettlementCurrency as 'AUD' | 'USD')
      : DEFAULT_AGREEMENT_INTELLIGENCE_CONFIGURATION.defaultSettlementCurrency;

  const operatorApprovalRequired =
    typeof raw.operatorApprovalRequired === 'boolean'
      ? raw.operatorApprovalRequired
      : DEFAULT_AGREEMENT_INTELLIGENCE_CONFIGURATION.operatorApprovalRequired;

  return {
    defaultSettlementCurrency,
    operatorApprovalRequired,
  };
}

export function sanitizeAgreementIntelligenceConfiguration(
  input: unknown
): AgreementIntelligenceConfiguration {
  if (input === undefined || input === null) {
    return { ...DEFAULT_AGREEMENT_INTELLIGENCE_CONFIGURATION };
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Configuration must be a plain object');
  }

  const raw = input as Record<string, unknown>;
  const allowedKeys = ['defaultSettlementCurrency', 'operatorApprovalRequired'];
  const unknownKeys = Object.keys(raw).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length > 0) {
    throw new Error(`Unknown configuration keys: ${unknownKeys.join(', ')}`);
  }

  return parseAgreementIntelligenceConfiguration(input);
}

export const AGREEMENT_INTELLIGENCE_CONFIGURATION_SCHEMA = {
  defaultSettlementCurrency: {
    type: 'string',
    enum: ['AUD', 'USD'],
    default: 'AUD',
  },
  operatorApprovalRequired: {
    type: 'boolean',
    default: true,
  },
} as const;
