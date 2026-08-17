import type { OrganizationWorkflowLifecycleStatus } from '@prisma/client';

export const WORKFLOW_LIFECYCLE_LABELS: Record<OrganizationWorkflowLifecycleStatus, string> = {
  AWAITING_INPUT: 'Awaiting agreement',
  EXTRACTING: 'Extracting terms',
  READY_FOR_REVIEW: 'Ready for review',
  EXTRACTION_FAILED: 'Extraction failed',
  APPROVED: 'Structure approved',
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
