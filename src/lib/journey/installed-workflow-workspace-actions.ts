import type { OrganizationWorkflowLifecycleStatus } from '@prisma/client';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';
import type { OrganizationWorkflowWithTemplate } from '@/lib/workflows/types';

export type WorkspaceInstalledAction = {
  slug: string;
  title: string;
  description: string;
  href: string;
};

export type WorkspaceAttentionItem = {
  slug: string;
  title: string;
  message: string;
  href: string;
  severity: 'info' | 'warning' | 'action';
};

const ATTENTION_MESSAGES: Partial<Record<OrganizationWorkflowLifecycleStatus, string>> = {
  AWAITING_INPUT: 'Upload an agreement to begin extraction.',
  EXTRACTING: 'Agreement extraction is in progress.',
  READY_FOR_REVIEW: 'Review and approve the extracted agreement structure.',
  EXTRACTION_FAILED: 'Agreement extraction failed — retry or upload a different document.',
  BOOTSTRAPPING: 'Activating commercial workflow from approved structure.',
  BOOTSTRAP_FAILED: 'Workflow activation failed — retry bootstrap from the Agreement Intelligence hub.',
};

export function buildInstalledWorkspaceActions(
  workflows: OrganizationWorkflowWithTemplate[]
): WorkspaceInstalledAction[] {
  return workflows
    .filter((workflow) => workflow.template.template.deployable)
    .map((workflow) => {
      const catalog = getWorkflowBySlug(workflow.templateSlug);
      if (!catalog) return null;
      return {
        slug: workflow.templateSlug,
        title: catalog.name,
        description: catalog.summary,
        href: COMMERCIAL_OS_ROUTES.workflowInstance(workflow.templateSlug),
      };
    })
    .filter((item): item is WorkspaceInstalledAction => item !== null);
}

export function buildWorkspaceAttentionItems(
  workflows: OrganizationWorkflowWithTemplate[]
): WorkspaceAttentionItem[] {
  const items: WorkspaceAttentionItem[] = [];

  for (const workflow of workflows) {
    if (workflow.status === 'PAUSED') {
      const catalog = getWorkflowBySlug(workflow.templateSlug);
      items.push({
        slug: workflow.templateSlug,
        title: catalog?.name ?? workflow.templateSlug,
        message: 'This workflow is paused. Resume it to continue operating.',
        href: COMMERCIAL_OS_ROUTES.workflowInstance(workflow.templateSlug),
        severity: 'info',
      });
      continue;
    }

    if (workflow.lifecycleStatus === 'ACTIVE' || workflow.lifecycleStatus === 'APPROVED') continue;

    const message = ATTENTION_MESSAGES[workflow.lifecycleStatus];
    if (!message) continue;

    const catalog = getWorkflowBySlug(workflow.templateSlug);
    items.push({
      slug: workflow.templateSlug,
      title: catalog?.name ?? workflow.templateSlug,
      message,
      href: COMMERCIAL_OS_ROUTES.workflowInstance(workflow.templateSlug),
      severity:
        workflow.lifecycleStatus === 'EXTRACTION_FAILED' ||
        workflow.lifecycleStatus === 'BOOTSTRAP_FAILED'
          ? 'warning'
          : 'action',
    });
  }

  return items;
}
