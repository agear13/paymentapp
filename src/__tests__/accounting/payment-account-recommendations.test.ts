import {
  buildPaymentAccountUiGroups,
  getPaymentFlowSteps,
  resolvePaymentAccountRecommendation,
} from '@/lib/accounting/payment-account-recommendations';
import { STRIPE_HOLDING, WISE_HOLDING, SHARED_DIGITAL_HOLDING } from '@/lib/accounting/settlement-account-config';

describe('resolvePaymentAccountRecommendation', () => {
  const chart = [
    { code: '1050', name: 'Stripe Holding', type: 'CURRENT', status: 'ACTIVE' },
    { code: '1055', name: 'Wise Holding', type: 'CURRENT', status: 'ACTIVE' },
    { code: '1060', name: 'Digital Asset Holding', type: 'CURRENT', status: 'ACTIVE' },
    { code: '1200', name: 'Stripe Clearing', type: 'CURRENT', status: 'ACTIVE' },
    { code: '9999', name: 'Suspense Account', type: 'CURRENT', status: 'ACTIVE' },
    { code: '8888', name: 'Clearing Account', type: 'CURRENT', status: 'ACTIVE' },
  ];

  const stripeDefinition = {
    id: 'stripe',
    kind: 'rail',
    title: 'Stripe Holding',
    accountName: STRIPE_HOLDING.accountName,
    mappingField: STRIPE_HOLDING.mappingField,
    suggestedCode: STRIPE_HOLDING.suggestedCode,
    paymentRail: 'stripe',
  };

  it('matches Stripe Holding by exact name', () => {
    const result = resolvePaymentAccountRecommendation(chart, stripeDefinition);

    expect(result.status).toBe('found');
    expect(result.recommendedAccount?.code).toBe('1050');
    expect(result.matchReason).toContain('Exact name match');
    expect(result.reconciliationExplanation).toContain('card payments');
    expect(result.confidenceIndicators.find((i) => i.id === 'found')?.active).toBe(true);
    expect(result.confidenceIndicators.find((i) => i.id === 'provvy')?.active).toBe(true);
  });

  it('matches legacy Stripe Clearing name with explanation', () => {
    const legacyChart = chart.filter((account) => account.code !== '1050');
    const result = resolvePaymentAccountRecommendation(legacyChart, stripeDefinition);

    expect(result.recommendedAccount?.code).toBe('1200');
    expect(result.matchReason).toContain('Similar name found');
    expect(result.status).toBe('found');
  });

  it('prefers rail-specific clearing over generic suspense account', () => {
    const genericChart = chart.filter(
      (account) => account.code !== '1050' && account.code !== '1200'
    );
    const result = resolvePaymentAccountRecommendation(genericChart, stripeDefinition);

    expect(result.recommendedAccount?.name).not.toBe('Suspense Account');
  });

  it('matches Suspense Account as fallback when no rail-specific account exists', () => {
    const sparseChart = [
      { code: '9999', name: 'Suspense Account', type: 'CURRENT', status: 'ACTIVE' },
    ];
    const result = resolvePaymentAccountRecommendation(sparseChart, stripeDefinition);

    expect(result.recommendedAccount?.code).toBe('9999');
    expect(result.matchReason).toContain('Generic clearing account');
  });

  it('prompts to create account when missing from chart', () => {
    const result = resolvePaymentAccountRecommendation([], {
      id: 'wise',
      kind: 'rail',
      title: 'Wise Holding',
      accountName: WISE_HOLDING.accountName,
      mappingField: WISE_HOLDING.mappingField,
      suggestedCode: WISE_HOLDING.suggestedCode,
      paymentRail: 'wise',
    });

    expect(result.status).toBe('create_in_xero');
    expect(result.recommendedAccount).toBeNull();
    expect(result.actionableGuidance).toContain('Create "Wise Holding"');
    expect(result.confidenceIndicators.find((i) => i.id === 'found')?.active).toBe(false);
  });

  it('flags update_mapping when saved code is missing from chart', () => {
    const result = resolvePaymentAccountRecommendation(chart, stripeDefinition, '7777');

    expect(result.status).toBe('update_mapping');
  });

  it('provides crypto flow steps for digital asset holding', () => {
    const steps = getPaymentFlowSteps({
      id: 'shared',
      kind: 'shared_digital',
      title: 'Digital Asset Holding',
      accountName: SHARED_DIGITAL_HOLDING.accountName,
      mappingField: SHARED_DIGITAL_HOLDING.mappingField,
      suggestedCode: SHARED_DIGITAL_HOLDING.suggestedCode,
      paymentRail: 'crypto',
    });

    expect(steps.map((s) => s.label)).toEqual([
      'Customer pays',
      SHARED_DIGITAL_HOLDING.accountName,
      'Wallet / Exchange',
      'Optional conversion',
      'Accountant reconciliation',
    ]);
    expect(steps[3]?.optional).toBe(true);
  });

  it('provides standard flow steps for stripe', () => {
    const steps = getPaymentFlowSteps(stripeDefinition);

    expect(steps.map((s) => s.label)).toEqual([
      'Customer pays',
      'Stripe Holding',
      'Bank account',
      'Automatic reconciliation',
    ]);
  });
});

describe('buildPaymentAccountUiGroups', () => {
  it('defaults crypto to shared digital holding in primary section', () => {
    const groups = buildPaymentAccountUiGroups(
      {},
      {
        stripeEnabled: false,
        wiseEnabled: false,
        stablecoinSettlementsEnabled: true,
        manualBankEnabled: true,
      }
    );

    expect(groups.primary.some((item) => item.accountName === SHARED_DIGITAL_HOLDING.accountName)).toBe(
      true
    );
    expect(groups.advancedPerAsset.length).toBe(4);
    expect(groups.cryptoStrategy).toBe('shared');
  });

  it('includes stripe and wise rails when enabled', () => {
    const groups = buildPaymentAccountUiGroups(
      {},
      {
        stripeEnabled: true,
        wiseEnabled: false,
        stablecoinSettlementsEnabled: false,
        manualBankEnabled: true,
      }
    );

    expect(groups.primary.map((item) => item.accountName)).toEqual([
      STRIPE_HOLDING.accountName,
      WISE_HOLDING.accountName,
    ]);
    expect(groups.primary.map((item) => item.title)).toEqual([
      'Stripe Holding',
      'Wise Holding',
    ]);
  });
});
