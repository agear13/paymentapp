import type { OrganizationWorkflowLifecycleStatus } from '@prisma/client';

export const WORKFLOW_LIFECYCLE_LABELS: Record<OrganizationWorkflowLifecycleStatus, string> = {
  AWAITING_INPUT: 'Awaiting agreement',
  EXTRACTING: 'Extracting terms',
  READY_FOR_REVIEW: 'Ready for review',
  EXTRACTION_FAILED: 'Extraction failed',
  APPROVED: 'Structure approved',
  BOOTSTRAPPING: 'Activating workflow',
  BOOTSTRAP_FAILED: 'Activation failed',
  ACTIVE: 'Active',
};

export function canUploadAgreement(lifecycleStatus: OrganizationWorkflowLifecycleStatus): boolean {
  return lifecycleStatus === 'AWAITING_INPUT' || lifecycleStatus === 'EXTRACTION_FAILED';
}

export function canReviewExtraction(lifecycleStatus: OrganizationWorkflowLifecycleStatus): boolean {
  return lifecycleStatus === 'READY_FOR_REVIEW';
}

export function canApproveStructure(lifecycleStatus: OrganizationWorkflowLifecycleStatus): boolean {
  return lifecycleStatus === 'READY_FOR_REVIEW';
}

export function canRetryExtraction(lifecycleStatus: OrganizationWorkflowLifecycleStatus): boolean {
  return lifecycleStatus === 'EXTRACTION_FAILED';
}

export function canRetryBootstrap(lifecycleStatus: OrganizationWorkflowLifecycleStatus): boolean {
  return lifecycleStatus === 'BOOTSTRAP_FAILED';
}

export function isOperationalWorkflow(lifecycleStatus: OrganizationWorkflowLifecycleStatus): boolean {
  return lifecycleStatus === 'ACTIVE';
}

export function isWorkflowLockedForInput(lifecycleStatus: OrganizationWorkflowLifecycleStatus): boolean {
  return (
    lifecycleStatus === 'APPROVED' ||
    lifecycleStatus === 'BOOTSTRAPPING' ||
    lifecycleStatus === 'ACTIVE'
  );
}
