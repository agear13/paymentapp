import type { OrganizationWorkflowStatus, OrganizationWorkflowLifecycleStatus } from '@prisma/client';
import type { WorkflowLibraryEntry } from '@/lib/journey/workflow-library-catalog';

export type OrganizationWorkflowRecord = {
  id: string;
  organizationId: string;
  templateSlug: string;
  templateVersion: string;
  status: OrganizationWorkflowStatus;
  lifecycleStatus: OrganizationWorkflowLifecycleStatus;
  configuration: Record<string, unknown>;
  deployedAt: string;
  pausedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationWorkflowWithTemplate = OrganizationWorkflowRecord & {
  template: Pick<
    WorkflowLibraryEntry,
    'slug' | 'name' | 'summary' | 'icon' | 'template'
  >;
};

export class WorkflowDeployError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'INVALID_TEMPLATE'
      | 'NOT_DEPLOYABLE'
      | 'ENTITLEMENT_DENIED'
      | 'FORBIDDEN'
      | 'INVALID_CONFIGURATION',
    readonly status: number = 400
  ) {
    super(message);
    this.name = 'WorkflowDeployError';
  }
}

export class WorkflowNotFoundError extends Error {
  constructor(message = 'Workflow not found') {
    super(message);
    this.name = 'WorkflowNotFoundError';
  }
}
