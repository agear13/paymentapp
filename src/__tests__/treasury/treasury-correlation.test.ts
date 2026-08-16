import {
  findDeterministicCorrelation,
  isWeakCorrelationAttempt,
} from '@/lib/treasury/reconciliation/correlation';

describe('treasury correlation', () => {
  const org = 'org-1';

  it('matches on transaction hash', () => {
    const match = findDeterministicCorrelation(
      {
        id: 'a1',
        organization_id: org,
        event_type: 'ASSET_RECEIVED',
        status: 'CONFIRMED',
        transaction_hash: '0xabc',
        provider_reference: 'tx:0xabc',
        payment_link_id: 'link-1',
        destination_address: '0xwallet',
        amount: { toString: () => '1500' },
        asset: 'USDC',
      },
      {
        id: 'd1',
        organization_id: org,
        event_type: 'EXCHANGE_DEPOSIT',
        status: 'UNKNOWN',
        transaction_hash: '0xabc',
        provider_reference: 'ds:summary:1:object:2',
        payment_link_id: null,
        destination_address: null,
        amount: { toString: () => '1500' },
        asset: 'USDC',
      }
    );
    expect(match?.strategy).toBe('transaction_hash');
    expect(match?.status).toBe('CONFIRMED');
  });

  it('rejects cross-merchant match', () => {
    const match = findDeterministicCorrelation(
      {
        id: 'a1',
        organization_id: 'org-1',
        event_type: 'ASSET_RECEIVED',
        status: 'CONFIRMED',
        transaction_hash: '0xabc',
        provider_reference: 'tx:0xabc',
        payment_link_id: 'link-1',
        destination_address: null,
        amount: { toString: () => '1500' },
        asset: 'USDC',
      },
      {
        id: 'd1',
        organization_id: 'org-2',
        event_type: 'EXCHANGE_DEPOSIT',
        status: 'UNKNOWN',
        transaction_hash: '0xabc',
        provider_reference: 'ds:summary:1:object:2',
        payment_link_id: null,
        destination_address: null,
        amount: { toString: () => '1500' },
        asset: 'USDC',
      }
    );
    expect(match).toBeNull();
  });

  it('rejects cross-invoice when both have payment_link_id', () => {
    const match = findDeterministicCorrelation(
      {
        id: 'a1',
        organization_id: org,
        event_type: 'ASSET_RECEIVED',
        status: 'CONFIRMED',
        transaction_hash: '0xabc',
        provider_reference: 'tx:0xabc',
        payment_link_id: 'link-1',
        destination_address: null,
        amount: { toString: () => '1500' },
        asset: 'USDC',
      },
      {
        id: 'd1',
        organization_id: org,
        event_type: 'EXCHANGE_DEPOSIT',
        status: 'UNKNOWN',
        transaction_hash: '0xabc',
        provider_reference: 'ds:summary:1:object:2',
        payment_link_id: 'link-2',
        destination_address: null,
        amount: { toString: () => '1500' },
        asset: 'USDC',
      }
    );
    expect(match).toBeNull();
  });

  it('does not allow amount-only matching helper', () => {
    expect(isWeakCorrelationAttempt({ matchOnAmountOnly: true })).toBe(true);
    expect(isWeakCorrelationAttempt({ matchOnTimestampOnly: true })).toBe(true);
    expect(isWeakCorrelationAttempt({})).toBe(false);
  });

  it('correlates WALLET_TRANSFER to EXCHANGE_DEPOSIT by transaction hash and known deposit address', () => {
    const known = new Set(['0xdsdeposit']);
    const match = findDeterministicCorrelation(
      {
        id: 'wt-1',
        organization_id: org,
        event_type: 'WALLET_TRANSFER',
        status: 'CONFIRMED',
        transaction_hash: '0xabc',
        provider_reference: 'evm:outbound',
        payment_link_id: 'link-1',
        source_address: '0xmerchant',
        destination_address: '0xdsdeposit',
        amount: { toString: () => '-1500' },
        asset: 'USDC',
      },
      {
        id: 'd1',
        organization_id: org,
        event_type: 'EXCHANGE_DEPOSIT',
        status: 'CONFIRMED',
        transaction_hash: '0xabc',
        provider_reference: 'ds:summary:1:object:2',
        payment_link_id: null,
        destination_address: '0xdsdeposit',
        amount: { toString: () => '1500' },
        asset: 'USDC',
      },
      { knownDepositAddresses: known }
    );
    expect(match?.status).toBe('CONFIRMED');
    expect(match?.strategy).toBe('known_deposit_address_with_hash');
  });

  it('unknown when no hash or provider reference match', () => {
    const match = findDeterministicCorrelation(
      {
        id: 'a1',
        organization_id: org,
        event_type: 'ASSET_RECEIVED',
        status: 'CONFIRMED',
        transaction_hash: null,
        provider_reference: 'tx:missing',
        payment_link_id: 'link-1',
        destination_address: null,
        amount: { toString: () => '1500' },
        asset: 'USDC',
      },
      {
        id: 'd1',
        organization_id: org,
        event_type: 'EXCHANGE_DEPOSIT',
        status: 'UNKNOWN',
        transaction_hash: null,
        provider_reference: 'ds:summary:9:object:9',
        payment_link_id: null,
        destination_address: null,
        amount: { toString: () => '1500' },
        asset: 'USDC',
      }
    );
    expect(match).toBeNull();
  });
});
