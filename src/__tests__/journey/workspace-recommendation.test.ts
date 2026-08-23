import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { GUIDANCE_DESTINATIONS } from '@/lib/journey/guidance-destinations';
import {
  buildWorkspaceRecommendationState,
  deriveWorkspaceRecommendation,
  paymentRailConfiguredFromMerchantRails,
  recommendationSourceLabel,
  type WorkspaceRecommendation,
} from '@/lib/journey/workspace-recommendation';
import { buildWorkspaceAdvisorIntro } from '@/lib/journey/workspace-advisor-intro';

const emptyWorkspace = {
  xeroConnected: false,
  deployedWorkflowSlugs: [] as string[],
};

describe('guidance destinations', () => {
  test('maps each capability to an existing Commercial OS route', () => {
    expect(GUIDANCE_DESTINATIONS.accounting.href).toBe(COMMERCIAL_OS_ROUTES.connected);
    expect(GUIDANCE_DESTINATIONS.payment_rail.href).toBe(COMMERCIAL_OS_ROUTES.paymentsProviders);
    expect(GUIDANCE_DESTINATIONS.settlement.href).toBe(COMMERCIAL_OS_ROUTES.settlement);
    expect(GUIDANCE_DESTINATIONS.participant_earnings.href).toBe(COMMERCIAL_OS_ROUTES.workflows);
    expect(GUIDANCE_DESTINATIONS.workflow.href).toBe(COMMERCIAL_OS_ROUTES.workflows);
    expect(GUIDANCE_DESTINATIONS.branding.href).toBe(COMMERCIAL_OS_ROUTES.payments);
    expect(GUIDANCE_DESTINATIONS.advisor.href).toBe(COMMERCIAL_OS_ROUTES.advisor);
  });

  test('payment rails deep-link to the providers section; branding stays on the page default', () => {
    expect(GUIDANCE_DESTINATIONS.payment_rail.href).toBe('/workspace/payments#payment-providers');
    expect(GUIDANCE_DESTINATIONS.branding.href).toBe('/workspace/payments');
    expect(GUIDANCE_DESTINATIONS.payment_rail.description).toMatch(/payment providers and rails/i);
    expect(GUIDANCE_DESTINATIONS.branding.description).toMatch(/branding/i);
  });

  test('participant earnings does not send users to the settlement commission ledger', () => {
    expect(GUIDANCE_DESTINATIONS.participant_earnings.href).not.toBe(
      COMMERCIAL_OS_ROUTES.settlementEarnings
    );
    expect(GUIDANCE_DESTINATIONS.participant_earnings.description).toMatch(/workflow/i);
  });
});

describe('deriveWorkspaceRecommendation — Xero signals', () => {
  test('Xero plus reconciliation is an optional accounting recommendation', () => {
    const recommendation = deriveWorkspaceRecommendation({
      snapshot: {
        objective: 'reconcile',
        business: { accounting: 'Xero', challenge: 'Manual reconciliation' },
      },
      workspace: emptyWorkspace,
    });

    expect(recommendation?.kind).toBe('accounting');
    expect(recommendation?.source).toBe('setup');
    expect(recommendation?.reason).toBe('manual_reconciliation');
    expect(recommendation?.destination).toBe(COMMERCIAL_OS_ROUTES.connected);
    expect(recommendation?.description).not.toMatch(/coordinating|must|required/i);
  });

  test('reduce-admin + Xero without a reconciliation signal is not Connect Xero', () => {
    const recommendation = deriveWorkspaceRecommendation({
      snapshot: { objective: 'reduce-admin', business: { accounting: 'Xero' } },
      workspace: emptyWorkspace,
    });

    expect(recommendation?.kind).not.toBe('accounting');
    expect(recommendation?.title).not.toMatch(/Xero/i);
    expect(recommendation?.kind).toBe('workflow');
    expect(recommendation?.reason).toBe('explore_workflows');
  });

  test('reduce-admin + Xero + manual reconciliation may recommend Xero', () => {
    const recommendation = deriveWorkspaceRecommendation({
      snapshot: {
        objective: 'reduce-admin',
        business: { accounting: 'Xero', challenge: 'Manual reconciliation' },
      },
      workspace: emptyWorkspace,
    });

    expect(recommendation?.kind).toBe('accounting');
    expect(recommendation?.reason).toBe('manual_reconciliation');
  });

  test('Xero + forecast is not Connect Xero', () => {
    const recommendation = deriveWorkspaceRecommendation({
      snapshot: { objective: 'forecast', business: { accounting: 'Xero' } },
      workspace: emptyWorkspace,
    });

    expect(recommendation?.kind).not.toBe('accounting');
    expect(recommendation?.reason).toBe('forecasting_workflow');
  });

  test('Xero + reporting is not Connect Xero', () => {
    const recommendation = deriveWorkspaceRecommendation({
      snapshot: { objective: 'reporting', business: { accounting: 'Xero' } },
      workspace: emptyWorkspace,
    });

    expect(recommendation?.kind).not.toBe('accounting');
    expect(recommendation?.reason).toBe('reporting_workflow');
  });

  test('Xero + revenue-share is not Connect Xero unless another accounting signal independently wins', () => {
    const recommendation = deriveWorkspaceRecommendation({
      snapshot: { objective: 'revenue-share', business: { accounting: 'Xero' } },
      workspace: emptyWorkspace,
    });

    expect(recommendation?.kind).not.toBe('accounting');
    expect(recommendation?.reason).toBe('revenue_share');
  });

  test.each(['MYOB', 'QuickBooks', 'NetSuite', 'None / Spreadsheets'])(
    'does not recommend Xero when accounting is %s',
    (accounting) => {
      const recommendation = deriveWorkspaceRecommendation({
        snapshot: { objective: 'reconcile', business: { accounting } },
        workspace: emptyWorkspace,
      });

      expect(recommendation?.kind).not.toBe('accounting');
      expect(recommendation?.title).not.toMatch(/Xero/i);
      expect(recommendation?.destination).not.toBe(COMMERCIAL_OS_ROUTES.connected);
    }
  );

  test('does not recommend connecting Xero after it is already connected', () => {
    const recommendation = deriveWorkspaceRecommendation({
      snapshot: { objective: 'reconcile', business: { accounting: 'Xero' } },
      workspace: { ...emptyWorkspace, xeroConnected: true },
    });

    expect(recommendation?.kind).not.toBe('accounting');
  });
});

describe('deriveWorkspaceRecommendation — objective-first overlaps', () => {
  test('A: paid-faster + Xero + manual reconciliation prefers payment rails', () => {
    const recommendation = deriveWorkspaceRecommendation({
      snapshot: {
        objective: 'paid-faster',
        business: { accounting: 'Xero', challenge: 'Manual reconciliation' },
      },
      workspace: emptyWorkspace,
    });

    expect(recommendation?.kind).toBe('payment_rail');
    expect(recommendation?.reason).toBe('payment_collection');
    expect(recommendation?.destination).toBe(COMMERCIAL_OS_ROUTES.paymentsProviders);
  });

  test('B: revenue-share + Stripe or late payments prefers the revenue-share workflow', () => {
    const withStripe = deriveWorkspaceRecommendation({
      snapshot: {
        objective: 'revenue-share',
        business: { systems: ['Stripe'] },
      },
      workspace: emptyWorkspace,
    });
    const withLatePayments = deriveWorkspaceRecommendation({
      snapshot: {
        objective: 'revenue-share',
        business: { challenge: 'Late payments', systems: ['GoCardless'] },
      },
      workspace: emptyWorkspace,
    });

    expect(withStripe?.reason).toBe('revenue_share');
    expect(withLatePayments?.reason).toBe('revenue_share');
    expect(withStripe?.kind).not.toBe('payment_rail');
    expect(withLatePayments?.kind).not.toBe('payment_rail');
    expect(withStripe?.destination).toBe(COMMERCIAL_OS_ROUTES.workflows);
  });

  test('C: revenue-share + Xero + manual reconciliation prefers the revenue-share workflow', () => {
    const recommendation = deriveWorkspaceRecommendation({
      snapshot: {
        objective: 'revenue-share',
        business: { accounting: 'Xero', challenge: 'Manual reconciliation' },
      },
      workspace: emptyWorkspace,
    });

    expect(recommendation?.reason).toBe('revenue_share');
    expect(recommendation?.kind).not.toBe('accounting');
    expect(recommendation?.destination).toBe(COMMERCIAL_OS_ROUTES.workflows);
    expect(recommendation?.title).toMatch(/revenue-sharing workflow/i);
    expect(recommendation?.destination).not.toBe(COMMERCIAL_OS_ROUTES.settlementEarnings);
  });

  test('D: reconcile or reduce-admin + Stripe + no Xero does not recommend payment rails', () => {
    const reconcile = deriveWorkspaceRecommendation({
      snapshot: { objective: 'reconcile', business: { systems: ['Stripe'] } },
      workspace: emptyWorkspace,
    });
    const reduceAdmin = deriveWorkspaceRecommendation({
      snapshot: { objective: 'reduce-admin', business: { systems: ['Stripe'] } },
      workspace: emptyWorkspace,
    });

    expect(reconcile?.kind).toBe('workflow');
    expect(reconcile?.reason).toBe('explore_workflows');
    expect(reduceAdmin?.kind).toBe('workflow');
    expect(reconcile?.kind).not.toBe('payment_rail');
    expect(reduceAdmin?.kind).not.toBe('payment_rail');
  });
});

describe('deriveWorkspaceRecommendation — other setup cases', () => {
  test('paid-faster recommends payment rails even if the user also uses Xero', () => {
    const recommendation = deriveWorkspaceRecommendation({
      snapshot: {
        objective: 'paid-faster',
        business: { accounting: 'Xero', challenge: 'Late payments', systems: ['Stripe'] },
      },
      workspace: emptyWorkspace,
    });

    expect(recommendation).toMatchObject({
      kind: 'payment_rail',
      source: 'setup',
      reason: 'payment_collection',
      destination: COMMERCIAL_OS_ROUTES.paymentsProviders,
    });
  });

  test('skips payment rails once a rail is already configured', () => {
    const recommendation = deriveWorkspaceRecommendation({
      snapshot: { objective: 'paid-faster', business: { systems: ['Stripe'] } },
      workspace: { ...emptyWorkspace, paymentRailConfigured: true },
    });

    expect(recommendation?.kind).not.toBe('payment_rail');
  });

  test('forecast recommends a workflow without forcing it as a prerequisite', () => {
    const recommendation = deriveWorkspaceRecommendation({
      snapshot: { objective: 'forecast', business: { industry: 'Hospitality' } },
      workspace: emptyWorkspace,
    });

    expect(recommendation?.kind).toBe('workflow');
    expect(recommendation?.reason).toBe('forecasting_workflow');
    expect(recommendation?.destination).toBe(COMMERCIAL_OS_ROUTES.workflowDetail('cashflow-forecasting'));
    expect(recommendation?.description).toMatch(/not required/i);
  });

  test('skips a workflow recommendation once that workflow is already installed', () => {
    const recommendation = deriveWorkspaceRecommendation({
      snapshot: { objective: 'forecast', business: null },
      workspace: { ...emptyWorkspace, deployedWorkflowSlugs: ['cashflow-forecasting'] },
    });

    expect(recommendation).toBeNull();
  });

  test('returns no recommendation when there is no setup context', () => {
    expect(
      deriveWorkspaceRecommendation({
        snapshot: { objective: null, business: null },
        workspace: emptyWorkspace,
      })
    ).toBeNull();
  });

  test('does not invent a branding recommendation without a setup signal', () => {
    const recommendation = deriveWorkspaceRecommendation({
      snapshot: { objective: 'reporting', business: { industry: 'Construction / Trades' } },
      workspace: emptyWorkspace,
    });

    expect(recommendation?.kind).not.toBe('branding');
  });
});

describe('setup vs observed recommendation source', () => {
  test('current recommendations are setup-sourced and distinguishable from observed', () => {
    const recommendation = deriveWorkspaceRecommendation({
      snapshot: { objective: 'paid-faster', business: null },
      workspace: emptyWorkspace,
    });

    expect(recommendation?.source).toBe('setup');
    expect(recommendationSourceLabel(recommendation)).toBe('Based on what you told us during setup');

    const observed: WorkspaceRecommendation = {
      ...recommendation!,
      source: 'observed',
    };
    expect(observed.source).not.toBe(recommendation?.source);
    expect(recommendationSourceLabel(observed)).toBeNull();
  });
});

describe('Workspace and Advisor share one recommendation', () => {
  test('Advisor intro recommendation equals deriveWorkspaceRecommendation for the same input', () => {
    const snapshot = {
      objective: 'revenue-share',
      business: { accounting: 'Xero', systems: ['Stripe'] },
    };
    const workspace = emptyWorkspace;

    const derived = deriveWorkspaceRecommendation({ snapshot, workspace });
    const intro = buildWorkspaceAdvisorIntro({ snapshot, workspace });

    expect(intro.recommendation).toEqual(derived);
  });
});

describe('paymentRailConfiguredFromMerchantRails', () => {
  test('treats unknown rails as unknown, not configured', () => {
    expect(paymentRailConfiguredFromMerchantRails(undefined)).toBeUndefined();
    expect(
      paymentRailConfiguredFromMerchantRails({
        stripeEnabled: false,
        wiseEnabled: false,
        stablecoinSettlementsEnabled: false,
        manualBankEnabled: false,
      })
    ).toBe(false);
    expect(paymentRailConfiguredFromMerchantRails({ stripeEnabled: true })).toBe(true);
  });

  test('buildWorkspaceRecommendationState only marks rails when readiness is known', () => {
    expect(
      buildWorkspaceRecommendationState({
        xeroConnected: false,
        deployedWorkflowSlugs: [],
        readinessKnown: false,
        merchantRails: { stripeEnabled: true },
      }).paymentRailConfigured
    ).toBeUndefined();
    expect(
      buildWorkspaceRecommendationState({
        xeroConnected: false,
        deployedWorkflowSlugs: [],
        readinessKnown: true,
        merchantRails: { stripeEnabled: true },
      }).paymentRailConfigured
    ).toBe(true);
  });
});
