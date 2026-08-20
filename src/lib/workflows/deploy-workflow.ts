import type { OrganizationWorkflowLifecycleStatus, OrganizationWorkflowStatus } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { evaluateFeature } from '@/lib/entitlements/workspace-entitlements';
import { resolveEntitlementContext } from '@/lib/entitlements/resolve-context.server';
import {
  isDeployableWorkflowSlug,
  resolveWorkflowTemplate,
  sanitizeWorkflowConfiguration,
} from '@/lib/workflows/template-registry';
import { serializeOrganizationWorkflowWithTemplate } from '@/lib/workflows/serialize-workflow';
import {
  WorkflowDeployError,
  type OrganizationWorkflowWithTemplate,
} from '@/lib/workflows/types';

export type DeployWorkflowInput = {
  organizationId: string;
  userId: string;
  userEmail?: string | null;
  templateSlug: string;
  configuration?: unknown;
};

export type DeployWorkflowResult = {
  workflow: OrganizationWorkflowWithTemplate;
  created: boolean;
};

function initialLifecycleStatus(templateSlug: string): OrganizationWorkflowLifecycleStatus {
  if (templateSlug === 'referral-management') return 'ACTIVE';
  return 'AWAITING_INPUT';
}

export async function deployWorkflowToOrganization(
  input: DeployWorkflowInput
): Promise<DeployWorkflowResult> {
  const template = resolveWorkflowTemplate(input.templateSlug);
  if (!template) {
    throw new WorkflowDeployError('Unknown workflow template', 'INVALID_TEMPLATE', 404);
  }
  if (!isDeployableWorkflowSlug(input.templateSlug)) {
    throw new WorkflowDeployError(
      'This workflow is not available for deployment yet',
      'NOT_DEPLOYABLE',
      403
    );
  }

  if (template.template.requiredEntitlement) {
    const entitlementCtx = await resolveEntitlementContext({
      organizationId: input.organizationId,
      userId: input.userId,
      userEmail: input.userEmail,
    });
    const decision = evaluateFeature(entitlementCtx, template.template.requiredEntitlement);
    if (!decision.allowed) {
      throw new WorkflowDeployError(
        decision.reason ?? 'Entitlement required to deploy this workflow',
        'ENTITLEMENT_DENIED',
        403
      );
    }
  }

  let configuration: Record<string, unknown>;
  try {
    configuration = sanitizeWorkflowConfiguration(template, input.configuration);
  } catch (error) {
    throw new WorkflowDeployError(
      error instanceof Error ? error.message : 'Invalid configuration',
      'INVALID_CONFIGURATION',
      400
    );
  }

  const existing = await prisma.organization_workflows.findUnique({
    where: {
      ux_organization_workflows_org_template: {
        organization_id: input.organizationId,
        template_slug: input.templateSlug,
      },
    },
  });

  if (existing) {
    const serialized = serializeOrganizationWorkflowWithTemplate(existing);
    if (!serialized) {
      throw new WorkflowDeployError('Installed workflow template is no longer available', 'INVALID_TEMPLATE', 500);
    }
    return { workflow: serialized, created: false };
  }

  try {
    const created = await prisma.organization_workflows.create({
      data: {
        organization_id: input.organizationId,
        template_slug: input.templateSlug,
        template_version: template.template.version,
        status: 'DEPLOYED' satisfies OrganizationWorkflowStatus,
        lifecycle_status: initialLifecycleStatus(input.templateSlug),
        configuration,
      },
    });
    const serialized = serializeOrganizationWorkflowWithTemplate(created);
    if (!serialized) {
      throw new WorkflowDeployError('Failed to serialize deployed workflow', 'INVALID_TEMPLATE', 500);
    }
    return { workflow: serialized, created: true };
  } catch (error: unknown) {
    const code =
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof (error as { code: unknown }).code === 'string'
        ? (error as { code: string }).code
        : null;
    if (code === 'P2002') {
      const raced = await prisma.organization_workflows.findUnique({
        where: {
          ux_organization_workflows_org_template: {
            organization_id: input.organizationId,
            template_slug: input.templateSlug,
          },
        },
      });
      if (raced) {
        const serialized = serializeOrganizationWorkflowWithTemplate(raced);
        if (serialized) {
          return { workflow: serialized, created: false };
        }
      }
    }
    throw error;
  }
}
