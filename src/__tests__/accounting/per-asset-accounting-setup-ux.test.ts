import { deriveMerchantPaymentCapabilities } from '@/lib/accounting/merchant-payment-capabilities';
import { buildPaymentTokenAccountingSummary } from '@/lib/accounting/payment-account-setup-copy';
import {
  resolvePaymentAccountRecommendation,
} from '@/lib/accounting/payment-account-recommendations';
import {
  getSettlementAccountsForUi,
  shouldShowCryptoSettlementAccounts,
  shouldShowCryptoSettlementStrategyUi,
} from '@/lib/accounting/settlement-account-ui';
import { SHARED_DIGITAL_HOLDING, STRIPE_HOLDING } from '@/lib/accounting/settlement-account-config';
import {
  isDetailedHoldingAccountGuide,
  resolveCreateAccountInXeroGuide,
} from '@/lib/xero/xero-holding-account-guides';

function evmCapabilities(tokens: string[] = ['USDC', 'USDT']) {
  return deriveMerchantPaymentCapabilities({
    railSetup: {
      multiRails: {
        stripe: { configured: true, incomplete: false },
        hedera: { configured: false, incomplete: false },
        wise: { configured: false, incomplete: false },
        evm_wallet: { configured: true, incomplete: false },
      },
      anyRailConfigured: true,
      readyForPaymentRequests: true,
    },
    evmSupportedTokens: tokens,
  });
}

function hederaCapabilities() {
  return deriveMerchantPaymentCapabilities({
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
}

const evmOnlyRails = {
  stripeEnabled: true,
  wiseEnabled: false,
  stablecoinSettlementsEnabled: false,
  manualBankEnabled: false,
};

const evmRailsWithStablecoinFlag = {
  ...evmOnlyRails,
  stablecoinSettlementsEnabled: true,
};

describe('per-asset accounting setup UX', () => {
  it('shows crypto rows from capabilities when stablecoinSettlementsEnabled is false (EVM-only)', () => {
    const capabilities = evmCapabilities(['USDC', 'USDT']);

    expect(shouldShowCryptoSettlementAccounts(evmOnlyRails, {}, capabilities)).toBe(true);
    expect(shouldShowCryptoSettlementStrategyUi(evmOnlyRails, capabilities)).toBe(true);

    const definitions = getSettlementAccountsForUi(
      { crypto_settlement_strategy: 'per_asset' },
      evmOnlyRails,
      capabilities
    );

    expect(definitions.map((item) => item.accountName)).toEqual([
      STRIPE_HOLDING.accountName,
      'USDC Holding',
      'USDT Holding',
    ]);
  });

  it('uses per-asset banner copy — not Digital Asset Holding', () => {
    const capabilities = evmCapabilities(['USDC', 'USDT']);
    const summary = buildPaymentTokenAccountingSummary(
      { crypto_settlement_strategy: 'per_asset' },
      capabilities,
      'per_asset'
    );

    expect(summary).toBe(
      'USDC and USDT are enabled for payments, but their Xero holding accounts still need to be linked.'
    );
    expect(summary).not.toContain('Digital Asset Holding');
  });

  it('shared strategy → Digital Asset Holding', () => {
    const capabilities = evmCapabilities(['USDC', 'USDT']);
    const shared = getSettlementAccountsForUi(
      { crypto_settlement_strategy: 'shared' },
      evmRailsWithStablecoinFlag,
      capabilities
    );
    expect(shared.some((item) => item.accountName === SHARED_DIGITAL_HOLDING.accountName)).toBe(true);
    expect(shared.some((item) => item.accountName === 'USDC Holding')).toBe(false);
  });

  it('switching strategy updates rows immediately (no refresh dependency)', () => {
    const capabilities = evmCapabilities(['USDC', 'USDT']);
    const perAsset = getSettlementAccountsForUi(
      { crypto_settlement_strategy: 'per_asset' },
      evmOnlyRails,
      capabilities
    );
    const shared = getSettlementAccountsForUi(
      { crypto_settlement_strategy: 'shared' },
      evmOnlyRails,
      capabilities
    );

    expect(perAsset.map((item) => item.accountName)).toEqual([
      'Stripe Holding',
      'USDC Holding',
      'USDT Holding',
    ]);
    expect(shared.map((item) => item.accountName)).toEqual([
      'Stripe Holding',
      SHARED_DIGITAL_HOLDING.accountName,
    ]);
  });

  it('Hedera per_asset renders HBAR, USDC, USDT, and AUDD holding rows', () => {
    const capabilities = hederaCapabilities();
    const definitions = getSettlementAccountsForUi(
      { crypto_settlement_strategy: 'per_asset' },
      { ...evmOnlyRails, stripeEnabled: false, stablecoinSettlementsEnabled: true },
      capabilities
    );

    expect(definitions.map((item) => item.accountName)).toEqual([
      'HBAR Holding',
      'USDC Holding',
      'USDT Holding',
      'AUDD Holding',
    ]);
  });

  it.each([
    ['USDC Holding', '1052'],
    ['USDT Holding', '1053'],
    ['HBAR Holding', '1051'],
    ['AUDD Holding', '1054'],
  ] as const)('missing %s → create_in_xero with code %s guide', (accountName, code) => {
    const definition = {
      id: accountName.toLowerCase().replace(/\s+/g, '-'),
      kind: 'per_asset' as const,
      title: accountName,
      accountName,
      mappingField: 'xero_usdc_clearing_account_id' as const,
      suggestedCode: code,
      paymentAsset: accountName.replace(' Holding', ''),
      paymentRail: 'crypto',
    };

    const recommendation = resolvePaymentAccountRecommendation(
      [{ code: '090', name: 'Prepayments', type: 'CURRENT', status: 'ACTIVE' }],
      definition
    );

    expect(recommendation.status).toBe('create_in_xero');
    expect(recommendation.recommendedAccount).toBeNull();

    const guide = resolveCreateAccountInXeroGuide({ accountName });
    expect(isDetailedHoldingAccountGuide(guide)).toBe(true);
    if (isDetailedHoldingAccountGuide(guide)) {
      expect(guide.createFields.find((field) => field.label === 'Name')?.value).toBe(accountName);
      expect(guide.createFields.find((field) => field.label === 'Code')?.value).toBe(
        `${code} if available`
      );
    }
  });

  it('newly created Xero account can be linked after refresh', () => {
    const definition = {
      id: 'per-asset-usdc',
      kind: 'per_asset' as const,
      title: 'USDC Holding',
      accountName: 'USDC Holding',
      mappingField: 'xero_usdc_clearing_account_id' as const,
      suggestedCode: '1052',
      paymentAsset: 'USDC',
      paymentRail: 'crypto',
    };

    const beforeRefresh = resolvePaymentAccountRecommendation(
      [{ code: '090', name: 'Prepayments', type: 'CURRENT', status: 'ACTIVE' }],
      definition
    );
    expect(beforeRefresh.status).toBe('create_in_xero');

    const afterRefresh = resolvePaymentAccountRecommendation(
      [
        { code: '090', name: 'Prepayments', type: 'CURRENT', status: 'ACTIVE' },
        { code: '1052', name: 'USDC Holding', type: 'CURRENT', status: 'ACTIVE' },
      ],
      definition
    );

    expect(afterRefresh.status).toBe('found');
    expect(afterRefresh.recommendedAccount?.code).toBe('1052');
  });
});
