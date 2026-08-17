import { WorkspaceFeature } from '@/lib/workspace-features/types';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';
import type { OrganizationWorkflowWithTemplate } from '@/lib/workflows/types';

/** Features enabled because a workflow is installed (DEPLOYED or PAUSED). */
export function deriveFeaturesFromDeployedWorkflows(
  workflows: OrganizationWorkflowWithTemplate[]
): WorkspaceFeature[] {
  const features = new Set<WorkspaceFeature>();
  for (const workflow of workflows) {
    const feature = workflow.template.template.workspaceFeature;
    if (feature) {
      features.add(feature);
    }
  }
  return [...features];
}

export function isWorkflowInstalled(
  workflows: OrganizationWorkflowWithTemplate[],
  templateSlug: string
): boolean {
  return workflows.some((w) => w.templateSlug === templateSlug);
}

export function workflowInstanceHref(templateSlug: string): string | null {
  const template = getWorkflowBySlug(templateSlug);
  if (!template?.template.deployable) return null;
  return `/workspace/workflows/${templateSlug}`;
}
