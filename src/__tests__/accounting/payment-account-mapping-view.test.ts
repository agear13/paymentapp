import {
  applyRecommendedPaymentMappings,
  buildPaymentAccountMappingView,
  countLinkableRecommendedAccounts,
} from '@/lib/accounting/payment-account-mapping-view';
import { STRIPE_HOLDING, WISE_HOLDING } from '@/lib/accounting/settlement-account-config';

const stripeDefinition = {
  id: 'stripe',
  kind: 'rail' as const,
  title: 'Stripe Holding',
  accountName: STRIPE_HOLDING.accountName,
  mappingField: STRIPE_HOLDING.mappingField,
  suggestedCode: STRIPE_HOLDING.suggestedCode,
  paymentRail: 'stripe',
};

const wiseDefinition = {
  id: 'wise',
  kind: 'rail' as const,
  title: 'Wise Holding',
  accountName: WISE_HOLDING.accountName,
  mappingField: WISE_HOLDING.mappingField,
  suggestedCode: WISE_HOLDING.suggestedCode,
  paymentRail: 'wise',
};

const chart = [
  { code: '1050', name: 'Stripe Holding', type: 'CURRENT', status: 'ACTIVE' },
  { code: '090', name: 'Prepayments', type: 'CURRENT', status: 'ACTIVE' },
  { code: '200', name: 'Sales', type: 'REVENUE', status: 'ACTIVE' },
];

describe('buildPaymentAccountMappingView', () => {
  it('is linked only when the saved mapping resolves to a current Xero account', () => {
    const view = buildPaymentAccountMappingView(chart, stripeDefinition, '1050');

    expect(view.state).toBe('linked');
    expect(view.complete).toBe(true);
    expect(view.showLinkedLabel).toBe(true);
    expect(view.showFoundInXero).toBe(false);
    expect(view.badgeLabel).toBe('Linked');
    expect(view.displayState).toBe('configured');
  });

  it('is recommended_found when a chart match exists but nothing is saved', () => {
    const view = buildPaymentAccountMappingView(chart, stripeDefinition);

    expect(view.state).toBe('recommended_found');
    expect(view.complete).toBe(false);
    expect(view.showLinkedLabel).toBe(false);
    expect(view.showFoundInXero).toBe(true);
    expect(view.badgeLabel).toBe('Found in Xero');
    expect(view.displayState).toBe('required');
  });

  it('is stale_mapping when the saved code is missing from the chart', () => {
    const view = buildPaymentAccountMappingView(chart, stripeDefinition, '7777');

    expect(view.state).toBe('stale_mapping');
    expect(view.complete).toBe(false);
    expect(view.showLinkedLabel).toBe(false);
    expect(view.showStaleWarning).toBe(true);
    expect(view.badgeLabel).toBe('Needs attention');
    expect(view.displayState).toBe('needs_review');
  });

  it('does not call creation required when a suitable existing account can be linked', () => {
    const view = buildPaymentAccountMappingView(chart, wiseDefinition);

    expect(view.state).toBe('needs_create');
    expect(view.createIsRequired).toBe(false);
    expect(view.hasSuitableExistingAccounts).toBe(true);
    expect(view.badgeLabel).toBe('Not in Xero');
  });

  it('marks creation required only when no suitable existing account exists', () => {
    const view = buildPaymentAccountMappingView([], wiseDefinition);

    expect(view.state).toBe('needs_create');
    expect(view.createIsRequired).toBe(true);
  });

  it('lists other picker accounts separately from the current linked account', () => {
    const view = buildPaymentAccountMappingView(chart, stripeDefinition, '1050');

    expect(view.otherPickerAccounts.map((account) => account.code)).toEqual(['090']);
    expect(view.preferredTypeAccounts.map((account) => account.code)).toEqual(['1050', '090']);
  });
});

describe('applyRecommendedPaymentMappings', () => {
  it('links empty recommendations and repairs stale mappings without overwriting linked ones', () => {
    const result = applyRecommendedPaymentMappings(
      [
        ...chart,
        { code: '1055', name: 'Wise Holding', type: 'CURRENT', status: 'ACTIVE' },
      ],
      [stripeDefinition, wiseDefinition],
      {
        [STRIPE_HOLDING.mappingField]: '1050',
        [WISE_HOLDING.mappingField]: '7777',
      }
    );

    expect(result.alreadyLinkedCount).toBe(1);
    expect(result.appliedCount).toBe(1);
    expect(result.nextMappings[WISE_HOLDING.mappingField]).toBe('1055');
    expect(result.nextMappings[STRIPE_HOLDING.mappingField]).toBe('1050');
  });

  it('is idempotent when recommendations are already linked', () => {
    const mappings = {
      [STRIPE_HOLDING.mappingField]: '1050',
    };
    const result = applyRecommendedPaymentMappings(chart, [stripeDefinition], mappings);

    expect(result.appliedCount).toBe(0);
    expect(result.alreadyLinkedCount).toBe(1);
    expect(result.unresolvedCount).toBe(0);
    expect(result.nextMappings).toEqual(mappings);
  });

  it('counts linkable recommended accounts excluding already linked ones', () => {
    const views = [
      buildPaymentAccountMappingView(chart, stripeDefinition),
      buildPaymentAccountMappingView(chart, stripeDefinition, '1050'),
    ];

    expect(countLinkableRecommendedAccounts(views)).toBe(1);
  });
});
