import type { TreasuryEventStatus } from '@prisma/client';
import {
  countCorrelationCandidates,
  type TreasuryEventSnapshot,
  type TreasuryLinkSnapshot,
} from '@/lib/treasury/reconciliation/matching';
import type {
  ReconciliationChainNode,
  ReconciliationChainStatus,
  TreasuryReconciliationException,
} from '@/lib/treasury/reconciliation/types';

function isAudWithdrawal(event: TreasuryEventSnapshot): boolean {
  return (
    event.event_type === 'FIAT_CREDIT' &&
    (event.metadata as Record<string, unknown> | null)?.display_as === 'aud_withdrawal'
  );
}

function isAudBalanceCredit(event: TreasuryEventSnapshot): boolean {
  return (
    event.event_type === 'FIAT_CREDIT' &&
    (event.metadata as Record<string, unknown> | null)?.display_as === 'aud_balance_credit'
  );
}

export function detectReconciliationExceptions(params: {
  paymentLinkId: string;
  events: TreasuryEventSnapshot[];
  links: TreasuryLinkSnapshot[];
  nodes: ReconciliationChainNode[];
  chainStatus: ReconciliationChainStatus;
  unknownOutboundMovement?: boolean;
  knownDepositAddresses?: Set<string>;
}): TreasuryReconciliationException[] {
  const exceptions: TreasuryReconciliationException[] = [];
  const { events, links, paymentLinkId } = params;

  const byType = (type: string) => events.filter((e) => e.event_type === type);
  const walletTransfers = byType('WALLET_TRANSFER');
  const exchangeDeposits = byType('EXCHANGE_DEPOSIT');
  const conversions = byType('CONVERSION');
  const assetReceived = byType('ASSET_RECEIVED');

  for (const event of events) {
    if (!event.provider_reference?.trim()) {
      exceptions.push({
        type: 'missing_provider_reference',
        severity: 'UNKNOWN',
        observed: `${event.event_type} event without provider reference`,
        expected: 'Immutable provider reference on every treasury event',
        reason: 'Cannot idempotently reconcile without provider reference',
        suggestedAction: 'Re-sync from provider or contact support',
        relatedEventIds: [event.id],
        paymentLinkId,
      });
    }
  }

  const providerRefCounts = new Map<string, string[]>();
  for (const event of events) {
    const key = `${event.event_type}:${event.provider_reference}`;
    const ids = providerRefCounts.get(key) ?? [];
    ids.push(event.id);
    providerRefCounts.set(key, ids);
  }
  for (const [, ids] of providerRefCounts) {
    if (ids.length > 1) {
      exceptions.push({
        type: 'duplicate_provider_event',
        severity: 'EXCEPTION',
        observed: `${ids.length} events share the same provider reference`,
        expected: 'One treasury event per provider reference',
        reason: 'Duplicate provider event detected',
        suggestedAction: 'Review duplicate events; one may be a sync artifact',
        relatedEventIds: ids,
        paymentLinkId,
      });
    }
  }

  if (params.unknownOutboundMovement) {
    exceptions.push({
      type: 'unknown_wallet_movement',
      severity: 'UNKNOWN',
      observed: 'Outbound wallet transfer without deterministic invoice link',
      expected: 'Wallet transfer linked to ASSET_RECEIVED for this invoice',
      reason: 'Multiple or zero ASSET_RECEIVED candidates — amount/time matching forbidden',
      suggestedAction: 'Review wallet activity and create a manual link if appropriate',
      relatedEventIds: walletTransfers.map((e) => e.id),
      paymentLinkId,
    });
  }

  for (const wt of walletTransfers) {
    const depositCandidates = countCorrelationCandidates(wt, exchangeDeposits, {
      knownDepositAddresses: params.knownDepositAddresses,
    });
    if (depositCandidates.length > 1) {
      exceptions.push({
        type: 'ambiguous_match',
        severity: 'UNKNOWN',
        observed: 'Wallet transfer matches multiple exchange deposits',
        expected: 'Exactly one deterministic exchange deposit candidate',
        reason: 'Ambiguous correlation — refusing to auto-link',
        suggestedAction: 'Manually link the correct exchange deposit with evidence',
        relatedEventIds: [wt.id, ...depositCandidates.map((c) => c.id)],
        paymentLinkId,
      });
    }

    const linkedToDeposit = links.some(
      (l) =>
        l.source_event_id === wt.id &&
        exchangeDeposits.some((d) => d.id === l.target_event_id)
    );
    if (!linkedToDeposit && exchangeDeposits.length === 0) {
      exceptions.push({
        type: 'wallet_without_exchange',
        severity: 'UNKNOWN',
        observed: 'Wallet transfer without matching exchange deposit',
        expected: 'Digital Surge deposit with matching transaction hash or provider ID',
        reason: 'No exchange deposit correlated to this wallet movement',
        suggestedAction: 'Sync Digital Surge or wait for deposit confirmation',
        relatedEventIds: [wt.id],
        paymentLinkId,
      });
    }
  }

  for (const deposit of exchangeDeposits) {
    const walletLinked = links.some(
      (l) =>
        l.target_event_id === deposit.id &&
        (walletTransfers.some((w) => w.id === l.source_event_id) ||
          assetReceived.some((a) => a.id === l.source_event_id))
    );
    if (!walletLinked && walletTransfers.length === 0 && assetReceived.length > 0) {
      exceptions.push({
        type: 'exchange_without_wallet',
        severity: 'UNKNOWN',
        observed: 'Exchange deposit without upstream wallet or asset movement',
        expected: 'Linked ASSET_RECEIVED or WALLET_TRANSFER',
        reason: 'Deposit exists but cannot be placed in invoice chain',
        suggestedAction: 'Verify deposit belongs to this invoice or link manually',
        relatedEventIds: [deposit.id],
        paymentLinkId,
      });
    }
  }

  for (const conversion of conversions) {
    const hasDepositLink = links.some(
      (l) =>
        l.target_event_id === conversion.id &&
        exchangeDeposits.some((d) => d.id === l.source_event_id)
    );
    if (exchangeDeposits.length > 0 && !hasDepositLink) {
      exceptions.push({
        type: 'conversion_without_deposit',
        severity: 'UNKNOWN',
        observed: 'Conversion without linked exchange deposit',
        expected: 'Provider object ID or transaction hash link to deposit',
        reason: 'Cannot confirm conversion source deposit deterministically',
        suggestedAction: 'Sync Digital Surge or manually link deposit to conversion',
        relatedEventIds: [conversion.id],
        paymentLinkId,
      });
    }
  }

  const audWithdrawals = events.filter(isAudWithdrawal);
  const confirmedBank = events.filter(
    (e) => e.event_type === 'BANK_SETTLEMENT' && e.status === 'CONFIRMED'
  );

  if (audWithdrawals.length > 0 && confirmedBank.length === 0) {
    exceptions.push({
      type: 'awaiting_bank_confirmation',
      severity: 'UNKNOWN',
      observed: 'AUD withdrawal from Digital Surge recorded',
      expected: 'Confirmed bank settlement from bank feed or explicit provider evidence',
      reason: 'Digital Surge withdrawal does not confirm bank receipt',
      suggestedAction: 'Await bank feed reconciliation in a later phase',
      relatedEventIds: audWithdrawals.map((e) => e.id),
      paymentLinkId,
    });
  }

  for (const withdrawal of audWithdrawals) {
    if (withdrawal.event_type === 'BANK_SETTLEMENT') {
      exceptions.push({
        type: 'conflicting_provider_info',
        severity: 'EXCEPTION',
        observed: 'AUD withdrawal incorrectly represented as BANK_SETTLEMENT',
        expected: 'FIAT_CREDIT aud_withdrawal until bank confirms receipt',
        reason: 'Bank settlement cannot be inferred from exchange withdrawal',
        suggestedAction: 'Review normalization — bank settlement requires bank evidence',
        relatedEventIds: [withdrawal.id],
        paymentLinkId,
      });
    }
  }

  const assets = new Set(assetReceived.map((e) => e.asset).filter(Boolean));
  if (assets.size > 1) {
    exceptions.push({
      type: 'unexpected_asset',
      severity: 'INFERRED',
      observed: `Multiple inbound assets on one invoice: ${[...assets].join(', ')}`,
      expected: 'Single primary asset per invoice treasury chain',
      reason: 'Multi-asset invoice requires separate reconciliation review',
      suggestedAction: 'Review each asset movement independently',
      relatedEventIds: assetReceived.map((e) => e.id),
      paymentLinkId,
    });
  }

  void isAudBalanceCredit;
  return exceptions;
}

export function deriveChainStatus(params: {
  nodes: ReconciliationChainNode[];
  exceptions: TreasuryReconciliationException[];
  hasConfirmedBankSettlement: boolean;
  hasAudWithdrawal: boolean;
  hasWalletTransfer: boolean;
  hasExchangeDeposit: boolean;
  unknownOutboundMovement: boolean;
}): ReconciliationChainStatus {
  if (params.exceptions.some((e) => e.severity === 'EXCEPTION')) {
    return 'EXCEPTION';
  }

  if (params.hasConfirmedBankSettlement) {
    const requiredConfirmed = params.nodes.filter(
      (n) =>
        n.eventType !== 'WALLET' &&
        n.eventType !== 'UNKNOWN' &&
        !['NOT_APPLICABLE'].includes(n.status)
    );
    const allConfirmed = requiredConfirmed.every((n) => n.status === 'CONFIRMED');
    if (allConfirmed) return 'RECONCILED';
  }

  if (params.hasAudWithdrawal && !params.hasConfirmedBankSettlement) {
    return 'AWAITING_BANK_CONFIRMATION';
  }

  if (params.unknownOutboundMovement || params.hasWalletTransfer && !params.hasExchangeDeposit) {
    if (params.hasWalletTransfer && !params.hasExchangeDeposit) {
      return 'AWAITING_EXCHANGE_IDENTIFICATION';
    }
  }

  if (params.unknownOutboundMovement) {
    return 'AWAITING_EXCHANGE_IDENTIFICATION';
  }

  const hasAssetReceived = params.nodes.some((n) => n.eventType === 'ASSET_RECEIVED');
  if (hasAssetReceived && !params.hasWalletTransfer && !params.hasExchangeDeposit) {
    return 'AWAITING_WALLET_ACTIVITY';
  }

  return 'PARTIAL';
}
