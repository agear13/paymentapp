import type {
  organization_workflow_agreements,
  OrganizationWorkflowLifecycleStatus,
  WorkflowAgreementExtractionStatus,
} from '@prisma/client';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { WORKFLOW_LIFECYCLE_LABELS } from '@/lib/workflows/agreement-intelligence/lifecycle';
import type {
  AgreementCollectionFilter,
  AgreementCollectionItem,
  WorkflowAgreementRecord,
} from '@/lib/workflows/agreement-intelligence/types';

export function pickCurrentAgreement<T extends {
  is_current?: boolean | null;
  updated_at?: Date | string;
}>(agreements: T[]): T | null {
  const currents = agreements.filter((row) => row.is_current === true);
  if (currents.length === 1) return currents[0] ?? null;
  if (currents.length > 1) {
    return currents.slice().sort((a, b) => updatedAtMs(b) - updatedAtMs(a))[0] ?? currents[0] ?? null;
  }
  if (agreements.length === 1 && agreements[0] && agreements[0].is_current !== false) {
    return agreements[0];
  }
  return null;
}

function updatedAtMs(row: { updated_at?: Date | string }): number {
  if (row.updated_at instanceof Date) return row.updated_at.getTime();
  if (typeof row.updated_at === 'string') {
    const parsed = Date.parse(row.updated_at);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function agreementDrivesWorkflowLifecycle(
  target: { id?: string | null; is_current?: boolean | null } | null,
  current: { id?: string | null } | null
): boolean {
  if (!target) return false;
  if (target.is_current === true) return true;
  if (target.is_current === false) return false;
  return Boolean(current?.id && target.id && current.id === target.id);
}

export function agreementDetailHref(agreementId: string): string {
  return COMMERCIAL_OS_ROUTES.workflowAgreement('agreement-intelligence', agreementId);
}

export function collectionStatusForExtraction(
  extractionStatus: WorkflowAgreementExtractionStatus,
  bootstrappedAt: Date | string | null
): {
  statusFilter: Exclude<AgreementCollectionFilter, 'all'>;
  statusLabel: string;
} {
  switch (extractionStatus) {
    case 'PENDING':
      return { statusFilter: 'processing', statusLabel: 'Awaiting agreement' };
    case 'EXTRACTING':
      return { statusFilter: 'processing', statusLabel: WORKFLOW_LIFECYCLE_LABELS.EXTRACTING };
    case 'READY_FOR_REVIEW':
      return {
        statusFilter: 'ready_for_review',
        statusLabel: WORKFLOW_LIFECYCLE_LABELS.READY_FOR_REVIEW,
      };
    case 'FAILED':
      return { statusFilter: 'failed', statusLabel: WORKFLOW_LIFECYCLE_LABELS.EXTRACTION_FAILED };
    case 'APPROVED':
      return {
        statusFilter: 'approved_active',
        statusLabel: bootstrappedAt
          ? WORKFLOW_LIFECYCLE_LABELS.ACTIVE
          : WORKFLOW_LIFECYCLE_LABELS.APPROVED,
      };
  }
}

export function lifecycleForAgreementView(input: {
  isCurrent: boolean;
  workflowLifecycle: OrganizationWorkflowLifecycleStatus;
  extractionStatus: WorkflowAgreementExtractionStatus;
  bootstrappedAt: string | null;
  bootstrapError?: string | null;
}): OrganizationWorkflowLifecycleStatus {
  if (input.isCurrent) {
    return input.workflowLifecycle;
  }

  switch (input.extractionStatus) {
    case 'PENDING':
      return 'AWAITING_INPUT';
    case 'EXTRACTING':
      return 'EXTRACTING';
    case 'READY_FOR_REVIEW':
      return 'READY_FOR_REVIEW';
    case 'FAILED':
      return 'EXTRACTION_FAILED';
    case 'APPROVED':
      if (input.bootstrappedAt) return 'ACTIVE';
      if (input.bootstrapError) return 'BOOTSTRAP_FAILED';
      return 'APPROVED';
  }
}

function participantCountFromRow(row: organization_workflow_agreements): number | null {
  const result = row.extraction_result as { parties?: unknown[] } | null;
  if (Array.isArray(result?.parties)) {
    return result.parties.length;
  }
  const graph = row.commercial_graph as { commercialStructure?: { participantCount?: unknown } } | null;
  const count = graph?.commercialStructure?.participantCount;
  return typeof count === 'number' && Number.isFinite(count) ? count : null;
}

export function toAgreementCollectionItem(
  row: organization_workflow_agreements
): AgreementCollectionItem {
  const { statusFilter, statusLabel } = collectionStatusForExtraction(
    row.extraction_status,
    row.bootstrapped_at
  );
  const title =
    row.title?.trim() ||
    row.original_filename?.trim() ||
    (row.extraction_result as { projectName?: { value?: string | null } } | null)?.projectName
      ?.value?.trim() ||
    'Untitled agreement';

  return {
    id: row.id,
    title,
    statusFilter,
    statusLabel,
    extractionStatus: row.extraction_status,
    participantCount: participantCountFromRow(row),
    updatedAt: row.updated_at.toISOString(),
    isCurrent: row.is_current,
    href: agreementDetailHref(row.id),
  };
}

export function matchesAgreementCollectionFilter(
  item: AgreementCollectionItem,
  filter: AgreementCollectionFilter
): boolean {
  return filter === 'all' || item.statusFilter === filter;
}

export function canStartNewExtraction(input: {
  current: Pick<WorkflowAgreementRecord, 'extractionStatus'> | null;
  workflowLifecycle: OrganizationWorkflowLifecycleStatus;
}): boolean {
  if (
    input.workflowLifecycle === 'EXTRACTING' ||
    input.workflowLifecycle === 'BOOTSTRAPPING'
  ) {
    return false;
  }
  if (!input.current) return true;
  return input.current.extractionStatus !== 'EXTRACTING';
}

export function agreementHasPreservedWork(row: {
  source_text?: string | null;
  extraction_result?: unknown;
  extraction_status: WorkflowAgreementExtractionStatus;
}): boolean {
  return (
    Boolean(row.source_text?.trim()) ||
    Boolean(row.extraction_result) ||
    row.extraction_status === 'APPROVED' ||
    row.extraction_status === 'READY_FOR_REVIEW' ||
    row.extraction_status === 'FAILED'
  );
}

/**
 * Explicit New extraction is recorded as workflow lifecycle AWAITING_INPUT while
 * the current agreement row still holds preserved work, including APPROVED /
 * active historical rows. startNewWorkflowAgreement sets that lifecycle and
 * does not demote or insert rows. The following paste/upload then creates a
 * new current row.
 *
 * Retry/continue reuses the current row when lifecycle is not AWAITING_INPUT,
 * or the current row has no preserved work yet (empty first extraction).
 */
export function shouldCreateNewCurrentAgreement(input: {
  current: {
    source_text?: string | null;
    extraction_result?: unknown;
    extraction_status: WorkflowAgreementExtractionStatus;
  } | null;
  workflowLifecycle: OrganizationWorkflowLifecycleStatus;
}): boolean {
  if (!input.current) return true;
  return (
    input.workflowLifecycle === 'AWAITING_INPUT' && agreementHasPreservedWork(input.current)
  );
}
