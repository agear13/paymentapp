import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import {
  buildInstalledWorkspaceActions,
  buildWorkspaceAttentionItems,
} from '@/lib/journey/installed-workflow-workspace-actions';
import { workflowInstanceHref } from '@/lib/workflows/derive-deployed-features';
import type { OrganizationWorkflowWithTemplate } from '@/lib/workflows/types';

function agreementWorkflow(
  overrides: Partial<OrganizationWorkflowWithTemplate> = {}
): OrganizationWorkflowWithTemplate {
  return {
    id: 'wf-1',
    organizationId: 'org-a',
    templateSlug: 'agreement-intelligence',
    templateVersion: '1.0.0',
    status: 'DEPLOYED',
    lifecycleStatus: 'AWAITING_INPUT',
    configuration: {},
    deployedAt: '2026-08-17T10:00:00Z',
    pausedAt: null,
    createdAt: '2026-08-17T10:00:00Z',
    updatedAt: '2026-08-17T10:00:00Z',
    template: {
      slug: 'agreement-intelligence',
      name: 'Agreement Intelligence',
      summary: 'Turn your agreements into structured commercial workflows.',
      icon: null as never,
      template: {
        version: '1.0.0',
        category: 'agreement_intelligence',
        deployable: true,
      },
    },
    ...overrides,
  };
}

describe('Workspace information architecture', () => {
  it('separates workflow library preview from installed instance routes', () => {
    expect(COMMERCIAL_OS_ROUTES.workflowLibrary).toBe('/workspace/workflows');
    expect(COMMERCIAL_OS_ROUTES.workflowDetail('agreement-intelligence')).toBe(
      '/workspace/workflows/agreement-intelligence/preview'
    );
    expect(COMMERCIAL_OS_ROUTES.workflowInstance('agreement-intelligence')).toBe(
      '/workspace/workflows/agreement-intelligence'
    );
    expect(COMMERCIAL_OS_ROUTES.workflowInstance('referral-management')).toBe(
      '/workspace/workflows/referral-management'
    );
    expect(COMMERCIAL_OS_ROUTES.workflowServices('referral-management')).toBe(
      '/workspace/workflows/referral-management?view=services'
    );
    expect(COMMERCIAL_OS_ROUTES.commercialWorkspace).toBe('/workspace/commercial');
    expect(COMMERCIAL_OS_ROUTES.workspace).toBe('/workspace');
    expect(COMMERCIAL_OS_ROUTES.settlement).toBe('/workspace/settlement');
    expect(COMMERCIAL_OS_ROUTES.settlementObligations).toBe('/workspace/settlement/obligations');
    expect(COMMERCIAL_OS_ROUTES.settlementEarnings).toBe('/workspace/settlement/earnings');
    expect(COMMERCIAL_OS_ROUTES.settlementReleases).toBe('/workspace/settlement/releases');
  });

  it('does not show installed workflow actions before deployment', () => {
    expect(buildInstalledWorkspaceActions([])).toEqual([]);
    expect(buildWorkspaceAttentionItems([])).toEqual([]);
  });

  it('builds workspace actions for installed Agreement Intelligence', () => {
    const actions = buildInstalledWorkspaceActions([agreementWorkflow()]);
    expect(actions).toHaveLength(1);
    expect(actions[0]?.title).toBe('Agreement Intelligence');
    expect(actions[0]?.href).toBe('/workspace/workflows/agreement-intelligence');
  });

  it('routes Open Workflow to the installed instance hub', () => {
    expect(workflowInstanceHref('agreement-intelligence')).toBe(
      '/workspace/workflows/agreement-intelligence'
    );
  });

  it('surfaces attention items without deleting agreement context when paused', () => {
    const items = buildWorkspaceAttentionItems([
      agreementWorkflow({
        status: 'PAUSED',
        lifecycleStatus: 'READY_FOR_REVIEW',
      }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.message).toMatch(/paused/i);
    expect(items[0]?.href).toBe('/workspace/workflows/agreement-intelligence');
  });

  it('Commercial Workspace route is distinct from Workflow Library', () => {
    expect(COMMERCIAL_OS_ROUTES.commercialWorkspace).not.toBe(COMMERCIAL_OS_ROUTES.workflowLibrary);
  });
});
