import {
  deployWorkflowToOrganization,
} from '@/lib/workflows/deploy-workflow';
import {
  getOrganizationWorkflowById,
  getOrganizationWorkflowBySlug,
  listOrganizationWorkflows,
  updateOrganizationWorkflowStatus,
} from '@/lib/workflows/organization-workflows.server';
import {
  isDeployableWorkflowSlug,
  resolveWorkflowTemplate,
  sanitizeWorkflowConfiguration,
} from '@/lib/workflows/template-registry';
import { deriveFeaturesFromDeployedWorkflows } from '@/lib/workflows/derive-deployed-features';
import { WorkflowDeployError } from '@/lib/workflows/types';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';
import { WorkspaceFeature } from '@/lib/workspace-features/types';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    organization_workflows: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/entitlements/resolve-context.server', () => ({
  resolveEntitlementContext: jest.fn().mockResolvedValue({
    organizationId: 'org-a',
    userId: 'user-1',
    pilotBypass: true,
    plan: 'professional',
    status: 'active',
    usage: { aiImportCount: 0, agreementCount: 0, teamMemberCount: 1, workspaceCount: 1 },
  }),
}));

jest.mock('@/lib/entitlements/workspace-entitlements', () => ({
  evaluateFeature: jest.fn().mockReturnValue({ allowed: true }),
}));

const { prisma } = jest.requireMock('@/lib/server/prisma');
const { evaluateFeature } = jest.requireMock('@/lib/entitlements/workspace-entitlements');

const ORG_A = 'org-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ORG_B = 'org-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const WF_ID = 'wf-11111111-1111-1111-1111-111111111111';

function workflowRow(overrides: Record<string, unknown> = {}) {
  return {
    id: WF_ID,
    organization_id: ORG_A,
    template_slug: 'agreement-intelligence',
    template_version: '1.0.0',
    status: 'DEPLOYED',
    lifecycle_status: 'AWAITING_INPUT',
    configuration: {},
    deployed_at: new Date('2026-08-17T10:00:00Z'),
    paused_at: null,
    created_at: new Date('2026-08-17T10:00:00Z'),
    updated_at: new Date('2026-08-17T10:00:00Z'),
    ...overrides,
  };
}

describe('Phase P3-A — Workflow Library deployment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.organization_workflows.findUnique.mockReset();
    prisma.organization_workflows.findFirst.mockReset();
    prisma.organization_workflows.findMany.mockReset();
    prisma.organization_workflows.create.mockReset();
    prisma.organization_workflows.update.mockReset();
    prisma.organization_workflows.findUnique.mockResolvedValue(null);
    prisma.organization_workflows.findFirst.mockResolvedValue(null);
    prisma.organization_workflows.findMany.mockResolvedValue([]);
    evaluateFeature.mockReturnValue({ allowed: true });
  });

  describe('template catalog', () => {
    it('includes Agreement Intelligence with deployable metadata', () => {
      const entry = getWorkflowBySlug('agreement-intelligence');
      expect(entry).toBeDefined();
      expect(entry!.template.deployable).toBe(true);
      expect(entry!.template.version).toBe('1.0.0');
      expect(entry!.template.workspaceFeature).toBe(WorkspaceFeature.AgreementIntelligence);
      expect(entry!.template.previewCapabilities?.length).toBeGreaterThan(0);
    });

    it('resolves valid workflow slug', () => {
      expect(resolveWorkflowTemplate('agreement-intelligence')?.slug).toBe('agreement-intelligence');
      expect(isDeployableWorkflowSlug('agreement-intelligence')).toBe(true);
    });

    it('rejects unknown slug', () => {
      expect(resolveWorkflowTemplate('not-a-workflow')).toBeNull();
      expect(isDeployableWorkflowSlug('payment-collection')).toBe(false);
    });

    it('rejects unknown configuration keys for agreement intelligence', () => {
      const template = getWorkflowBySlug('agreement-intelligence')!;
      expect(() => sanitizeWorkflowConfiguration(template, { foo: 'bar' })).toThrow(
        'Unknown configuration keys: foo'
      );
    });

    it('rejects configuration when schema is empty', () => {
      const template = getWorkflowBySlug('payment-collection')!;
      expect(() => sanitizeWorkflowConfiguration(template, { foo: 'bar' })).toThrow(
        'does not accept configuration'
      );
    });
  });

  describe('deployment', () => {
    it('persists organization workflow on deploy', async () => {
      prisma.organization_workflows.create.mockResolvedValue(workflowRow());

      const result = await deployWorkflowToOrganization({
        organizationId: ORG_A,
        userId: 'user-1',
        templateSlug: 'agreement-intelligence',
      });

      expect(result.created).toBe(true);
      expect(result.workflow.templateSlug).toBe('agreement-intelligence');
      expect(result.workflow.templateVersion).toBe('1.0.0');
      expect(result.workflow.status).toBe('DEPLOYED');
      expect(prisma.organization_workflows.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organization_id: ORG_A,
            template_slug: 'agreement-intelligence',
            template_version: '1.0.0',
          }),
        })
      );
    });

    it('returns existing instance idempotently', async () => {
      prisma.organization_workflows.findUnique.mockResolvedValue(workflowRow());

      const result = await deployWorkflowToOrganization({
        organizationId: ORG_A,
        userId: 'user-1',
        templateSlug: 'agreement-intelligence',
      });

      expect(result.created).toBe(false);
      expect(result.workflow.id).toBe(WF_ID);
      expect(prisma.organization_workflows.create).not.toHaveBeenCalled();
    });

    it('handles concurrent unique constraint race', async () => {
      prisma.organization_workflows.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(workflowRow());
      prisma.organization_workflows.create.mockRejectedValue({ code: 'P2002' });

      const result = await deployWorkflowToOrganization({
        organizationId: ORG_A,
        userId: 'user-1',
        templateSlug: 'agreement-intelligence',
      });

      expect(result.created).toBe(false);
      expect(result.workflow.id).toBe(WF_ID);
    });

    it('rejects non-deployable workflow slug', async () => {
      await expect(
        deployWorkflowToOrganization({
          organizationId: ORG_A,
          userId: 'user-1',
          templateSlug: 'cashflow-forecasting',
        })
      ).rejects.toMatchObject({ code: 'NOT_DEPLOYABLE' });
    });

    it('rejects invalid template slug', async () => {
      await expect(
        deployWorkflowToOrganization({
          organizationId: ORG_A,
          userId: 'user-1',
          templateSlug: 'invalid-slug',
        })
      ).rejects.toMatchObject({ code: 'INVALID_TEMPLATE' });
    });

    it('denies deploy when entitlement fails', async () => {
      evaluateFeature.mockReturnValue({ allowed: false, reason: 'ai_import_limit' });

      await expect(
        deployWorkflowToOrganization({
          organizationId: ORG_A,
          userId: 'user-1',
          templateSlug: 'agreement-intelligence',
        })
      ).rejects.toMatchObject({ code: 'ENTITLEMENT_DENIED' });
    });
  });

  describe('organization isolation', () => {
    it('scopes get by id to organization', async () => {
      prisma.organization_workflows.findFirst.mockResolvedValue(workflowRow());

      const workflow = await getOrganizationWorkflowById(ORG_A, WF_ID);
      expect(workflow.organizationId).toBe(ORG_A);

      prisma.organization_workflows.findFirst.mockResolvedValue(null);
      await expect(getOrganizationWorkflowById(ORG_B, WF_ID)).rejects.toThrow('Workflow not found');
    });

    it('lists only organization workflows', async () => {
      prisma.organization_workflows.findMany.mockResolvedValue([workflowRow()]);
      const list = await listOrganizationWorkflows(ORG_A);
      expect(list).toHaveLength(1);
      expect(prisma.organization_workflows.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organization_id: ORG_A } })
      );
    });

    it('get by slug scopes lookup to organization', async () => {
      prisma.organization_workflows.findUnique.mockImplementation(
        async (args: { where: { ux_organization_workflows_org_template: { organization_id: string } } }) => {
          if (args.where.ux_organization_workflows_org_template.organization_id === ORG_A) {
            return workflowRow();
          }
          return null;
        }
      );

      expect(await getOrganizationWorkflowBySlug(ORG_A, 'agreement-intelligence')).not.toBeNull();
      expect(await getOrganizationWorkflowBySlug(ORG_B, 'agreement-intelligence')).toBeNull();
    });
  });

  describe('lifecycle', () => {
    it('pauses and resumes workflow', async () => {
      prisma.organization_workflows.findFirst.mockResolvedValue(workflowRow());
      prisma.organization_workflows.update.mockResolvedValue(
        workflowRow({ status: 'PAUSED', paused_at: new Date('2026-08-17T11:00:00Z') })
      );

      const paused = await updateOrganizationWorkflowStatus(ORG_A, WF_ID, 'PAUSED');
      expect(paused.status).toBe('PAUSED');
      expect(paused.pausedAt).not.toBeNull();

      prisma.organization_workflows.update.mockResolvedValue(workflowRow({ status: 'DEPLOYED' }));
      const resumed = await updateOrganizationWorkflowStatus(ORG_A, WF_ID, 'DEPLOYED');
      expect(resumed.status).toBe('DEPLOYED');
      expect(resumed.pausedAt).toBeNull();
    });
  });

  describe('derived workspace features', () => {
    it('enables Agreement Intelligence feature when installed', async () => {
      prisma.organization_workflows.findMany.mockResolvedValue([workflowRow()]);
      const list = await listOrganizationWorkflows(ORG_A);
      const features = deriveFeaturesFromDeployedWorkflows(list);
      expect(features).toContain(WorkspaceFeature.AgreementIntelligence);
    });
  });

  describe('errors', () => {
    it('WorkflowDeployError carries status code', () => {
      const err = new WorkflowDeployError('nope', 'INVALID_TEMPLATE', 404);
      expect(err.status).toBe(404);
      expect(err.code).toBe('INVALID_TEMPLATE');
    });
  });
});
