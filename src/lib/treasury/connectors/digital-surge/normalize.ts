import type { TreasuryEventStatus, TreasuryEventType } from '@prisma/client';
import type { NormalizedExchangeRecord } from '@/lib/treasury/connectors/exchange-connector.types';
import type { DigitalSurgeAllTransaction } from '@/lib/treasury/connectors/digital-surge/types';
import { TREASURY_PROVIDERS } from '@/lib/treasury/events/types';

const STABLECOINS = new Set(['USDC', 'USDT']);

export function digitalSurgeProviderReference(tx: DigitalSurgeAllTransaction): string {
  return `ds:summary:${tx.summary_id ?? tx.id}:object:${tx.object_id}`;
}

export function extractDigitalSurgeTxHash(tx: DigitalSurgeAllTransaction): string | null {
  const candidates = [
    tx.blockchain_tx_hash,
    tx.tx_hash,
    tx.txid,
    tx.metadata?.transaction_hash,
    tx.metadata?.tx_hash,
    tx.metadata?.blockchain_tx_hash,
    tx.metadata?.txid,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim().toLowerCase();
    }
  }
  return null;
}

export function extractDigitalSurgeIdentifiers(tx: DigitalSurgeAllTransaction) {
  return {
    summaryId: tx.summary_id,
    id: tx.id,
    objectId: tx.object_id,
    transactionType: tx.transaction_type,
    transactionSubtype: tx.transaction_subtype,
    status: tx.status,
  };
}

function digitalSurgeWithdrawalStatus(tx: DigitalSurgeAllTransaction): TreasuryEventStatus {
  const normalized = tx.status?.toLowerCase().trim() ?? '';
  if (
    normalized.includes('completed') ||
    normalized.includes('processed') ||
    normalized.includes('success') ||
    normalized === 'confirmed'
  ) {
    return 'CONFIRMED';
  }
  return 'UNKNOWN';
}

function baseRecord(
  tx: DigitalSurgeAllTransaction,
  eventType: TreasuryEventType,
  status: TreasuryEventStatus,
  overrides: Partial<NormalizedExchangeRecord> = {}
): NormalizedExchangeRecord {
  const txHash = extractDigitalSurgeTxHash(tx);
  const ids = extractDigitalSurgeIdentifiers(tx);

  return {
    eventType,
    status,
    provider: TREASURY_PROVIDERS.DIGITAL_SURGE,
    providerReference: digitalSurgeProviderReference(tx),
    asset: tx.src_asset?.toUpperCase() ?? tx.dst_asset?.toUpperCase() ?? null,
    destinationAsset: tx.dst_asset?.toUpperCase() ?? null,
    amount: tx.src_amount,
    destinationAmount: tx.dst_amount,
    exchangeRate: tx.exchange_rate,
    feeAmount: tx.aud_fee ?? tx.fee,
    feeCurrency: tx.aud_fee ? 'AUD' : tx.fee_currency?.toUpperCase() ?? null,
    destinationAddress: tx.deposit_address ?? null,
    transactionHash: txHash,
    occurredAt: new Date(tx.created),
    metadata: {
      digital_surge: {
        ...ids,
        aud_value: tx.aud_value,
        quote_cost: tx.quote_cost,
        cost: tx.cost,
        fee: tx.fee,
        aud_fee: tx.aud_fee,
      },
    },
    rawProviderPayload: tx as unknown as Record<string, unknown>,
    ...overrides,
  };
}

/**
 * AUD withdrawal from Digital Surge — factual provider withdrawal only.
 * Never emits BANK_SETTLEMENT; bank arrival requires a future bank connector or explicit provider evidence.
 */
function normalizeDigitalSurgeAudWithdrawal(
  tx: DigitalSurgeAllTransaction
): NormalizedExchangeRecord[] {
  const withdrawalStatus = digitalSurgeWithdrawalStatus(tx);
  const amount = tx.src_amount?.startsWith('-') ? tx.src_amount : `-${tx.src_amount ?? '0'}`;

  return [
    baseRecord(tx, 'FIAT_CREDIT', withdrawalStatus, {
      providerReference: `${digitalSurgeProviderReference(tx)}:aud_withdrawal`,
      asset: 'AUD',
      amount,
      metadata: {
        display_as: 'aud_withdrawal',
        bank_settlement_evidence: null,
        digital_surge: {
          ...extractDigitalSurgeIdentifiers(tx),
          provider_withdrawal_status: tx.status,
          transaction_subtype: tx.transaction_subtype,
          note: 'Digital Surge AUD withdrawal — bank receipt not confirmed by provider',
        },
      },
    }),
  ];
}

/**
 * Normalize a Digital Surge transaction into treasury event(s).
 * Does not infer revenue or customer payments.
 */
export function normalizeDigitalSurgeTransaction(
  tx: DigitalSurgeAllTransaction
): NormalizedExchangeRecord[] {
  const type = tx.transaction_type;
  const src = tx.src_asset?.toUpperCase() ?? '';
  const dst = tx.dst_asset?.toUpperCase() ?? '';
  const txHash = extractDigitalSurgeTxHash(tx);

  if (type === 'deposit') {
    const asset = (src || dst).toUpperCase();
    return [
      baseRecord(tx, 'EXCHANGE_DEPOSIT', txHash ? 'CONFIRMED' : 'UNKNOWN', {
        asset,
        amount: tx.dst_amount ?? tx.src_amount,
        status: txHash ? 'CONFIRMED' : 'UNKNOWN',
        metadata: {
          digital_surge: {
            ...extractDigitalSurgeIdentifiers(tx),
            correlation_hint: txHash ? 'transaction_hash' : 'provider_reference_only',
            aud_value: tx.aud_value,
          },
        },
      }),
    ];
  }

  if (type === 'withdrawal' && src === 'AUD') {
    return normalizeDigitalSurgeAudWithdrawal(tx);
  }

  if (type === 'withdrawal' && src !== 'AUD') {
    return [
      baseRecord(tx, 'UNKNOWN', 'UNKNOWN', {
        metadata: {
          digital_surge: {
            ...extractDigitalSurgeIdentifiers(tx),
            display_as: 'crypto_withdrawal',
          },
        },
      }),
    ];
  }

  if (
    (type === 'swap' || type === 'sell') &&
    STABLECOINS.has(src) &&
    dst === 'AUD'
  ) {
    const records: NormalizedExchangeRecord[] = [
      baseRecord(tx, 'CONVERSION', 'CONFIRMED', {
        asset: src,
        destinationAsset: 'AUD',
        amount: tx.src_amount,
        destinationAmount: tx.dst_amount ?? tx.aud_value,
        exchangeRate: tx.exchange_rate,
        feeAmount: tx.aud_fee ?? tx.fee,
        feeCurrency: tx.aud_fee ? 'AUD' : tx.fee_currency?.toUpperCase() ?? null,
      }),
    ];

    const audFee = tx.aud_fee ?? tx.fee;
    if (audFee && Number.parseFloat(String(audFee)) > 0) {
      records.push({
        ...baseRecord(tx, 'UNKNOWN', 'CONFIRMED', {
          providerReference: `${digitalSurgeProviderReference(tx)}:fee`,
          asset: 'AUD',
          amount: `-${audFee}`,
          destinationAsset: null,
          destinationAmount: null,
          metadata: {
            display_as: 'fee',
            parent_provider_reference: digitalSurgeProviderReference(tx),
            digital_surge: {
              ...extractDigitalSurgeIdentifiers(tx),
              aud_fee: tx.aud_fee,
              fee: tx.fee,
            },
          },
        }),
      });
    }

    if (tx.dst_amount || tx.aud_value) {
      records.push(
        baseRecord(tx, 'FIAT_CREDIT', 'CONFIRMED', {
          providerReference: `${digitalSurgeProviderReference(tx)}:fiat_credit`,
          asset: 'AUD',
          amount: tx.dst_amount ?? tx.aud_value,
          destinationAsset: null,
          destinationAmount: null,
          metadata: {
            display_as: 'aud_balance_credit',
            source_conversion: digitalSurgeProviderReference(tx),
            digital_surge: extractDigitalSurgeIdentifiers(tx),
          },
        })
      );
    }

    return records;
  }

  return [
    baseRecord(tx, 'UNKNOWN', 'UNKNOWN', {
      metadata: {
        digital_surge: {
          ...extractDigitalSurgeIdentifiers(tx),
          unmapped: true,
        },
      },
    }),
  ];
}

/** True when a normalized record represents a Digital Surge AUD withdrawal (not a balance credit). */
export function isDigitalSurgeAudWithdrawalRecord(record: NormalizedExchangeRecord): boolean {
  return record.metadata?.display_as === 'aud_withdrawal';
}

/** True when a treasury event row represents a Digital Surge AUD withdrawal. */
export function isTreasuryAudWithdrawalEvent(metadata: unknown): boolean {
  return (metadata as Record<string, unknown> | null)?.display_as === 'aud_withdrawal';
}
