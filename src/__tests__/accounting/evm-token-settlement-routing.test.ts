import { deriveMerchantPaymentCapabilities } from '@/lib/accounting/merchant-payment-capabilities';
import { getSettlementAccountsForUi } from '@/lib/accounting/settlement-account-ui';
import {
  paymentMethodAndTokenToSettlementContext,
  resolveSettlementAccount,
} from '@/lib/accounting/settlement-account-resolver';

function railSetupFromFlags(flags: {
  hedera?: boolean;
  evm?: boolean;
}) {
  return {
    multiRails: {
      stripe: { configured: false, incomplete: false },
      hedera: { configured: Boolean(flags.hedera), incomplete: false },
      wise: { configured: false, incomplete: false },
      evm_wallet: { configured: Boolean(flags.evm), incomplete: false },
    },
    anyRailConfigured: Boolean(flags.hedera || flags.evm),
    readyForPaymentRequests: Boolean(flags.hedera || flags.evm),
  };
}

describe('MetaMask token → Xero holding routing (acceptance)', () => {
  const evmCapabilities = deriveMerchantPaymentCapabilities({
    railSetup: railSetupFromFlags({ evm: true }),
    evmSupportedTokens: ['USDC', 'USDT'],
  });

  const perAssetSettings = {
    crypto_settlement_strategy: 'per_asset' as const,
    xero_usdc_clearing_account_id: '2052',
    xero_usdt_clearing_account_id: '2053',
  };

  it('routes MetaMask USDC payments to USDC Holding', () => {
    const context = paymentMethodAndTokenToSettlementContext('EVM_WALLET', 'USDC');
    const resolution = resolveSettlementAccount({
      ...context,
      settings: perAssetSettings,
    });

    expect(context).toEqual({
      paymentRail: 'crypto',
      collectionMethod: 'metamask',
      paymentAsset: 'USDC',
    });
    expect(resolution.status).toBe('resolved');
    if (resolution.status === 'resolved') {
      expect(resolution.xeroAccountCode).toBe('2052');
      expect(resolution.target.accountName).toBe('USDC Holding');
      expect(resolution.target.scope).toBe('per_asset');
    }
  });

  it('routes MetaMask USDT payments to USDT Holding', () => {
    const context = paymentMethodAndTokenToSettlementContext('EVM_WALLET', 'USDT');
    const resolution = resolveSettlementAccount({
      ...context,
      settings: perAssetSettings,
    });

    expect(resolution.status).toBe('resolved');
    if (resolution.status === 'resolved') {
      expect(resolution.xeroAccountCode).toBe('2053');
      expect(resolution.target.accountName).toBe('USDT Holding');
      expect(resolution.target.scope).toBe('per_asset');
    }
  });

  it('does not cross-route USDC payments to the USDT holding account', () => {
    const resolution = resolveSettlementAccount({
      paymentRail: 'crypto',
      collectionMethod: 'metamask',
      paymentAsset: 'USDC',
      settings: perAssetSettings,
    });

    expect(resolution.status).toBe('resolved');
    if (resolution.status === 'resolved') {
      expect(resolution.xeroAccountCode).not.toBe('2053');
    }
  });

  it('requires separate USDC and USDT holding setup rows when EVM tokens are enabled', () => {
    const definitions = getSettlementAccountsForUi(
      { crypto_settlement_strategy: 'per_asset' },
      {
        stripeEnabled: false,
        wiseEnabled: false,
        stablecoinSettlementsEnabled: true,
        manualBankEnabled: false,
      },
      evmCapabilities
    );

    expect(definitions.map((item) => item.accountName)).toEqual([
      'USDC Holding',
      'USDT Holding',
    ]);
  });
});

describe('Hedera token accounting setup rows', () => {
  const hederaCapabilities = deriveMerchantPaymentCapabilities({
    railSetup: railSetupFromFlags({ hedera: true }),
  });

  it('includes HBAR, USDC, USDT, and AUDD when Hedera checkout is configured', () => {
    expect(hederaCapabilities.enabledSettlementTokens).toEqual([
      'HBAR',
      'USDC',
      'USDT',
      'AUDD',
    ]);
  });

  it('shows per-asset holding rows for all Hedera checkout tokens', () => {
    const definitions = getSettlementAccountsForUi(
      { crypto_settlement_strategy: 'per_asset' },
      {
        stripeEnabled: false,
        wiseEnabled: false,
        stablecoinSettlementsEnabled: true,
        manualBankEnabled: false,
      },
      hederaCapabilities
    );

    expect(definitions.map((item) => item.accountName)).toEqual([
      'HBAR Holding',
      'USDC Holding',
      'USDT Holding',
      'AUDD Holding',
    ]);
  });

  it('routes HashPack AUDD payments to AUDD Holding when mapped', () => {
    const resolution = resolveSettlementAccount({
      paymentRail: 'crypto',
      collectionMethod: 'hashpack',
      paymentAsset: 'AUDD',
      settings: {
        crypto_settlement_strategy: 'per_asset',
        xero_audd_clearing_account_id: '2054',
      },
    });

    expect(resolution.status).toBe('resolved');
    if (resolution.status === 'resolved') {
      expect(resolution.xeroAccountCode).toBe('2054');
      expect(resolution.target.accountName).toBe('AUDD Holding');
    }
  });
});
