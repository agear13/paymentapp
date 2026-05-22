/**
 * PROJECT — operational unit coordinating funding, allocations, obligations, and releases.
 */

export const PROJECT_STATES = [
  'DRAFT',
  'CONFIGURING',
  'FUNDING_PENDING',
  'ALLOCATIONS_PENDING',
  'OBLIGATIONS_PENDING',
  'READY_FOR_RELEASE',
  'RELEASE_IN_PROGRESS',
  'SETTLING',
  'SETTLED',
  'BLOCKED',
  'ARCHIVED',
] as const;

export type ProjectState = (typeof PROJECT_STATES)[number];

export const PROJECT_STATE_LABELS: Record<ProjectState, string> = {
  DRAFT: 'Draft project',
  CONFIGURING: 'Configuring project',
  FUNDING_PENDING: 'Funding pending',
  ALLOCATIONS_PENDING: 'Allocations pending',
  OBLIGATIONS_PENDING: 'Obligations pending',
  READY_FOR_RELEASE: 'Ready for release',
  RELEASE_IN_PROGRESS: 'Release in progress',
  SETTLING: 'Settling',
  SETTLED: 'Settled',
  BLOCKED: 'Blocked',
  ARCHIVED: 'Archived',
};
