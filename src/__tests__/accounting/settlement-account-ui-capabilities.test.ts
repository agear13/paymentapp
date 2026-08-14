import { deriveMerchantPaymentCapabilities } from '@/lib/accounting/merchant-payment-capabilities';
import { getSettlementAccountsForUi } from '@/lib/accounting/settlement-account-ui';
import { SHARED_DIGITAL_HOLDING } from '@/lib/accounting/settlement-account-config';

describe('getSettlementAccountsForUi with payment capabilities', () => {
  const rails = {
    stripeEnabled: false,
    wiseEnabled: false,
    stablecoinSettlementsEnabled: true,
    manualBankEnabled: false,
  };

  it('shows shared digital holding under shared strategy', () => {
    const definitions = getSettlementAccountsForUi(
      { crypto_settlement_strategy: 'shared' },
      rails,
      deriveMerchantPaymentCapabilities({
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
        evmSupportedTokens: ['USDC', 'USDT'],
      })
    );

    expect(definitions).toHaveLength(1);
    expect(definitions[0]?.accountName).toBe(SHARED_DIGITAL_HOLDING.accountName);
  });

  it('only requires enabled EVM tokens under per_asset strategy', () => {
    const definitions = getSettlementAccountsForUi(
      { crypto_settlement_strategy: 'per_asset' },
      rails,
      deriveMerchantPaymentCapabilities({
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
      })
    );

    expect(definitions.map((item) => item.accountName)).toEqual(['USDC Holding']);
  });
});
