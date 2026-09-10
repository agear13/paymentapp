import type { PayoutMethodType, PayoutStatus } from '@prisma/client';

/**
 * Canonical outbound payout rail ids. Separate from inbound PaymentRailId.
 * stripe_treasury remains reserved until an adapter exists. airwallex is
 * implemented for sandbox only and is never auto-selected.
 */
export const PAYOUT_RAIL_IDS = [
  'manual',
  'hedera',
  'cregis',
  'airwallex',
  'stripe_treasury',
] as const;

export type PayoutRailId = (typeof PAYOUT_RAIL_IDS)[number];

export const IMPLEMENTED_PAYOUT_RAIL_IDS = ['manual', 'hedera', 'cregis', 'airwallex'] as const;
export type ImplementedPayoutRailId = (typeof IMPLEMENTED_PAYOUT_RAIL_IDS)[number];

export type PayoutDestinationKind = 'BANK_ACCOUNT' | 'WALLET' | 'PLATFORM_HANDLE';

export type PayoutRailHealth = 'available' | 'unavailable' | 'unknown';

export type PayoutRailCapabilities = {
  railId: PayoutRailId;
  displayLabel: string;
  implemented: boolean;
  supportedCurrencies: readonly string[];
  supportedDestinationKinds: readonly PayoutDestinationKind[];
  supportsQuote: boolean;
  supportsPrepare: boolean;
  supportsCancel: boolean;
  acceptsInboundWebhooks: boolean;
  typicalSettlementHint: string;
  feeHint: string;
  health: PayoutRailHealth;
};

export type CanonicalPayoutDestination = {
  kind: PayoutDestinationKind | null;
  payoutMethodId: string | null;
  methodType: PayoutMethodType | null;
  handle: string | null;
  /** Destination metadata from payout_methods.details — not provider columns. */
  details?: Record<string, unknown> | null;
};

export type CanonicalPayoutInstruction = {
  payoutId: string;
  organizationId: string;
  batchId: string;
  payeeUserId: string;
  amount: string;
  currency: string;
  destinationKind: PayoutDestinationKind | null;
  railId: PayoutRailId;
  idempotencyKey: string;
  providerReference: string | null;
  status: PayoutStatus;
  destination: CanonicalPayoutDestination;
};

export type PayoutQuote = {
  railId: PayoutRailId;
  feeAmount: string;
  feeCurrency: string;
  estimatedSettlementHint: string;
  fxCostHint?: string | null;
  raw?: Record<string, unknown> | null;
};

export type PreparedPayout = {
  railId: PayoutRailId;
  payoutIds: string[];
  providerPayload: Record<string, unknown>;
};

export type PayoutAdapterSubmitResult = {
  providerReference: string | null;
  status: Extract<PayoutStatus, 'SUBMITTED' | 'PROCESSING' | 'PAID' | 'FAILED'>;
  providerPayload?: Record<string, unknown> | null;
};

export type CanonicalPayoutStatus = {
  status: Extract<PayoutStatus, 'SUBMITTED' | 'PROCESSING' | 'PAID' | 'FAILED'>;
  providerReference: string | null;
  failedReason?: string | null;
  providerPayload?: Record<string, unknown> | null;
};

export type CanonicalPayoutEvent = {
  payoutId?: string;
  idempotencyKey?: string;
  /** Informational; orchestrator never copies this onto payouts.rail_id. */
  railId?: PayoutRailId;
  providerReference: string | null;
  status: Extract<PayoutStatus, 'PROCESSING' | 'PAID' | 'FAILED'>;
  occurredAt?: Date;
  failedReason?: string | null;
  providerPayload?: Record<string, unknown> | null;
};

/**
 * Adapter-only execution hints. Hedera destinations stay here rather than on
 * the canonical payout row.
 */
export type CregisExecutionCredentials = {
  apiKey: string;
  pid: number;
  gatewayBaseUrl: string;
  walletId?: number | null;
  fromAddress?: string | null;
  callbackUrl?: string | null;
  executionEnabled: boolean;
  environment?: 'sandbox' | 'production';
};

/**
 * Sandbox-only Airwallex credentials. environment is always sandbox — there is
 * no production host path in this adapter. onBehalfOfAccountId is optional so
 * the same adapter can run against a Provvy-owned wallet or x-on-behalf-of
 * once Airwallex confirms the customer-funds model. Do not assume either.
 */
export type AirwallexExecutionCredentials = {
  clientId: string;
  apiKey: string;
  webhookSecret?: string | null;
  onBehalfOfAccountId?: string | null;
  loginAsAccountId?: string | null;
  sourceCurrency?: string | null;
  transferMethod?: 'LOCAL' | 'SWIFT';
  transferReason?: string | null;
  feePaidBy?: 'PAYER' | 'BENEFICIARY';
  executionEnabled: boolean;
  environment: 'sandbox';
};

export type PayoutRailExecutionContext = {
  merchantHederaAccountId?: string | null;
  hederaDestinationsByPayoutId?: Record<string, string | null>;
  fetchImpl?: typeof fetch;
  /** Test/injection only. Production adapters load encrypted org credentials. */
  cregis?: CregisExecutionCredentials;
  airwallex?: AirwallexExecutionCredentials;
};

export interface PayoutRailAdapter {
  readonly railId: PayoutRailId;
  getCapabilities(): PayoutRailCapabilities;
  quote?(
    instruction: CanonicalPayoutInstruction,
    context?: PayoutRailExecutionContext
  ): Promise<PayoutQuote>;
  prepare?(
    instruction: CanonicalPayoutInstruction,
    context?: PayoutRailExecutionContext
  ): Promise<PreparedPayout>;
  /**
   * Optional grouping for rails whose native unit is a multi-payee transfer
   * (Hedera HTS). Orchestrator still applies status per payout.
   */
  prepareGroup?(
    instructions: CanonicalPayoutInstruction[],
    context?: PayoutRailExecutionContext
  ): Promise<PreparedPayout>;
  submit(
    instruction: CanonicalPayoutInstruction,
    context?: PayoutRailExecutionContext
  ): Promise<PayoutAdapterSubmitResult>;
  syncStatus(
    instruction: CanonicalPayoutInstruction,
    context?: PayoutRailExecutionContext
  ): Promise<CanonicalPayoutStatus>;
  cancel?(
    instruction: CanonicalPayoutInstruction,
    context?: PayoutRailExecutionContext
  ): Promise<void>;
  /**
   * Verify an inbound webhook. Rails without this do not accept public webhooks.
   * May be async when verification requires a server-side credential lookup.
   */
  verifyWebhook?(
    headers: Record<string, string | undefined>,
    rawBody: string
  ): boolean | Promise<boolean>;
  /** Stable provider event id for webhook dedupe. */
  webhookEventId?(parsed: unknown, rawBody: string): string | null;
  /** Provider-required ACK body. Cregis documents the string `success`. */
  webhookAcknowledgement?(): { body: string; contentType: string };
  normalizeWebhook(raw: unknown): CanonicalPayoutEvent | CanonicalPayoutEvent[] | null;
}

export function isPayoutRailId(value: string): value is PayoutRailId {
  return (PAYOUT_RAIL_IDS as readonly string[]).includes(value);
}

export function isImplementedPayoutRailId(value: string): value is ImplementedPayoutRailId {
  return (IMPLEMENTED_PAYOUT_RAIL_IDS as readonly string[]).includes(value);
}
