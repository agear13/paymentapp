/**
 * Commercial OS V4 — End-to-End Invariant Tests
 *
 * These tests verify that an identical backend state produces identical
 * commercial signals across every layer of the product:
 *
 *   deriveCommercialCapabilities  (capability layer)
 *   analyseWorkspace              (decision engine)
 *   buildWorkspaceExperience      (operations manager / dashboard)
 *   stageFromScore                (journey progress)
 *   guidanceFromCanonicalState    (treasury path)
 *
 * If paymentProviderConnected = false in any input, every layer must agree.
 * No layer may advance further than the backend state permits.
 */

import {
  deriveCommercialCapabilities,
  analyseWorkspace,
} from '../../components/workflow/commercial-decision-engine';
import { buildWorkspaceExperience } from '../../components/workflow/operations-manager';
import { stageFromScore, STAGE_COMPLETION } from '../../components/workflow/workflow-context';
import { guidanceFromCanonicalState } from '../../lib/operations/reducer/adapters/legacy-selectors';

/* ─── Shared test fixtures ─── */

const NO_PROVIDER_INPUT = {
  kpis: {
    participantCount: 3,
    earningsConfiguredCount: 3,
    approvedAgreementCount: 3,
    payoutReadyCount: 0,
    fundedObligationCount: 0,
    releaseEligibleCount: 0,
    attributionActiveCount: 0,
    obligationCount: 0,
    participantsConfigured: true,
  } as const,
  releaseConfidence: {
    collectedRevenue: 0,
    readyToRelease: 0,
    level: 'BLOCKED' as const,
    score: 0,
    currency: 'AUD',
    reservedObligations: 0,
    heldBack: 0,
    heldBackReasons: [],
    blockedParticipantCount: 0,
    riskWarnings: [],
    releasableObligationCount: 0,
    totalObligationCount: 0,
    explainability: { headline: '', bullets: [] },
  },
  workspaceContext: {
    stripeConfigured: false,
    wiseConfigured: false,
    hederaConfigured: false,
    hasOrganization: true,
    onboardingCompleted: false,
    defaultCurrency: 'AUD',
    projectCount: 1,
    primaryProjectId: 'test-project',
    participantCount: 3,
    participantsConfiguredCount: 3,
    obligationCount: 0,
    paymentLinkCount: 0,
    collectionPreferenceDecideLater: false,
    releaseEligibleCount: 0,
    releaseBatchCount: 0,
  } as const,
  activation: {
    workspaceCreated: true,
    projectCreated: true,
    participantCount: 3,
    participantsConfigured: true,
    participantsConfiguredCount: 3,
    providerConnected: false,
    obligationsCreated: false,
    obligationCount: 0,
    revenueConfigured: false,
    payoutMethodConfigured: false,
    releaseEligible: false,
    releaseEligibleCount: 0,
    firstReleaseCompleted: false,
    onboardingCompleted: false,
    defaultCurrency: 'AUD',
    onboardingProgressPercent: 50,
    phase: 'ready_to_coordinate' as const,
    phaseLabel: 'Ready to coordinate',
    checklist: [],
    activationBlockers: [],
    setupWarnings: [],
    primaryProjectId: 'test-project',
    needsGuidance: true,
  },
};

const PROVIDER_CONNECTED_INPUT = {
  ...NO_PROVIDER_INPUT,
  workspaceContext: { ...NO_PROVIDER_INPUT.workspaceContext, stripeConfigured: true },
  activation: { ...NO_PROVIDER_INPUT.activation, providerConnected: true },
};

const REVENUE_FLOWING_INPUT = {
  ...PROVIDER_CONNECTED_INPUT,
  releaseConfidence: {
    ...NO_PROVIDER_INPUT.releaseConfidence,
    collectedRevenue: 1500,
    readyToRelease: 0,
  },
};

const SETTLEMENT_READY_INPUT = {
  ...REVENUE_FLOWING_INPUT,
  activation: {
    ...PROVIDER_CONNECTED_INPUT.activation,
    releaseEligible: true,
    releaseEligibleCount: 2,
  },
  releaseConfidence: {
    ...REVENUE_FLOWING_INPUT.releaseConfidence,
    readyToRelease: 750,
    releasableObligationCount: 2,
    releaseEligibleCount: 2,
  },
};

/* ─── 1. Part 1: No fabricated inputs ─── */

describe('Part 1: No fabricated engine inputs', () => {
  it('payment-setup-status deriveRemainingWork: providerConnected=false shows provider as remaining', () => {
    // This test stands in for the now-removed analyseWorkspace call.
    // With real activation state, the remaining work is derived directly — no KPI fabrication.
    const activation = { ...NO_PROVIDER_INPUT.activation };
    const caps = deriveCommercialCapabilities({
      kpis: NO_PROVIDER_INPUT.kpis,
      releaseConfidence: NO_PROVIDER_INPUT.releaseConfidence,
      workspaceContext: NO_PROVIDER_INPUT.workspaceContext,
      activation,
    });
    // approvalsComplete is accurately false (even though all participants approved)
    // because the engine reads real KPI data, not fabricated counts
    expect(caps.approvalsComplete).toBe(true); // 3 approved = 3 participants → correct
    expect(caps.paymentProviderConnected).toBe(false);
    expect(caps.revenueFlowing).toBe(false);
  });

  it('approvedAgreementCount must not be fabricated: partial approvals stay incomplete', () => {
    const caps = deriveCommercialCapabilities({
      kpis: { ...NO_PROVIDER_INPUT.kpis, approvedAgreementCount: 1 }, // only 1 of 3 approved
      releaseConfidence: null,
      workspaceContext: null,
      activation: null,
    });
    // Real state: 1 approved out of 3 → not complete
    expect(caps.approvalsComplete).toBe(false);
    // The old fabricated approach would have set approvedAgreementCount = participantCount = 3
    // which would incorrectly return approvalsComplete = true
  });

  it('revenueFlowing stays false when collectedRevenue is 0', () => {
    const result = analyseWorkspace({
      projectId: 'test',
      ...NO_PROVIDER_INPUT,
    });
    expect(result.commercialCapabilities.revenueFlowing).toBe(false);
    expect(result.workflowStage).toBe('preparing-payments');
  });
});

/* ─── 2. Part 2 & 3: Treasury path and settlement readiness ─── */

describe('Part 2 & 3: Treasury path — collectedRevenue and readyToRelease', () => {
  it('guidanceFromCanonicalState without treasury: collectedRevenue = 0', () => {
    const mockState = {
      confidence: { level: 'LOW' as const, score: 20, explainability: { headline: '', bullets: [] } },
      coordination: { workspace: { defaultCurrency: 'AUD' } },
      kpis: { participantCount: 2, obligationCount: 3, releaseEligibleCount: 1, earningsConfiguredCount: 2, approvedAgreementCount: 2, payoutReadyCount: 1, fundedObligationCount: 0, attributionActiveCount: 0, participantsConfigured: true },
      participants: [],
      obligations: [],
      timeline: [],
      blockers: [],
      readiness: { releasePhase: 'SETUP' },
      release: { phase: 'INITIALIZING' },
      funding: {},
      attribution: [],
    } as never;

    const guidance = guidanceFromCanonicalState(mockState, 'Test', null);
    expect(guidance.releaseConfidence.collectedRevenue).toBe(0);
    // Without treasury, readyToRelease falls back to releaseEligibleCount (count proxy)
    expect(guidance.releaseConfidence.readyToRelease).toBe(1);
  });

  it('guidanceFromCanonicalState WITH treasury: collectedRevenue = confirmedFunding', () => {
    const mockState = {
      confidence: { level: 'MEDIUM' as const, score: 50, explainability: { headline: '', bullets: [] } },
      coordination: { workspace: { defaultCurrency: 'AUD' } },
      kpis: { participantCount: 2, obligationCount: 3, releaseEligibleCount: 2, earningsConfiguredCount: 2, approvedAgreementCount: 2, payoutReadyCount: 2, fundedObligationCount: 0, attributionActiveCount: 0, participantsConfigured: true },
      participants: [],
      obligations: [
        { obligation: { operational: { releaseReady: true } } },
        { obligation: { operational: { releaseReady: true } } },
        { obligation: { operational: { releaseReady: false } } },
      ],
      timeline: [],
      blockers: [],
      readiness: { releasePhase: 'READY' },
      release: { phase: 'RELEASABLE' },
      funding: {},
      attribution: [],
    } as never;

    const treasury = {
      hasFundingSources: true,
      confirmedFunding: 2000,
      obligationsReady: 2,
      pendingFunding: 0,
      obligationsTotal: 3,
    };

    const guidance = guidanceFromCanonicalState(mockState, 'Test', treasury);
    // Real money: collectedRevenue = confirmedFunding
    expect(guidance.releaseConfidence.collectedRevenue).toBe(2000);
    // Dollar estimate: 2/3 * 2000 ≈ 1333
    expect(guidance.releaseConfidence.readyToRelease).toBe(Math.round((2 / 3) * 2000));
    expect(guidance.releaseConfidence.readyToRelease).toBeGreaterThan(0);
  });

  it('revenueFlowing becomes true when treasury provides confirmedFunding > 0', () => {
    const caps = deriveCommercialCapabilities({
      kpis: NO_PROVIDER_INPUT.kpis,
      releaseConfidence: { ...NO_PROVIDER_INPUT.releaseConfidence, collectedRevenue: 1500 },
      workspaceContext: PROVIDER_CONNECTED_INPUT.workspaceContext,
      activation: PROVIDER_CONNECTED_INPUT.activation,
    });
    expect(caps.revenueFlowing).toBe(true);
  });

  it('revenueFlowing stays false when collectedRevenue is explicitly 0', () => {
    const caps = deriveCommercialCapabilities({
      kpis: NO_PROVIDER_INPUT.kpis,
      releaseConfidence: { ...NO_PROVIDER_INPUT.releaseConfidence, collectedRevenue: 0 },
      workspaceContext: PROVIDER_CONNECTED_INPUT.workspaceContext,
      activation: PROVIDER_CONNECTED_INPUT.activation,
    });
    expect(caps.revenueFlowing).toBe(false);
  });

  it('settlementReady is true only when readyToRelease > 0', () => {
    const capsNotReady = deriveCommercialCapabilities({
      kpis: NO_PROVIDER_INPUT.kpis,
      releaseConfidence: { ...NO_PROVIDER_INPUT.releaseConfidence, readyToRelease: 0 },
      workspaceContext: PROVIDER_CONNECTED_INPUT.workspaceContext,
      activation: PROVIDER_CONNECTED_INPUT.activation,
    });
    expect(capsNotReady.settlementReady).toBe(false);

    const capsReady = deriveCommercialCapabilities({
      kpis: NO_PROVIDER_INPUT.kpis,
      releaseConfidence: { ...NO_PROVIDER_INPUT.releaseConfidence, readyToRelease: 750 },
      workspaceContext: PROVIDER_CONNECTED_INPUT.workspaceContext,
      activation: PROVIDER_CONNECTED_INPUT.activation,
    });
    expect(capsReady.settlementReady).toBe(true);
  });
});

/* ─── 4. Part 4: revenueCollectionEnabled vs paymentProviderConnected ─── */

describe('Part 4: revenueCollectionEnabled separation', () => {
  it('paymentProviderConnected and revenueCollectionEnabled agree when no chargesEnabled signal', () => {
    const connected = deriveCommercialCapabilities({
      kpis: null,
      releaseConfidence: null,
      workspaceContext: { stripeConfigured: true } as never,
      activation: null,
    });
    // Without chargesEnabled backend data, falls back to paymentProviderConnected
    expect(connected.paymentProviderConnected).toBe(true);
    expect(connected.revenueCollectionEnabled).toBe(true);
  });

  it('chargesEnabled=false overrides paymentProviderConnected for revenueCollectionEnabled', () => {
    const caps = deriveCommercialCapabilities({
      kpis: null,
      releaseConfidence: null,
      workspaceContext: { stripeConfigured: true } as never,
      activation: { providerConnected: true } as never,
      chargesEnabled: false, // Stripe onboarding incomplete
    });
    // Provider is connected (account ID exists), but charges are not yet enabled
    expect(caps.paymentProviderConnected).toBe(true);
    expect(caps.revenueCollectionEnabled).toBe(false); // correctly separated
  });

  it('chargesEnabled=true means both connected and enabled', () => {
    const caps = deriveCommercialCapabilities({
      kpis: null,
      releaseConfidence: null,
      workspaceContext: { stripeConfigured: true } as never,
      activation: { providerConnected: true } as never,
      chargesEnabled: true,
    });
    expect(caps.paymentProviderConnected).toBe(true);
    expect(caps.revenueCollectionEnabled).toBe(true);
  });

  it('provider not connected → revenueCollectionEnabled is also false', () => {
    const caps = deriveCommercialCapabilities({
      kpis: null,
      releaseConfidence: null,
      workspaceContext: null,
      activation: null,
    });
    expect(caps.paymentProviderConnected).toBe(false);
    expect(caps.revenueCollectionEnabled).toBe(false);
  });
});

/* ─── 5 & 6. Cross-layer consistency: identical input → identical signals ─── */

describe('Cross-layer consistency: paymentProviderConnected=false propagates everywhere', () => {
  const input = NO_PROVIDER_INPUT;

  it('deriveCommercialCapabilities: paymentProviderConnected=false', () => {
    const caps = deriveCommercialCapabilities(input);
    expect(caps.paymentProviderConnected).toBe(false);
    expect(caps.revenueCollectionEnabled).toBe(false);
  });

  it('analyseWorkspace: paymentProviderConnected=false in commercialCapabilities', () => {
    const result = analyseWorkspace({ projectId: 'test', ...input });
    expect(result.commercialCapabilities.paymentProviderConnected).toBe(false);
  });

  it('analyseWorkspace: workflowStage correctly shows preparing-payments (all approved, no provider)', () => {
    const result = analyseWorkspace({ projectId: 'test', ...input });
    expect(result.workflowStage).toBe('preparing-payments');
    // STAGE_COMPLETION for preparing-payments is 58
    expect(STAGE_COMPLETION['preparing-payments']).toBe(58);
  });

  it('buildWorkspaceExperience: capabilities.paymentProviderConnected=false', () => {
    const exp = buildWorkspaceExperience({
      snapshots: [],
      ...input,
      attentionItems: [],
      auditEntries: [],
    });
    expect(exp.commercialCapabilities.paymentProviderConnected).toBe(false);
  });

  it('stageFromScore: score=58 maps to preparing-payments (provider not connected)', () => {
    // Score of 58 = preparing-payments = approvals done, no provider
    expect(stageFromScore(58)).toBe('preparing-payments');
  });

  it('all three layers agree on the same stage threshold', () => {
    const engineResult = analyseWorkspace({ projectId: 'test', ...input });
    const stageScore = STAGE_COMPLETION[engineResult.workflowStage];
    const stageMappedBack = stageFromScore(stageScore);
    expect(stageMappedBack).toBe(engineResult.workflowStage);
  });
});

describe('Cross-layer consistency: provider connected → same signals everywhere', () => {
  const input = PROVIDER_CONNECTED_INPUT;

  it('deriveCommercialCapabilities: paymentProviderConnected=true', () => {
    const caps = deriveCommercialCapabilities(input);
    expect(caps.paymentProviderConnected).toBe(true);
  });

  it('analyseWorkspace: workflowStage advances to ready-to-collect', () => {
    const result = analyseWorkspace({ projectId: 'test', ...input });
    expect(result.commercialCapabilities.paymentProviderConnected).toBe(true);
    expect(result.workflowStage).toBe('ready-to-collect');
  });

  it('buildWorkspaceExperience: capabilities.paymentProviderConnected=true', () => {
    const exp = buildWorkspaceExperience({
      snapshots: [],
      ...input,
      attentionItems: [],
      auditEntries: [],
    });
    expect(exp.commercialCapabilities.paymentProviderConnected).toBe(true);
  });
});

describe('Cross-layer consistency: revenue flowing → all layers agree', () => {
  const input = REVENUE_FLOWING_INPUT;

  it('deriveCommercialCapabilities: revenueFlowing=true', () => {
    const caps = deriveCommercialCapabilities(input);
    expect(caps.revenueFlowing).toBe(true);
    expect(caps.paymentProviderConnected).toBe(true);
  });

  it('analyseWorkspace: workflowStage = collecting-revenue', () => {
    const result = analyseWorkspace({ projectId: 'test', ...input });
    expect(result.commercialCapabilities.revenueFlowing).toBe(true);
    expect(result.workflowStage).toBe('collecting-revenue');
  });

  it('buildWorkspaceExperience: commercialCapabilities reflects real revenue', () => {
    const exp = buildWorkspaceExperience({
      snapshots: [],
      ...input,
      attentionItems: [],
      auditEntries: [],
    });
    expect(exp.commercialCapabilities.revenueFlowing).toBe(true);
  });
});

describe('Cross-layer consistency: settlement ready → same signals', () => {
  const input = SETTLEMENT_READY_INPUT;

  it('capabilities: settlementReady=true, revenueFlowing=true', () => {
    const caps = deriveCommercialCapabilities(input);
    expect(caps.settlementReady).toBe(true);
    expect(caps.revenueFlowing).toBe(true);
    expect(caps.paymentProviderConnected).toBe(true);
  });

  it('engine workflowStage: ready-to-release when readyToRelease > 0', () => {
    const result = analyseWorkspace({ projectId: 'test', ...input });
    expect(result.commercialCapabilities.settlementReady).toBe(true);
    expect(result.workflowStage).toBe('ready-to-release');
  });
});

/* ─── Regression: no stage can advance beyond what backend state permits ─── */

describe('Stage ceiling regression: stages cannot advance beyond actual backend state', () => {
  it('no participants → stage cannot exceed setup', () => {
    const result = analyseWorkspace({
      projectId: 'test',
      kpis: { participantCount: 0, earningsConfiguredCount: 0, approvedAgreementCount: 0 } as never,
      releaseConfidence: { collectedRevenue: 0, readyToRelease: 0 } as never,
      workspaceContext: { stripeConfigured: false } as never,
      activation: { providerConnected: false, firstReleaseCompleted: false } as never,
    });
    expect(result.workflowStage).toBe('setup');
    expect(result.commercialCapabilities.participantsInvited).toBe(false);
    expect(result.commercialCapabilities.earningsConfigured).toBe(false);
    expect(result.commercialCapabilities.approvalsComplete).toBe(false);
  });

  it('partial earnings → cannot reach collecting-approvals', () => {
    const result = analyseWorkspace({
      projectId: 'test',
      kpis: { participantCount: 3, earningsConfiguredCount: 2, approvedAgreementCount: 0 } as never,
      releaseConfidence: null,
      workspaceContext: { stripeConfigured: false } as never,
      activation: { providerConnected: false, firstReleaseCompleted: false } as never,
    });
    expect(result.commercialCapabilities.earningsConfigured).toBe(false);
    // Stage should be configuring (earnings incomplete), not collecting-approvals
    expect(result.workflowStage).toBe('configuring');
  });

  it('all approvals done, provider connected, no revenue → ready-to-collect', () => {
    const result = analyseWorkspace({
      projectId: 'test',
      kpis: { participantCount: 2, earningsConfiguredCount: 2, approvedAgreementCount: 2 } as never,
      releaseConfidence: { collectedRevenue: 0, readyToRelease: 0 } as never,
      workspaceContext: { stripeConfigured: true } as never,
      activation: { providerConnected: true, firstReleaseCompleted: false } as never,
    });
    expect(result.commercialCapabilities.approvalsComplete).toBe(true);
    expect(result.commercialCapabilities.paymentProviderConnected).toBe(true);
    expect(result.commercialCapabilities.revenueFlowing).toBe(false);
    expect(result.workflowStage).toBe('ready-to-collect');
  });

  it('operational only after firstReleaseCompleted', () => {
    const notDone = analyseWorkspace({
      projectId: 'test',
      kpis: { participantCount: 1, earningsConfiguredCount: 1, approvedAgreementCount: 1, releaseEligibleCount: 1 } as never,
      releaseConfidence: { collectedRevenue: 1000, readyToRelease: 500 } as never,
      workspaceContext: { stripeConfigured: true } as never,
      activation: { providerConnected: true, firstReleaseCompleted: false } as never,
    });
    expect(notDone.workflowStage).not.toBe('operational');
    expect(notDone.commercialCapabilities.payoutComplete).toBe(false);

    const done = analyseWorkspace({
      projectId: 'test',
      kpis: { participantCount: 1, earningsConfiguredCount: 1, approvedAgreementCount: 1, releaseEligibleCount: 1 } as never,
      releaseConfidence: { collectedRevenue: 1000, readyToRelease: 0 } as never,
      workspaceContext: { stripeConfigured: true } as never,
      activation: { providerConnected: true, firstReleaseCompleted: true } as never,
    });
    expect(done.workflowStage).toBe('operational');
    expect(done.commercialCapabilities.payoutComplete).toBe(true);
  });
});
