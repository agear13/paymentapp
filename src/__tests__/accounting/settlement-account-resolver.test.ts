import {
  inferCryptoSettlementStrategy,
  resolveCryptoSettlementStrategy,
} from '@/lib/accounting/crypto-settlement-strategy';
import {
  paymentMethodAndTokenToSettlementContext,
  resolveSettlementAccount,
} from '@/lib/accounting/settlement-account-resolver';

describe('resolveCryptoSettlementStrategy', () => {
  it('defaults to shared when no crypto columns are configured', () => {
    expect(inferCryptoSettlementStrategy({})).toBe('shared');
  });

  it('infers per_asset when legacy token columns are configured', () => {
    expect(
      inferCryptoSettlementStrategy({
        xero_usdc_clearing_account_id: '1052',
      })
    ).toBe('per_asset');
  });

  it('infers per_asset when multiple distinct codes are configured', () => {
    expect(
      inferCryptoSettlementStrategy({
        xero_hbar_clearing_account_id: '1051',
        xero_usdc_clearing_account_id: '1052',
      })
    ).toBe('per_asset');
  });

  it('infers shared when multiple legacy columns share one code', () => {
    expect(
      inferCryptoSettlementStrategy({
        xero_hbar_clearing_account_id: '1060',
        xero_usdc_clearing_account_id: '1060',
        xero_usdt_clearing_account_id: '1060',
        xero_audd_clearing_account_id: '1060',
      })
    ).toBe('shared');
  });

  it('respects explicit cryptoSettlementStrategy override', () => {
    expect(
      resolveCryptoSettlementStrategy({
        xero_hbar_clearing_account_id: '1051',
        cryptoSettlementStrategy: 'shared',
      })
    ).toBe('shared');
  });
});

describe('resolveSettlementAccount', () => {
  it('resolves Stripe holding from rail only', () => {
    const resolution = resolveSettlementAccount({
      paymentRail: 'stripe',
      paymentAsset: 'AUD',
      settings: { xero_stripe_clearing_account_id: '1050' },
    });

    expect(resolution.status).toBe('resolved');
    if (resolution.status === 'resolved') {
      expect(resolution.xeroAccountCode).toBe('1050');
      expect(resolution.target.accountName).toBe('Stripe Holding');
    }
  });

  it('uses configured slot for any asset with a binding', () => {
    const resolution = resolveSettlementAccount({
      paymentRail: 'crypto',
      collectionMethod: 'hashpack',
      paymentAsset: 'USDC',
      settings: { xero_usdc_clearing_account_id: '1052' },
    });

    expect(resolution.status).toBe('resolved');
    if (resolution.status === 'resolved') {
      expect(resolution.xeroAccountCode).toBe('1052');
    }
  });

  it('treats BTC like any unbound asset under shared strategy', () => {
    const resolution = resolveSettlementAccount({
      paymentRail: 'crypto',
      collectionMethod: 'manual_wallet',
      paymentAsset: 'BTC',
      settings: {
        xero_hbar_clearing_account_id: '1060',
        xero_usdc_clearing_account_id: '1060',
        xero_usdt_clearing_account_id: '1060',
        xero_audd_clearing_account_id: '1060',
        cryptoSettlementStrategy: 'shared',
      },
    });

    expect(resolution.status).toBe('resolved');
    if (resolution.status === 'resolved') {
      expect(resolution.xeroAccountCode).toBe('1060');
      expect(resolution.target.accountName).toBe('Digital Asset Holding');
    }
  });

  it('treats BTC like any unbound asset under per_asset strategy', () => {
    const resolution = resolveSettlementAccount({
      paymentRail: 'crypto',
      collectionMethod: 'metamask',
      paymentAsset: 'BTC',
      settings: {
        xero_hbar_clearing_account_id: '1051',
        cryptoSettlementStrategy: 'per_asset',
      },
    });

    expect(resolution.status).toBe('unmapped');
    if (resolution.status === 'unmapped') {
      expect(resolution.target.accountName).toBe('BTC Holding');
      expect(resolution.target.scope).toBe('per_asset');
    }
  });
});

describe('paymentMethodAndTokenToSettlementContext', () => {
  it('uses crypto rail with manual_wallet collection method', () => {
    expect(paymentMethodAndTokenToSettlementContext('CRYPTO', 'BTC')).toEqual({
      paymentRail: 'crypto',
      collectionMethod: 'manual_wallet',
      paymentAsset: 'BTC',
    });
  });

  it('uses crypto rail with hashpack for Hedera', () => {
    expect(paymentMethodAndTokenToSettlementContext('HEDERA', 'USDC')).toEqual({
      paymentRail: 'crypto',
      collectionMethod: 'hashpack',
      paymentAsset: 'USDC',
    });
  });

  it('uses crypto rail with metamask for EVM', () => {
    expect(paymentMethodAndTokenToSettlementContext('EVM_WALLET', 'ETH')).toEqual({
      paymentRail: 'crypto',
      collectionMethod: 'metamask',
      paymentAsset: 'ETH',
    });
  });
});
