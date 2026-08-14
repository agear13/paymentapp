import { deriveMerchantPaymentCapabilities } from '@/lib/accounting/merchant-payment-capabilities';
import { buildPaymentTokenAccountingSummary } from '@/lib/accounting/payment-account-setup-copy';

describe('deriveMerchantPaymentCapabilities', () => {
  it('includes all Hedera checkout tokens when HashPack is configured', () => {
    const capabilities = deriveMerchantPaymentCapabilities({
      railSetup: {
        multiRails: {
          stripe: { configured: false, incomplete: false },
          hedera: { configured: true, incomplete: false },
          wise: { configured: false, incomplete: false },
          evm_wallet: { configured: false, incomplete: false },
        },
        anyRailConfigured: true,
        readyForPaymentRequests: true,
      },
    });

    expect(capabilities.enabledSettlementTokens).toEqual(['HBAR', 'USDC', 'USDT', 'AUDD']);
  });

  it('only includes configured EVM supported tokens', () => {
    const capabilities = deriveMerchantPaymentCapabilities({
      railSetup: {
        multiRails: {
          stripe: { configured: false, incomplete: false },
          hedera: { configured: false, incomplete: false },
          wise: { configured: false, incomplete: false },
          evm_wallet: { configured: true, incomplete: false },
        },
        anyRailConfigured: true,
        readyForPaymentRequests: true,
      },
      evmSupportedTokens: ['USDC'],
    });

    expect(capabilities.enabledSettlementTokens).toEqual(['USDC']);
  });
});

describe('buildPaymentTokenAccountingSummary', () => {
  it('summarizes missing per-asset mappings for enabled tokens', () => {
    const summary = buildPaymentTokenAccountingSummary(
      { crypto_settlement_strategy: 'per_asset' },
      {
        hederaConfigured: false,
        evmConfigured: true,
        enabledSettlementTokens: ['USDC', 'USDT'],
      },
      'per_asset'
    );

    expect(summary).toBe(
      'USDC and USDT are enabled for payments, but their Xero holding accounts still need to be linked.'
    );
  });
});
