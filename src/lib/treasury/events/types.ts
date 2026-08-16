import type {
  TreasuryEventStatus,
  TreasuryEventType,
  TreasuryLinkType,
} from '@prisma/client';

export type { TreasuryEventStatus, TreasuryEventType, TreasuryLinkType };

export const TREASURY_PROVIDERS = {
  PROVVY: 'provvy',
  BLOCKCHAIN: 'blockchain',
  DIGITAL_SURGE: 'digital_surge',
} as const;

export type TreasuryProvider = (typeof TREASURY_PROVIDERS)[keyof typeof TREASURY_PROVIDERS];

export type IngestTreasuryEventInput = {
  organizationId: string;
  eventType: TreasuryEventType;
  status?: TreasuryEventStatus;
  provider: string;
  providerReference: string;
  asset?: string | null;
  destinationAsset?: string | null;
  amount?: string | number | null;
  destinationAmount?: string | number | null;
  exchangeRate?: string | number | null;
  feeAmount?: string | number | null;
  feeCurrency?: string | null;
  sourceAddress?: string | null;
  destinationAddress?: string | null;
  walletNetwork?: string | null;
  transactionHash?: string | null;
  paymentLinkId?: string | null;
  paymentEventId?: string | null;
  parentTreasuryEventId?: string | null;
  occurredAt: Date;
  metadata?: Record<string, unknown> | null;
  rawProviderPayload?: Record<string, unknown> | null;
};

export type TreasuryActivityRow = {
  id: string;
  occurredAt: string;
  eventType: TreasuryEventType;
  asset: string | null;
  destinationAsset: string | null;
  amount: string | null;
  destinationAmount: string | null;
  provider: string;
  status: TreasuryEventStatus;
  invoiceReference: string | null;
  paymentLinkId: string | null;
};

export type TreasuryLifecycleStage =
  | 'invoice'
  | 'payment'
  | 'crypto_received'
  | 'wallet'
  | 'wallet_sent'
  | 'wallet_destination'
  | 'unknown_wallet_movement'
  | 'awaiting_exchange'
  | 'exchange_deposit'
  | 'conversion'
  | 'aud_balance'
  | 'aud_withdrawal'
  | 'awaiting_bank_confirmation'
  | 'bank_settlement'
  | 'awaiting_treasury'
  | 'exchange_transfer'
  | 'fiat_settlement'
  | 'xero';

export type TreasuryLifecycleStep = {
  stage: TreasuryLifecycleStage;
  label: string;
  status: TreasuryEventStatus | 'CONFIRMED' | 'UNKNOWN' | 'INFERRED' | 'EXCEPTION' | 'NOT_APPLICABLE';
  eventId?: string;
  detail?: string;
};
