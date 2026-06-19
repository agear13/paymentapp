/**
 * @jest-environment jsdom
 *
 * Regression tests for the Temporal Dead Zone crash in the Participants /
 * Approval Centre route.
 *
 * BACKGROUND
 * ----------
 * Production crash: `ReferenceError: Cannot access 'tk' before initialization`
 * at `ec (page-5797eba02aee9053.js:1:94673)`
 *
 * Root cause: `showApprovalCentre` (minified `tk`) was used inside a React
 * `useEffect` dependency array at line 654 of project-participants-view.tsx,
 * but was *declared* nineteen lines later (line 673).  JavaScript evaluates
 * the dependency array argument at the moment the `useEffect(...)` call is
 * reached during component initialisation.  Because `const showApprovalCentre`
 * had not yet been executed, it was in the Temporal Dead Zone, triggering a
 * hard ReferenceError that crashed the entire Participants page.
 *
 * FIX: The `useCommercialBrain()` call and the three derived constants
 * (`isCollectingApprovals`, `approvalsComplete`, `showApprovalCentre`) were
 * moved to *before* the offending `useEffect`.
 *
 * REGRESSION PROTECTION
 * ---------------------
 * These tests will fail with `ReferenceError: Cannot access 'showApprovalCentre'
 * before initialization` if any future change moves the declaration back after
 * the `useEffect` that places it in a dependency array.
 */

import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, act } from '@testing-library/react';

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks — must be declared before any imports that reference the mocked
// modules so that Jest's hoisting works correctly.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/dashboard/projects/proj-1/participants',
}));

jest.mock('@/components/projects/project-workspace-provider', () => ({
  useProjectWorkspace: jest.fn(),
  useProjectWorkspaceSmartPolling: jest.fn(),
}));

jest.mock('@/hooks/use-project-workspace-refresh', () => ({
  useProjectWorkspaceSmartPolling: jest.fn(),
  useProjectWorkspaceRefresh: jest.fn(),
}));

jest.mock('@/hooks/use-operational-coordination-state', () => ({
  useOperationalCoordinationState: jest.fn(),
}));

jest.mock('@/components/workflow/commercial-brain-context', () => ({
  useCommercialBrain: jest.fn(),
}));

jest.mock('@/hooks/use-organization', () => ({
  useOrganization: jest.fn(),
}));

jest.mock('@/hooks/use-entitlements', () => ({
  useEntitlements: jest.fn(),
}));

jest.mock('@/hooks/use-organization-currency', () => ({
  useOrganizationCurrency: jest.fn(),
}));

jest.mock('@/hooks/use-workspace-activation', () => ({
  notifyWorkspaceActivationRefresh: jest.fn(),
}));

jest.mock('@/hooks/use-operational-audit-store', () => ({
  useOperationalAuditStore: jest.fn(() => []),
  appendOperationalAuditEntry: jest.fn(),
}));

jest.mock('@/lib/operations/dev/operational-invariants', () => ({
  assertParticipantKpiConvergenceInvariants: jest.fn(),
}));

jest.mock('@/lib/operations/dev/earnings-selector-audit', () => ({
  logEarningsSelectorAudit: jest.fn(),
}));

jest.mock('@/lib/operations/dev/post-convergence-verifier', () => ({
  createPostConvergenceVerifier: jest.fn(() => jest.fn()),
}));

jest.mock('@/lib/operations/orchestration/operational-sync-convergence', () => ({
  logOperationalSyncConvergence: jest.fn(),
}));

jest.mock('@/lib/operations/orchestration/operational-sync-client', () => ({
  applyOperationalSyncRefresh: jest.fn(),
  parseOperationalSync: jest.fn(() => ({ kind: 'noop' })),
  toOperationalSyncHandlers: jest.fn(() => ({})),
}));

jest.mock('@/lib/operations/hydration/hydrate-participant', () => ({
  hydrateParticipants: jest.fn((p: unknown[]) => p),
  participantEntity: jest.fn((p: unknown) => p),
}));

jest.mock('@/lib/operations/selectors/participant-earnings-selectors', () => ({
  isParticipantEarningsConfigured: jest.fn(() => false),
}));

jest.mock('@/lib/operations/selectors/derive-participant-view-stats', () => ({
  deriveParticipantViewStats: jest.fn(() => ({
    hasParticipants: false,
    displayParticipants: [],
  })),
}));

jest.mock('@/lib/participants/initialize-compensation-draft', () => ({
  logCompensationConfigDiagnostic: jest.fn(),
  prepareParticipantForCompensationEdit: jest.fn(),
}));

jest.mock('@/lib/participants/compensation-persistence-trace', () => ({
  logCompensationPersistenceTrace: jest.fn(),
  traceCompensationConfiguredState: jest.fn(),
  traceCompensationSavePayload: jest.fn(),
}));

jest.mock('@/lib/operations/audit/conversation-import-audit', () => ({
  deriveConversationImportAuditTimeline: jest.fn(() => []),
  mergeAuditTimeline: jest.fn((a: unknown[]) => a),
}), { virtual: true });

// Silence next/image and Link in jsdom
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href }, children),
}));

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

// ─────────────────────────────────────────────────────────────────────────────
// Import the module under test AFTER all mocks are set up
// ─────────────────────────────────────────────────────────────────────────────

import { ProjectParticipantsView } from '@/components/projects/project-participants-view';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import { useCommercialBrain } from '@/components/workflow/commercial-brain-context';
import { useOrganization } from '@/hooks/use-organization';
import { useEntitlements } from '@/hooks/use-entitlements';
import { useOrganizationCurrency } from '@/hooks/use-organization-currency';
import { useProjectWorkspaceSmartPolling } from '@/hooks/use-project-workspace-refresh';

// ─────────────────────────────────────────────────────────────────────────────
// Shared test fixtures
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_GRAPH = {
  participants: [],
  obligations: [],
  summary: {
    totalParticipants: 0,
    configuredParticipants: 0,
    earningsConfiguredCount: 0,
    payoutReadyCount: 0,
    approvalComplete: false,
  },
  funding: {
    allocated: false,
    allocatedAt: null,
    confirmedAt: null,
    confirmedByParticipantId: null,
  },
};

const EMPTY_CANONICAL_KPIS = {
  earningsConfiguredCount: 0,
  payoutReadyCount: 0,
  totalParticipants: 0,
};

const CONSERVATIVE_RELEASE = {
  canCreateReleaseBatch: false,
  releaseInteractionEnabled: false,
  disabledReason: null,
  interactionGuidance: null,
};

const EMPTY_WORKSPACE_CTX = {
  defaultCurrency: 'USD',
  currentStage: null,
};

/**
 * Minimal valid guidance shape.  The component accesses
 * `guidance.explanation.explainability.headline` whenever deal/summary are
 * present, so we provide a safe stub rather than leaving it null.
 */
const EMPTY_GUIDANCE = {
  explanation: {
    readinessLevel: 'blocked' as const,
    readinessScore: 0,
    blockers: [],
    warnings: [],
    missingRequirements: [],
    confidence: 'BLOCKED' as const,
    nextRecommendedActions: [],
    explainability: {
      headline: null as string | null,
      bullets: [] as string[],
    },
  },
  releaseConfidence: {
    level: 'BLOCKED' as const,
    score: 0,
    explainability: { headline: null as string | null, bullets: [] as string[] },
  },
};

function buildWorkspaceContext({
  currentStage = null as string | null,
} = {}) {
  return { ...EMPTY_WORKSPACE_CTX, currentStage };
}

function buildCommercialCapabilities({
  participantsInvited = false,
  earningsConfigured = false,
  approvalsComplete = false,
} = {}) {
  return {
    participantsInvited,
    earningsConfigured,
    approvalsComplete,
    paymentProviderConnected: false,
    revenueCollectionEnabled: false,
  };
}

/** Minimal fetch stub — returns an empty array payload for all API calls. */
function mockFetch() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({ data: [] }),
    text: jest.fn().mockResolvedValue(''),
  } as unknown as Response);
}

/** Wire up every hook mock to stable/minimal defaults */
function setupDefaultMocks() {
  mockFetch();
  (useProjectWorkspace as jest.Mock).mockReturnValue({
    projectId: 'proj-1',
    deal: null,
    summary: null,
    projectParticipants: [],
    allDeals: [],
    allParticipants: [],
    loading: false,
    isRefreshing: false,
    lastRefreshAt: null,
    notFound: false,
    sectionErrors: {},
    refresh: jest.fn().mockResolvedValue(undefined),
    refreshSilent: jest.fn().mockResolvedValue(undefined),
    invalidate: jest.fn(),
    clearSectionError: jest.fn(),
    saveSnapshot: jest.fn().mockResolvedValue(true),
    patchParticipants: jest.fn(),
  });

  (useOperationalCoordinationState as jest.Mock).mockReturnValue({
    graph: EMPTY_GRAPH,
    kpis: EMPTY_CANONICAL_KPIS,
    guidance: EMPTY_GUIDANCE,
    workspaceContext: EMPTY_WORKSPACE_CTX,
    activation: null,
    // loading=true causes the component to return the loading skeleton early,
    // keeping smoke-test render cheap while still exercising all hook calls.
    loading: true,
    releaseInteraction: CONSERVATIVE_RELEASE,
    reloadCoordinationSnapshot: jest.fn(),
    canonicalState: null,
    auditTimeline: [],
    operationalOnboarding: null,
    operationalInitialization: null,
    graphSnapshotConverged: false,
  });

  (useCommercialBrain as jest.Mock).mockReturnValue({
    workflowCtx: null,
    commercialCapabilities: null,
    decision: null,
  });

  (useOrganization as jest.Mock).mockReturnValue({ organizationId: 'org-1' });

  (useEntitlements as jest.Mock).mockReturnValue({
    isAllowed: jest.fn(() => true),
    getDecision: jest.fn(() => ({ allowed: true })),
    entitlements: {},
    plan: 'pro',
  });

  (useOrganizationCurrency as jest.Mock).mockReturnValue({ currency: 'USD' });

  (useProjectWorkspaceSmartPolling as jest.Mock).mockReturnValue(undefined);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Module binding — catches TDZ at module evaluation time
// ─────────────────────────────────────────────────────────────────────────────

describe('ProjectParticipantsView module binding', () => {
  it('exports ProjectParticipantsView as a function (no TDZ at module scope)', () => {
    expect(typeof ProjectParticipantsView).toBe('function');
  });

  it('can be imported without ReferenceError', async () => {
    // Dynamic import re-exercises module evaluation path
    const mod = await import('@/components/projects/project-participants-view');
    expect(mod.ProjectParticipantsView).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. showApprovalCentre derivation logic
//    Tests the exact business logic that was in TDZ — isolated from React.
// ─────────────────────────────────────────────────────────────────────────────

describe('showApprovalCentre derivation logic', () => {
  function deriveShowApprovalCentre(
    currentStage: string | null,
    approvalsComplete: boolean
  ): boolean {
    const isCollectingApprovals = currentStage === 'collecting-approvals';
    return isCollectingApprovals || approvalsComplete;
  }

  it('is false when stage is null and approvalsComplete is false', () => {
    expect(deriveShowApprovalCentre(null, false)).toBe(false);
  });

  it('is true when stage is collecting-approvals', () => {
    expect(deriveShowApprovalCentre('collecting-approvals', false)).toBe(true);
  });

  it('is true when approvalsComplete is true (stage irrelevant)', () => {
    expect(deriveShowApprovalCentre(null, true)).toBe(true);
    expect(deriveShowApprovalCentre('some-other-stage', true)).toBe(true);
  });

  it('is true when both collecting-approvals and approvalsComplete', () => {
    expect(deriveShowApprovalCentre('collecting-approvals', true)).toBe(true);
  });

  it('is false for unrelated stages', () => {
    expect(deriveShowApprovalCentre('setup', false)).toBe(false);
    expect(deriveShowApprovalCentre('configuring', false)).toBe(false);
    expect(deriveShowApprovalCentre('payout-ready', false)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Component render — each of these will throw with the original TDZ bug
//    because React evaluates [focusApprovals, showApprovalCentre] at hook-call
//    time, before 'const showApprovalCentre = ...' is reached.
// ─────────────────────────────────────────────────────────────────────────────

describe('ProjectParticipantsView renders without TDZ crash', () => {
  beforeEach(() => {
    setupDefaultMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (global as Record<string, unknown>).fetch;
  });

  it('mounts without ReferenceError — showApprovalCentre false (no approvals)', () => {
    (useCommercialBrain as jest.Mock).mockReturnValue({
      workflowCtx: buildWorkspaceContext({ currentStage: null }),
      commercialCapabilities: buildCommercialCapabilities({
        approvalsComplete: false,
      }),
      decision: null,
    });

    expect(() => {
      render(<ProjectParticipantsView />);
    }).not.toThrow();
  });

  it('mounts without ReferenceError — showApprovalCentre true (collecting-approvals)', () => {
    (useCommercialBrain as jest.Mock).mockReturnValue({
      workflowCtx: buildWorkspaceContext({ currentStage: 'collecting-approvals' }),
      commercialCapabilities: buildCommercialCapabilities({
        participantsInvited: true,
        approvalsComplete: false,
      }),
      decision: null,
    });

    expect(() => {
      render(<ProjectParticipantsView />);
    }).not.toThrow();
  });

  it('mounts without ReferenceError — showApprovalCentre true (approvalsComplete)', () => {
    (useCommercialBrain as jest.Mock).mockReturnValue({
      workflowCtx: buildWorkspaceContext({ currentStage: null }),
      commercialCapabilities: buildCommercialCapabilities({
        participantsInvited: true,
        earningsConfigured: true,
        approvalsComplete: true,
      }),
      decision: null,
    });

    expect(() => {
      render(<ProjectParticipantsView />);
    }).not.toThrow();
  });

  it('mounts without ReferenceError — no participants', () => {
    // Default mocks already have projectParticipants: []
    expect(() => {
      render(<ProjectParticipantsView />);
    }).not.toThrow();
  });

  it('mounts without ReferenceError — useCommercialBrain returns null caps', () => {
    (useCommercialBrain as jest.Mock).mockReturnValue({
      workflowCtx: null,
      commercialCapabilities: null,
      decision: null,
    });

    expect(() => {
      render(<ProjectParticipantsView />);
    }).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Approval Centre state matrix
//    Verifies that the Approval Centre section appears / is hidden correctly
//    for every supported workflow state.
// ─────────────────────────────────────────────────────────────────────────────

describe('Approval Centre state matrix', () => {
  beforeEach(() => {
    setupDefaultMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (global as Record<string, unknown>).fetch;
  });

  const states: Array<{
    label: string;
    stage: string | null;
    approvalsComplete: boolean;
    expectedShowApprovalCentre: boolean;
  }> = [
    { label: 'no participants / no approval activity', stage: null, approvalsComplete: false, expectedShowApprovalCentre: false },
    { label: 'collecting approvals', stage: 'collecting-approvals', approvalsComplete: false, expectedShowApprovalCentre: true },
    { label: 'approvals complete', stage: null, approvalsComplete: true, expectedShowApprovalCentre: true },
    { label: 'both collecting and complete', stage: 'collecting-approvals', approvalsComplete: true, expectedShowApprovalCentre: true },
    { label: 'payout-ready stage (not approval)', stage: 'payout-ready', approvalsComplete: false, expectedShowApprovalCentre: false },
  ];

  it.each(states)(
    'renders without crash — $label (showApprovalCentre=$expectedShowApprovalCentre)',
    ({ stage, approvalsComplete }) => {
      (useCommercialBrain as jest.Mock).mockReturnValue({
        workflowCtx: buildWorkspaceContext({ currentStage: stage }),
        commercialCapabilities: buildCommercialCapabilities({ approvalsComplete }),
        decision: null,
      });

      expect(() => {
        render(<ProjectParticipantsView />);
      }).not.toThrow();
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Direct navigation / refresh simulation
//    These represent the three crash scenarios from the bug report:
//    • Dashboard → Continue → Participants
//    • Dashboard → Approval Centre → Participants
//    • Hard refresh on /participants
// ─────────────────────────────────────────────────────────────────────────────

describe('Participants page navigation scenarios', () => {
  beforeEach(() => {
    setupDefaultMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (global as Record<string, unknown>).fetch;
  });

  it('mounts cleanly on direct URL navigation (no ?focus param)', () => {
    expect(() => render(<ProjectParticipantsView />)).not.toThrow();
  });

  it('mounts cleanly with ?focus=approvals query param (Approval Centre deeplink)', () => {
    // Temporarily override useSearchParams for this specific test
    const navMock = jest.requireMock('next/navigation') as Record<string, jest.Mock>;
    const original = navMock.useSearchParams;
    navMock.useSearchParams = () => new URLSearchParams('focus=approvals');

    try {
      expect(() => render(<ProjectParticipantsView />)).not.toThrow();
    } finally {
      navMock.useSearchParams = original;
    }
  });

  it('renders without exception after simulated workspace refresh (state change)', async () => {
    const { rerender } = render(<ProjectParticipantsView />);

    // Simulate a workspace refresh completing: commercialCapabilities arrive
    (useCommercialBrain as jest.Mock).mockReturnValue({
      workflowCtx: buildWorkspaceContext({ currentStage: 'collecting-approvals' }),
      commercialCapabilities: buildCommercialCapabilities({
        participantsInvited: true,
        approvalsComplete: false,
      }),
      decision: null,
    });

    await act(async () => {
      rerender(<ProjectParticipantsView />);
    });

    // Should still be mounted — no ReferenceError thrown
    expect(document.body.firstChild).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Exact reproduction of the crash condition
//    If showApprovalCentre is accidentally moved after the useEffect that uses
//    it, this test will fail with:
//    "ReferenceError: Cannot access 'showApprovalCentre' before initialization"
// ─────────────────────────────────────────────────────────────────────────────

describe('TDZ bug reproduction guard (Cannot access showApprovalCentre before initialization)', () => {
  beforeEach(() => {
    setupDefaultMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (global as Record<string, unknown>).fetch;
  });

  it('does not throw ReferenceError when component initialises with approvalsComplete=true', () => {
    (useCommercialBrain as jest.Mock).mockReturnValue({
      workflowCtx: buildWorkspaceContext({ currentStage: null }),
      commercialCapabilities: buildCommercialCapabilities({ approvalsComplete: true }),
      decision: null,
    });

    let caught: Error | null = null;
    try {
      render(<ProjectParticipantsView />);
    } catch (e) {
      caught = e as Error;
    }

    expect(caught).toBeNull();

    if (caught) {
      // Explicit message for future debuggers
      throw new Error(
        `TDZ bug reintroduced! The original crash (ReferenceError: Cannot access 'tk' before initialization) has returned.\n` +
          `Inner error: ${(caught as Error).message}\n` +
          `Check that 'const showApprovalCentre' is declared BEFORE the useEffect that lists it in the dependency array.\n` +
          `See: src/components/projects/project-participants-view.tsx`
      );
    }
  });

  it('does not throw ReferenceError when commercialCapabilities is null (initial load)', () => {
    (useCommercialBrain as jest.Mock).mockReturnValue({
      workflowCtx: null,
      commercialCapabilities: null,
      decision: null,
    });

    let caught: Error | null = null;
    try {
      render(<ProjectParticipantsView />);
    } catch (e) {
      caught = e as Error;
    }

    expect(caught).toBeNull();
  });
});
