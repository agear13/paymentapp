/**
 * Settlement provider interfaces — future Circle, Wise, bank, exchange integrations.
 * No provider implementations in this phase; model + hooks only.
 */

import type { PaymentSettlementStatus } from '@prisma/client';

export type SettlementProviderKind =
  | 'MANUAL'
  | 'WISE'
  | 'CIRCLE'
  | 'BANK_TRANSFER'
  | 'EXCHANGE_WITHDRAWAL'
  | 'STRIPE'
  | 'HEDERA'
  | 'EVM_WALLET'
  | 'PAYTO'
  | 'CANTON'
  | 'ACH'
  | 'SEPA'
  | 'RTP';

export type SettlementRecord = {
  id: string;
  paymentLinkId: string;
  paymentEventId: string | null;
  status: PaymentSettlementStatus;
  currency: string;
  amount: string;
  destination: string | null;
  settledAt: Date | null;
  reference: string | null;
  provider: SettlementProviderKind | string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatePendingSettlementInput = {
  paymentLinkId: string;
  paymentEventId?: string | null;
  organizationId: string;
  currency: string;
  amount: string | number;
  provider?: SettlementProviderKind | string | null;
  destination?: string | null;
  metadata?: Record<string, unknown>;
};

export type MarkSettlementSettledInput = {
  settlementId: string;
  reference?: string | null;
  settledAt?: Date;
  actor?: string | null;
  metadata?: Record<string, unknown>;
};

/** Future automated settlement providers implement this contract. */
export interface SettlementProviderAdapter {
  readonly kind: SettlementProviderKind;
  /** Poll or webhook-driven status check — not implemented in phase 1. */
  checkSettlementStatus?(settlementId: string): Promise<PaymentSettlementStatus>;
  /** Trigger outbound settlement — not implemented in phase 1. */
  initiateSettlement?(input: CreatePendingSettlementInput): Promise<{ externalReference: string }>;
}

export type ManualSettlementAdapter = SettlementProviderAdapter & {
  kind: 'MANUAL';
};

export type WiseSettlementAdapter = SettlementProviderAdapter & {
  kind: 'WISE';
};

export type CircleSettlementAdapter = SettlementProviderAdapter & {
  kind: 'CIRCLE';
};

export type BankTransferSettlementAdapter = SettlementProviderAdapter & {
  kind: 'BANK_TRANSFER';
};

export type ExchangeWithdrawalSettlementAdapter = SettlementProviderAdapter & {
  kind: 'EXCHANGE_WITHDRAWAL';
};

/** Registry placeholder for future provider wiring. */
export const SETTLEMENT_PROVIDER_REGISTRY: Partial<
  Record<SettlementProviderKind, SettlementProviderAdapter>
> = {
  MANUAL: { kind: 'MANUAL' },
};
