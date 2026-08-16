import type { TreasuryEventStatus, TreasuryEventType, TreasuryLinkType } from '@prisma/client';

/** Aggregate reconciliation status for an invoice money lifecycle. */
export type ReconciliationChainStatus =
  | 'RECONCILED'
  | 'AWAITING_WALLET_ACTIVITY'
  | 'AWAITING_EXCHANGE_IDENTIFICATION'
  | 'AWAITING_BANK_CONFIRMATION'
  | 'PARTIAL'
  | 'EXCEPTION';

export type ReconciliationExceptionType =
  | 'unmatched_wallet_transfer'
  | 'ambiguous_match'
  | 'exchange_without_wallet'
  | 'wallet_without_exchange'
  | 'conversion_without_deposit'
  | 'missing_provider_reference'
  | 'duplicate_provider_event'
  | 'unexpected_asset'
  | 'conflicting_provider_info'
  | 'unknown_wallet_movement'
  | 'awaiting_bank_confirmation';

export type TreasuryReconciliationException = {
  type: ReconciliationExceptionType;
  severity: 'EXCEPTION' | 'UNKNOWN' | 'INFERRED';
  observed: string;
  expected: string;
  reason: string;
  suggestedAction: string;
  relatedEventIds: string[];
  paymentLinkId?: string | null;
};

export type LinkEvidence = {
  strategy: string | null;
  linkId?: string;
  linkType?: TreasuryLinkType;
  linkStatus?: TreasuryEventStatus;
  manual: boolean;
};

export type ReconciliationChainNode = {
  stage: string;
  eventType: TreasuryEventType | 'WALLET';
  label: string;
  eventId?: string;
  status: TreasuryEventStatus | 'NOT_APPLICABLE';
  asset: string | null;
  destinationAsset?: string | null;
  amount: string | null;
  destinationAmount?: string | null;
  feeAmount?: string | null;
  exchangeRate?: string | null;
  provider: string | null;
  occurredAt: string | null;
  transactionReference: string | null;
  providerReference: string | null;
  destinationAddress: string | null;
  evidence: LinkEvidence | null;
};

export type TreasuryReconciliationChain = {
  paymentLinkId: string;
  invoiceReference: string | null;
  chainStatus: ReconciliationChainStatus;
  nodes: ReconciliationChainNode[];
  exceptions: TreasuryReconciliationException[];
  links: Array<{
    id: string;
    sourceEventId: string;
    targetEventId: string;
    linkType: TreasuryLinkType;
    linkStatus: TreasuryEventStatus;
    evidence: unknown;
  }>;
};

export type TreasuryReconciliationMetrics = {
  totalCryptoReceived: number;
  totalCryptoTransferred: number;
  totalExchangeDeposits: number;
  totalConvertedToFiatAud: number;
  audAwaitingWithdrawal: number;
  audAwaitingBankConfirmation: number;
  fullyReconciledChains: number;
  exceptionsRequiringReview: number;
  partialChains: number;
  unknownEvents: number;
};

export type TreasuryActivityFilter =
  | 'all'
  | 'needs_review'
  | 'unknown'
  | 'ambiguous'
  | 'exceptions'
  | 'awaiting_bank';
