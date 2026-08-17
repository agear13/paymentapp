import type { OrganizationWorkflowStatus } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { serializeOrganizationWorkflowWithTemplate } from '@/lib/workflows/serialize-workflow';
import { WorkflowNotFoundError, type OrganizationWorkflowWithTemplate } from '@/lib/workflows/types';

export async function listOrganizationWorkflows(
  organizationId: string
): Promise<OrganizationWorkflowWithTemplate[]> {
  const rows = await prisma.organization_workflows.findMany({
    where: { organization_id: organizationId },
    orderBy: { deployed_at: 'desc' },
  });

  return rows
    .map((row) => serializeOrganizationWorkflowWithTemplate(row))
    .filter((row): row is OrganizationWorkflowWithTemplate => row !== null);
}

export async function getOrganizationWorkflowById(
  organizationId: string,
  workflowId: string
): Promise<OrganizationWorkflowWithTemplate> {
  const row = await prisma.organization_workflows.findFirst({
    where: { id: workflowId, organization_id: organizationId },
  });
  if (!row) {
    throw new WorkflowNotFoundError();
  }
  const serialized = serializeOrganizationWorkflowWithTemplate(row);
  if (!serialized) {
    throw new WorkflowNotFoundError('Workflow template no longer available');
  }
  return serialized;
}

export async function getOrganizationWorkflowBySlug(
  organizationId: string,
  templateSlug: string
): Promise<OrganizationWorkflowWithTemplate | null> {
  const row = await prisma.organization_workflows.findUnique({
    where: {
      ux_organization_workflows_org_template: {
        organization_id: organizationId,
        template_slug: templateSlug,
      },
    },
  });
  if (!row) return null;
  return serializeOrganizationWorkflowWithTemplate(row);
}

export async function updateOrganizationWorkflowConfiguration(
  organizationId: string,
  workflowId: string,
  configuration: Record<string, unknown>
): Promise<OrganizationWorkflowWithTemplate> {
  const existing = await prisma.organization_workflows.findFirst({
    where: { id: workflowId, organization_id: organizationId },
  });
  if (!existing) {
    throw new WorkflowNotFoundError();
  }

  const row = await prisma.organization_workflows.update({
    where: { id: workflowId },
    data: { configuration },
  });

  const serialized = serializeOrganizationWorkflowWithTemplate(row);
  if (!serialized) {
    throw new WorkflowNotFoundError('Workflow template no longer available');
  }
  return serialized;
}

export async function updateOrganizationWorkflowStatus(
  organizationId: string,
  workflowId: string,
  status: OrganizationWorkflowStatus
): Promise<OrganizationWorkflowWithTemplate> {
  const existing = await prisma.organization_workflows.findFirst({
    where: { id: workflowId, organization_id: organizationId },
  });
  if (!existing) {
    throw new WorkflowNotFoundError();
  }

  const row = await prisma.organization_workflows.update({
    where: { id: workflowId },
    data: {
      status,
      paused_at: status === 'PAUSED' ? new Date() : null,
    },
  });

  const serialized = serializeOrganizationWorkflowWithTemplate(row);
  if (!serialized) {
    throw new WorkflowNotFoundError('Workflow template no longer available');
  }
  return serialized;
}
