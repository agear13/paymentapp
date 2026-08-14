import { getSettlementAccountsForUi } from '@/lib/accounting/settlement-account-ui';
import {
  resolvePaymentAccountRecommendation,
} from '@/lib/accounting/payment-account-recommendations';
import { WISE_HOLDING } from '@/lib/accounting/settlement-account-config';
import {
  isDetailedHoldingAccountGuide,
  resolveCreateAccountInXeroGuide,
} from '@/lib/xero/xero-holding-account-guides';
import { resolveSettlementAccount } from '@/lib/accounting/settlement-account-resolver';

describe('Wise accounting setup UX', () => {
  const stripeOnlyRails = {
    stripeEnabled: true,
    wiseEnabled: false,
    stablecoinSettlementsEnabled: false,
    manualBankEnabled: false,
  };

  const wiseRails = {
    stripeEnabled: true,
    wiseEnabled: true,
    stablecoinSettlementsEnabled: false,
    manualBankEnabled: false,
  };

  it('requires Wise Holding when Wise is enabled', () => {
    const definitions = getSettlementAccountsForUi({}, wiseRails, {
      hederaConfigured: false,
      evmConfigured: false,
      enabledSettlementTokens: [],
    });

    expect(definitions.map((item) => item.accountName)).toEqual([
      'Stripe Holding',
      WISE_HOLDING.accountName,
    ]);
  });

  it('does not require Wise Holding when Wise is disabled', () => {
    const definitions = getSettlementAccountsForUi({}, stripeOnlyRails, {
      hederaConfigured: false,
      evmConfigured: false,
      enabledSettlementTokens: [],
    });

    expect(definitions.map((item) => item.accountName)).toEqual(['Stripe Holding']);
  });

  it('missing Wise Holding → create_in_xero with code 1055 guide', () => {
    const definition = getSettlementAccountsForUi({}, wiseRails, {
      hederaConfigured: false,
      evmConfigured: false,
      enabledSettlementTokens: [],
    }).find((item) => item.accountName === WISE_HOLDING.accountName)!;

    const recommendation = resolvePaymentAccountRecommendation(
      [{ code: '090', name: 'Prepayments', type: 'CURRENT', status: 'ACTIVE' }],
      definition
    );

    expect(recommendation.status).toBe('create_in_xero');
    const guide = resolveCreateAccountInXeroGuide({ accountName: WISE_HOLDING.accountName });
    expect(isDetailedHoldingAccountGuide(guide)).toBe(true);
    if (isDetailedHoldingAccountGuide(guide)) {
      expect(guide.createFields.find((field) => field.label === 'Code')?.value).toBe('1055 if available');
    }
  });

  it('Wise does not require crypto holding accounts', () => {
    const definitions = getSettlementAccountsForUi({}, wiseRails, {
      hederaConfigured: false,
      evmConfigured: false,
      enabledSettlementTokens: [],
    });

    expect(definitions.some((item) => item.accountName.includes('USDC'))).toBe(false);
    expect(definitions.some((item) => item.accountName.includes('Digital Asset'))).toBe(false);
  });

  it('resolves Wise payments to xero_wise_clearing_account_id', () => {
    const resolution = resolveSettlementAccount({
      paymentRail: 'wise',
      settings: { xero_wise_clearing_account_id: '1055' },
    });

    expect(resolution.status).toBe('resolved');
    if (resolution.status === 'resolved') {
      expect(resolution.xeroAccountCode).toBe('1055');
      expect(resolution.target.accountName).toBe(WISE_HOLDING.accountName);
    }
  });

  it('allows linking Wise Holding after refresh simulation', () => {
    const definition = getSettlementAccountsForUi({}, wiseRails, {
      hederaConfigured: false,
      evmConfigured: false,
      enabledSettlementTokens: [],
    }).find((item) => item.accountName === WISE_HOLDING.accountName)!;

    const before = resolvePaymentAccountRecommendation(
      [{ code: '090', name: 'Prepayments', type: 'CURRENT', status: 'ACTIVE' }],
      definition
    );
    expect(before.status).toBe('create_in_xero');

    const after = resolvePaymentAccountRecommendation(
      [
        { code: '090', name: 'Prepayments', type: 'CURRENT', status: 'ACTIVE' },
        { code: '1055', name: 'Wise Holding', type: 'CURRENT', status: 'ACTIVE' },
      ],
      definition
    );
    expect(after.status).toBe('found');
    expect(after.recommendedAccount?.code).toBe('1055');
  });
});
