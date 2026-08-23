/** @jest-environment jsdom */

import fs from 'fs';
import path from 'path';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { journeyAssessmentContext } from '@/lib/journey/journey-assessment-storage.client';
import {
  ADVISOR_HAS_ACTIVITY_NOTE,
  ADVISOR_LEARNING_NOTE,
  ADVISOR_NO_ACTIVITY_NOTE,
  advisorDisplayName,
  buildWorkspaceAdvisorIntro,
  collectAdvisorFindings,
  deriveAdvisorActivityNote,
  deriveAdvisorSecondaryCta,
  recommendedWorkflowSlug,
  snapshotFromOnboardingPayload,
  workspaceStartCardIdForObjective,
} from '@/lib/journey/workspace-advisor-intro';
import {
  createLocalWorkspaceAdvisorSeenStore,
  WORKSPACE_ADVISOR_SEEN_STORAGE_KEY,
} from '@/lib/journey/workspace-advisor-seen.client';

const emptyWorkspace = {
  xeroConnected: false,
  deployedWorkflowSlugs: [] as string[],
};

describe('workspace advisor intro', () => {
  test('uses only real assessment fields and omits missing ones', () => {
    const findings = collectAdvisorFindings({
      objective: 'reconcile',
      business: { industry: 'Healthcare' },
    });

    expect(findings.map((item) => item.key)).toEqual(['industry', 'objective']);
    expect(findings.some((item) => item.value === 'Xero')).toBe(false);
    expect(findings.some((item) => item.value === 'Stripe')).toBe(false);
    expect(findings.some((item) => item.value === 'Professional services')).toBe(false);
  });

  test('includes existing systems when the user listed them', () => {
    const findings = collectAdvisorFindings({
      objective: 'paid-faster',
      business: { systems: ['Stripe', 'HubSpot'] },
    });

    expect(findings).toContainEqual({
      key: 'systems',
      label: 'Existing systems',
      value: 'Stripe, HubSpot',
    });
  });

  test('empty onboarding context does not invent business facts', () => {
    const findings = collectAdvisorFindings({ objective: null, business: null });
    const intro = buildWorkspaceAdvisorIntro({
      snapshot: { objective: null, business: null },
      workspace: emptyWorkspace,
    });

    expect(findings).toEqual([]);
    expect(intro.findings).toEqual([]);
    expect(intro.recommendation).toBeNull();
    expect(JSON.stringify(intro)).not.toMatch(/Xero|Pinch|Healthcare|Professional services/i);
  });

  test('does not invent a greeting name', () => {
    expect(advisorDisplayName({ fullName: 'Lee Chen', email: 'lee@example.com' })).toBe('Lee');
    expect(advisorDisplayName({ fullName: null, email: 'mina@example.com' })).toBe('mina');
    expect(advisorDisplayName({ fullName: null, email: null })).toBeNull();
  });

  test('paid-faster keeps setup findings and recommends payment rails as optional guidance', () => {
    const intro = buildWorkspaceAdvisorIntro({
      snapshot: {
        objective: 'paid-faster',
        business: { industry: 'SaaS / Technology', challenge: 'Late payments' },
      },
      workspace: emptyWorkspace,
      displayName: 'Mina',
    });

    expect(intro.greeting).toBe('Welcome, Mina');
    expect(intro.status).toBe('setup');
    expect(intro.statusLabel).toBe('Ready to learn from your workflows');
    expect(intro.recommendation?.kind).toBe('payment_rail');
    expect(intro.recommendation?.destination).toBe(COMMERCIAL_OS_ROUTES.paymentsProviders);
    expect(intro.recommendationSourceLabel).toBe('Based on what you told us during setup');
    expect(intro.learningNote).toBe(ADVISOR_LEARNING_NOTE);
    expect(intro.systemsCta).toBeNull();
    expect(intro.findings.map((item) => item.value)).toEqual([
      'SaaS / Technology',
      'Get paid faster',
      'Late payments',
    ]);
  });

  test('reconcile with unconnected Xero recommends Xero without a generic Connect your systems CTA', () => {
    const intro = buildWorkspaceAdvisorIntro({
      snapshot: {
        objective: 'reconcile',
        business: { accounting: 'Xero', challenge: 'Manual reconciliation' },
      },
      workspace: emptyWorkspace,
    });

    expect(intro.status).toBe('setup');
    expect(intro.recommendation?.kind).toBe('accounting');
    expect(intro.recommendation?.title).toBe('Connect Xero');
    expect(intro.recommendation?.destination).toBe(COMMERCIAL_OS_ROUTES.connected);
    expect(intro.systemsCta).toBeNull();
  });

  test('connected Xero keeps a review-systems CTA and stays in the setup stage', () => {
    const intro = buildWorkspaceAdvisorIntro({
      snapshot: { objective: 'reconcile', business: { accounting: 'Xero' } },
      workspace: {
        xeroConnected: true,
        deployedWorkflowSlugs: ['autonomous-reconciliation'],
      },
    });

    expect(intro.status).toBe('setup');
    expect(intro.statusLabel).toBe('Ready to learn from your workflows');
    expect(intro.recommendation?.kind).not.toBe('accounting');
    expect(intro.systemsCta).toEqual({
      label: 'Review your connected systems',
      href: COMMERCIAL_OS_ROUTES.connected,
    });
  });

  test('spreadsheet accounting does not invent a Xero connection requirement', () => {
    const intro = buildWorkspaceAdvisorIntro({
      snapshot: {
        objective: 'reconcile',
        business: { accounting: 'None / Spreadsheets' },
      },
      workspace: emptyWorkspace,
    });

    expect(intro.recommendation?.kind).not.toBe('accounting');
    expect(intro.findings.some((item) => item.value === 'None / Spreadsheets')).toBe(true);
    expect(intro.recommendation?.title).not.toMatch(/Xero/i);
    expect(intro.systemsCta).toBeNull();
  });

  test('hydrates from persisted onboarding context without defaults', () => {
    const snapshot = snapshotFromOnboardingPayload({
      state: {
        onboarding_context: journeyAssessmentContext('forecast', { industry: 'Hospitality' }),
      },
    });

    expect(snapshot).toEqual({
      objective: 'forecast',
      business: { industry: 'Hospitality' },
    });
    expect(workspaceStartCardIdForObjective(snapshot?.objective ?? null)).toBe('collections');
  });

  test('omits expected-impact style claims from recommendation copy', () => {
    const intro = buildWorkspaceAdvisorIntro({
      snapshot: { objective: 'reporting', business: { industry: 'Construction / Trades' } },
      workspace: emptyWorkspace,
    });

    expect(JSON.stringify(intro.recommendation)).not.toMatch(/hours|A\$|revenue improvements|32 hrs/i);
    expect(intro.recommendation?.kind).toBe('workflow');
  });
});

describe('Advisor secondary CTA', () => {
  test('Xero users without a primary rec get Connect Xero, not a generic systems CTA', () => {
    expect(
      deriveAdvisorSecondaryCta({
        snapshot: { objective: null, business: { accounting: 'Xero' } },
        workspace: emptyWorkspace,
        recommendation: null,
      })
    ).toEqual({
      label: 'Connect Xero',
      href: COMMERCIAL_OS_ROUTES.connected,
    });
  });

  test.each(['MYOB', 'QuickBooks', 'NetSuite', 'None / Spreadsheets'])(
    '%s does not get a Connected Systems secondary CTA',
    (accounting) => {
      const cta = deriveAdvisorSecondaryCta({
        snapshot: { objective: 'reconcile', business: { accounting } },
        workspace: emptyWorkspace,
        recommendation: {
          kind: 'workflow',
          source: 'setup',
          reason: 'explore_workflows',
          title: 'Explore Workflow Library',
          description: 'Browse',
          actionLabel: 'Open',
          destination: COMMERCIAL_OS_ROUTES.workflows,
        },
      });

      expect(cta).toBeNull();
    }
  );

  test('payment-focused users without a primary rec are pointed at payment providers', () => {
    expect(
      deriveAdvisorSecondaryCta({
        snapshot: { objective: 'paid-faster', business: { accounting: 'None / Spreadsheets' } },
        workspace: emptyWorkspace,
        recommendation: null,
      })
    ).toEqual({
      label: 'Set up payment methods',
      href: COMMERCIAL_OS_ROUTES.paymentsProviders,
    });
  });

  test('revenue-share users without a primary rec are pointed at Workflow Library', () => {
    expect(
      deriveAdvisorSecondaryCta({
        snapshot: { objective: 'revenue-share', business: { accounting: 'MYOB' } },
        workspace: emptyWorkspace,
        recommendation: null,
      })
    ).toEqual({
      label: 'Open Workflow Library',
      href: COMMERCIAL_OS_ROUTES.workflows,
    });
  });
});

describe('workspace start screen advisor panel', () => {
  test('keeps universal start-working cards and treats recommendations as optional', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'components/journey/lovable/workspace-start-screen.tsx'),
      'utf8'
    );

    const cardsRenderAt = source.indexOf('{CARDS.map');
    const recommendationAt = source.indexOf('{recommendation ?');

    expect(source).toContain('WorkspaceAdvisorPanel');
    expect(source).toContain('Start working');
    expect(source).toContain('Recommended for you');
    expect(source).toContain('Create Invoice');
    expect(source).toContain('Manage Invoices');
    expect(source).toContain('planBilling');
    expect(cardsRenderAt).toBeGreaterThan(-1);
    expect(recommendationAt).toBeGreaterThan(cardsRenderAt);
    expect(source).toContain('buildWorkspaceRecommendationState');
    expect(source).not.toContain('workspaceStartCardIdForObjective');
    expect(source).not.toContain('recommendedWorkflowSlug');
    expect(source).not.toContain('Business profile created');
    expect(source).not.toContain('Expected impact');
    expect(source).not.toContain("business.industry || 'Professional services'");
    expect(source).not.toMatch(/['"]Live['"]/);
  });

  test('payment rails page exposes a providers section id for the guidance hash', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'components/journey/lovable/workspace-payments-settlement-screen.tsx'),
      'utf8'
    );

    expect(source).toContain('id="payment-providers"');
    expect(source).toContain('scrollIntoView');
  });

  test('legacy helpers stay unused by the recommendation heuristic', () => {
    const recommendation = fs.readFileSync(
      path.join(process.cwd(), 'lib/journey/workspace-recommendation.ts'),
      'utf8'
    );
    const advisor = fs.readFileSync(
      path.join(process.cwd(), 'lib/journey/workspace-advisor-intro.ts'),
      'utf8'
    );

    expect(recommendation).not.toContain('workspaceStartCardIdForObjective');
    expect(recommendation).not.toContain('recommendedWorkflowSlug');
    expect(advisor).toContain('@deprecated');
    expect(workspaceStartCardIdForObjective('reconcile')).toBe('create-invoice');
    expect(recommendedWorkflowSlug('reconcile')).toBe('autonomous-reconciliation');
  });
});

describe('advisor activity note', () => {
  test('does not claim learned activity before the timeline has loaded', () => {
    expect(
      deriveAdvisorActivityNote({ timelineLoaded: false, hasCommercialActivity: false })
    ).toBeNull();
    expect(
      deriveAdvisorActivityNote({ timelineLoaded: false, hasCommercialActivity: true })
    ).toBeNull();
  });

  test('distinguishes no activity from real commercial activity', () => {
    expect(
      deriveAdvisorActivityNote({ timelineLoaded: true, hasCommercialActivity: false })
    ).toBe(ADVISOR_NO_ACTIVITY_NOTE);
    expect(
      deriveAdvisorActivityNote({ timelineLoaded: true, hasCommercialActivity: true })
    ).toBe(ADVISOR_HAS_ACTIVITY_NOTE);
  });
});

describe('workspace advisor seen store', () => {
  test('local store marks first visit and can be swapped later', () => {
    const memory = new Map<string, string>();
    const store = createLocalWorkspaceAdvisorSeenStore({
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => {
        memory.set(key, value);
      },
    });

    expect(store.hasSeen()).toBe(false);
    store.markSeen();
    expect(store.hasSeen()).toBe(true);
    expect(memory.get(WORKSPACE_ADVISOR_SEEN_STORAGE_KEY)).toBe('1');
  });
});
