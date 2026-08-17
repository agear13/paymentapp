import type { organization_workflows } from '@prisma/client';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';
import type { OrganizationWorkflowRecord, OrganizationWorkflowWithTemplate } from '@/lib/workflows/types';

export function serializeOrganizationWorkflow(
  row: organization_workflows
): OrganizationWorkflowRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    templateSlug: row.template_slug,
    templateVersion: row.template_version,
    status: row.status,
    lifecycleStatus: row.lifecycle_status,
    configuration:
      row.configuration && typeof row.configuration === 'object' && !Array.isArray(row.configuration)
        ? (row.configuration as Record<string, unknown>)
        : {},
    deployedAt: row.deployed_at.toISOString(),
    pausedAt: row.paused_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function serializeOrganizationWorkflowWithTemplate(
  row: organization_workflows
): OrganizationWorkflowWithTemplate | null {
  const template = getWorkflowBySlug(row.template_slug);
  if (!template) {
    return null;
  }
  return {
    ...serializeOrganizationWorkflow(row),
    template: {
      slug: template.slug,
      name: template.name,
      summary: template.summary,
      icon: template.icon,
      template: template.template,
    },
  };
}
