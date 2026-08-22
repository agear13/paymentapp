/** @jest-environment jsdom */

import fs from 'fs';
import path from 'path';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { journeyAssessmentContext } from '@/lib/journey/journey-assessment-storage.client';
import {
  advisorDisplayName,
  buildWorkspaceAdvisorIntro,
  collectAdvisorFindings,
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

  test('does not invent a greeting name', () => {
    expect(advisorDisplayName({ fullName: 'Lee Chen', email: 'lee@example.com' })).toBe('Lee');
    expect(advisorDisplayName({ fullName: null, email: 'mina@example.com' })).toBe('mina');
    expect(advisorDisplayName({ fullName: null, email: null })).toBeNull();
  });

  test('paid-faster recommends creating a payment link when no connection is required', () => {
    const intro = buildWorkspaceAdvisorIntro({
      snapshot: {
        objective: 'paid-faster',
        business: { industry: 'SaaS / Technology', challenge: 'Late payments' },
      },
      workspace: emptyWorkspace,
      displayName: 'Mina',
    });

    expect(intro.greeting).toBe('Welcome, Mina');
    expect(intro.statusLabel).toBe('Ready to learn from your workflows');
    expect(intro.primary).toEqual({
      kind: 'start',
      label: 'Create a payment link',
      href: COMMERCIAL_OS_ROUTES.createInvoice,
    });
    expect(intro.recommendation).toContain('payment link');
    expect(intro.systemsCta.label).toBe('Connect your systems');
    expect(intro.findings.map((item) => item.value)).toEqual([
      'SaaS / Technology',
      'Get paid faster',
      'Late payments',
    ]);
  });

  test('reconcile with unconnected Xero asks to complete that connection first', () => {
    const intro = buildWorkspaceAdvisorIntro({
      snapshot: {
        objective: 'reconcile',
        business: { accounting: 'Xero', challenge: 'Manual reconciliation' },
      },
      workspace: emptyWorkspace,
    });

    expect(intro.primary.kind).toBe('connect');
    expect(intro.primary.label).toBe('Connect Xero');
    expect(intro.primary.href).toBe(COMMERCIAL_OS_ROUTES.connected);
    expect(intro.recommendation).toContain('Xero');
    expect(intro.systemsCta.label).toBe('Connect your systems');
  });

  test('reconcile with connected Xero and a deployed workflow reviews that workflow', () => {
    const intro = buildWorkspaceAdvisorIntro({
      snapshot: { objective: 'reconcile', business: { accounting: 'Xero' } },
      workspace: {
        xeroConnected: true,
        deployedWorkflowSlugs: ['autonomous-reconciliation'],
      },
    });

    expect(intro.statusLabel).toBe('Learning from your workspace');
    expect(intro.primary.kind).toBe('review-workflow');
    expect(intro.primary.label).toBe('Review Autonomous Reconciliation');
    expect(intro.primary.href).toBe(COMMERCIAL_OS_ROUTES.workflowInstance('autonomous-reconciliation'));
    expect(intro.systemsCta.label).toBe('Review your connected systems');
  });

  test('spreadsheet accounting does not invent a Xero connection requirement', () => {
    const intro = buildWorkspaceAdvisorIntro({
      snapshot: {
        objective: 'reconcile',
        business: { accounting: 'None / Spreadsheets' },
      },
      workspace: emptyWorkspace,
    });

    expect(intro.primary.kind).toBe('start');
    expect(intro.primary.label).toBe('Create invoice');
    expect(intro.findings.some((item) => item.value === 'None / Spreadsheets')).toBe(true);
    expect(intro.recommendation).not.toMatch(/Xero|Stripe/i);
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

    expect(intro.recommendation).not.toMatch(/hours|A\$|revenue improvements|32 hrs/i);
    expect(intro.primary.href).toBe(COMMERCIAL_OS_ROUTES.timeline);
  });
});

describe('workspace start screen advisor panel', () => {
  test('replaces the static checklist and does not invent business impact', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'components/journey/lovable/workspace-start-screen.tsx'),
      'utf8'
    );

    expect(source).toContain('WorkspaceAdvisorPanel');
    expect(source).not.toContain('Business profile created');
    expect(source).not.toContain('Expected impact');
    expect(source).not.toContain("business.industry || 'Professional services'");
    expect(source).not.toMatch(/['"]Live['"]/);
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
