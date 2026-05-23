import type { WorkspaceActivationSnapshot } from '@/lib/onboarding/workspace-activation-types';
import {
  arePaymentRailsIncomplete,
  buildPaymentRailNextStep,
  collectionSettlementHref,
  detectContextualRoute,
  derivePaymentRailBlockers,
  resolveContextualNextStep,
  shouldPrioritizePaymentRailsContext,
} from '@/lib/operations/guidance/contextual-next-step';
import { deriveNextRecommendedAction } from '@/lib/onboarding/next-recommended-action';

function activation(partial: Partial<WorkspaceActivationSnapshot>): WorkspaceActivationSnapshot {
  return {
    workspaceCreated: true,
    projectCreated: true,
    participantCount: 1,
    participantsConfigured: false,
    participantsConfiguredCount: 0,
    obligationsCreated: false,
    obligationCount: 0,
    revenueConfigured: false,
    providerConnected: false,
    payoutMethodConfigured: false,
    releaseEligible: false,
    releaseEligibleCount: 0,
    firstReleaseCompleted: false,
    onboardingCompleted: false,
    defaultCurrency: 'AUD',
    onboardingProgressPercent: 40,
    phase: 'setup_in_progress',
    phaseLabel: 'Setup',
    checklist: [],
    activationBlockers: [],
    setupWarnings: [],
    primaryProjectId: 'proj-1',
    needsGuidance: true,
    ...partial,
  };
}

describe('resolveContextualNextStep', () => {
  it('prioritizes payment rails on collection & settlement route when rails incomplete', () => {
    const state = activation({ participantsConfigured: false, providerConnected: false });
    const result = resolveContextualNextStep({
      currentRoute: '/dashboard/settings/merchant',
      workspaceState: state,
      operationalGuidance: deriveNextRecommendedAction(state),
    });

    expect(result?.title).toBe('Complete payment rail setup');
    expect(result?.ctaLabel).toBe('Set up payment rails');
    expect(result?.instructionalOnly).toBe(true);
    expect(result?.blockers).toContain('No payment provider connected');
    expect(result?.href).toBe(collectionSettlementHref());
  });

  it('falls back to earnings guidance after payment rails configured', () => {
    const state = activation({
      participantsConfigured: false,
      providerConnected: true,
      payoutMethodConfigured: true,
      revenueConfigured: true,
    });
    const global = deriveNextRecommendedAction(state);
    const result = resolveContextualNextStep({
      currentRoute: '/dashboard/settings/merchant',
      workspaceState: state,
      operationalGuidance: global,
    });

    expect(result?.id).toBe('compensation');
    expect(result?.title).toContain('earnings');
  });

  it('uses global guidance on participants route', () => {
    const state = activation({ participantsConfigured: false, providerConnected: false });
    const global = deriveNextRecommendedAction(state);
    const result = resolveContextualNextStep({
      currentRoute: '/dashboard/projects/proj-1/participants',
      workspaceState: state,
      operationalGuidance: global,
    });

    expect(result?.id).toBe(global.id);
  });

  it('detects collection settlement routes', () => {
    expect(detectContextualRoute('/dashboard/settings/merchant')).toBe('collection_settlement');
    expect(detectContextualRoute('/settings/collection-settlement')).toBe('collection_settlement');
  });

  it('derives payment rail blockers', () => {
    const blockers = derivePaymentRailBlockers(
      activation({ providerConnected: false, revenueConfigured: false })
    );
    expect(blockers).toEqual([
      'No payment provider connected',
      'Settlement rail incomplete',
      'Revenue collection not ready',
    ]);
  });

  it('shouldPrioritizePaymentRailsContext on merchant page with incomplete rails', () => {
    expect(
      shouldPrioritizePaymentRailsContext(
        '/dashboard/settings/merchant',
        activation({ providerConnected: false })
      )
    ).toBe(true);
    expect(
      shouldPrioritizePaymentRailsContext(
        '/dashboard/settings/merchant',
        activation({ providerConnected: true, payoutMethodConfigured: true })
      )
    ).toBe(false);
  });

  it('buildPaymentRailNextStep uses canonical copy', () => {
    const step = buildPaymentRailNextStep(activation({}));
    expect(step.description).toMatch(/collects customer payments/);
  });
});

describe('arePaymentRailsIncomplete', () => {
  it('returns false when provider and payout method configured', () => {
    expect(
      arePaymentRailsIncomplete(
        activation({ providerConnected: true, payoutMethodConfigured: true })
      )
    ).toBe(false);
  });
});
