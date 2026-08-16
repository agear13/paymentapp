import { normalizeDigitalSurgeTransaction } from '@/lib/treasury/connectors/digital-surge/normalize';
import type { DigitalSurgeAllTransaction } from '@/lib/treasury/connectors/digital-surge/types';

function baseTx(
  overrides: Partial<DigitalSurgeAllTransaction> = {}
): DigitalSurgeAllTransaction {
  return {
    summary_id: 100,
    id: 200,
    object_id: 300,
    created: '2026-08-01T10:00:00Z',
    src_asset: 'USDC',
    dst_asset: 'USDC',
    src_amount: '1500',
    dst_amount: '1500',
    quote_cost: null,
    exchange_rate: '1',
    cost: '0',
    fee: '0',
    aud_fee: '0',
    aud_value: '2250',
    fee_currency: 'AUD',
    status: 'completed',
    transaction_type: 'deposit',
    transaction_subtype: 'crypto',
    ...overrides,
  };
}

describe('Digital Surge normalization', () => {
  it('deposit with tx hash normalizes to EXCHANGE_DEPOSIT CONFIRMED', () => {
    const records = normalizeDigitalSurgeTransaction(
      baseTx({ blockchain_tx_hash: '0xabc123', transaction_type: 'deposit' })
    );
    expect(records).toHaveLength(1);
    expect(records[0].eventType).toBe('EXCHANGE_DEPOSIT');
    expect(records[0].status).toBe('CONFIRMED');
    expect(records[0].transactionHash).toBe('0xabc123');
  });

  it('deposit without tx hash is UNKNOWN', () => {
    const records = normalizeDigitalSurgeTransaction(baseTx({ transaction_type: 'deposit' }));
    expect(records[0].status).toBe('UNKNOWN');
  });

  it('USDC to AUD swap creates CONVERSION + FIAT_CREDIT + fee row', () => {
    const records = normalizeDigitalSurgeTransaction(
      baseTx({
        transaction_type: 'swap',
        src_asset: 'USDC',
        dst_asset: 'AUD',
        src_amount: '1500',
        dst_amount: '2245',
        aud_fee: '5',
      })
    );
    expect(records.some((r) => r.eventType === 'CONVERSION')).toBe(true);
    expect(records.some((r) => r.eventType === 'FIAT_CREDIT')).toBe(true);
    expect(records.some((r) => r.metadata?.display_as === 'fee')).toBe(true);
  });

  it('USDT to AUD sell creates CONVERSION', () => {
    const records = normalizeDigitalSurgeTransaction(
      baseTx({
        transaction_type: 'sell',
        src_asset: 'USDT',
        dst_asset: 'AUD',
        src_amount: '500',
        dst_amount: '750',
      })
    );
    expect(records[0].eventType).toBe('CONVERSION');
    expect(records[0].asset).toBe('USDT');
  });

  it('AUD withdrawal with bank subtype records aud_withdrawal, not BANK_SETTLEMENT', () => {
    const records = normalizeDigitalSurgeTransaction(
      baseTx({
        transaction_type: 'withdrawal',
        src_asset: 'AUD',
        dst_asset: 'AUD',
        transaction_subtype: 'bank_transfer',
        src_amount: '2240',
        status: 'completed',
      })
    );
    expect(records).toHaveLength(1);
    expect(records[0].eventType).toBe('FIAT_CREDIT');
    expect(records[0].eventType).not.toBe('BANK_SETTLEMENT');
    expect(records[0].metadata?.display_as).toBe('aud_withdrawal');
    expect(records[0].status).toBe('CONFIRMED');
    expect(records[0].metadata?.bank_settlement_evidence).toBeNull();
  });

  it('AUD withdrawal with pending provider status stays UNKNOWN', () => {
    const records = normalizeDigitalSurgeTransaction(
      baseTx({
        transaction_type: 'withdrawal',
        src_asset: 'AUD',
        dst_asset: 'AUD',
        transaction_subtype: 'bank_transfer',
        src_amount: '2240',
        status: 'pending',
      })
    );
    expect(records[0].status).toBe('UNKNOWN');
    expect(records[0].eventType).not.toBe('BANK_SETTLEMENT');
  });

  it('Digital Surge connector never emits BANK_SETTLEMENT from normalize', () => {
    const scenarios: Partial<DigitalSurgeAllTransaction>[] = [
      {
        transaction_type: 'withdrawal',
        src_asset: 'AUD',
        transaction_subtype: 'bank_transfer',
      },
      {
        transaction_type: 'withdrawal',
        src_asset: 'AUD',
        transaction_subtype: 'bpay',
      },
      {
        transaction_type: 'swap',
        src_asset: 'USDC',
        dst_asset: 'AUD',
      },
    ];
    for (const overrides of scenarios) {
      const records = normalizeDigitalSurgeTransaction(baseTx(overrides));
      expect(records.every((r) => r.eventType !== 'BANK_SETTLEMENT')).toBe(true);
    }
  });

  it('provider idempotency key is stable', () => {
    const tx = baseTx();
    const a = normalizeDigitalSurgeTransaction(tx)[0].providerReference;
    const b = normalizeDigitalSurgeTransaction(tx)[0].providerReference;
    expect(a).toBe(b);
    expect(a).toContain('ds:summary:100');
  });
});
