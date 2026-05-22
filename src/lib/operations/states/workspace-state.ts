/**
 * WORKSPACE — top-level coordination boundary for revenue, obligations, and payouts.
 *
 * Meaning:
 * - DRAFT: created but not yet configured
 * - CONFIGURING: workspace metadata / currency / initial project setup
 * - COLLECTING: provider connected; revenue collection in progress
 * - COORDINATING: participants + compensation + obligations being coordinated
 * - READY_FOR_SETTLEMENT: releases can be prepared
 * - ACTIVE: steady-state operations
 * - DEGRADED: partial failure or stale async setup — guidance still required
 * - ARCHIVED: closed to new operational work
 */

export const WORKSPACE_STATES = [
  'DRAFT',
  'CONFIGURING',
  'COLLECTING',
  'COORDINATING',
  'READY_FOR_SETTLEMENT',
  'ACTIVE',
  'DEGRADED',
  'ARCHIVED',
] as const;

export type WorkspaceState = (typeof WORKSPACE_STATES)[number];

export const WORKSPACE_STATE_LABELS: Record<WorkspaceState, string> = {
  DRAFT: 'Draft workspace',
  CONFIGURING: 'Configuring workspace',
  COLLECTING: 'Collecting revenue',
  COORDINATING: 'Coordinating payouts',
  READY_FOR_SETTLEMENT: 'Ready for settlement',
  ACTIVE: 'Active workspace',
  DEGRADED: 'Setup incomplete',
  ARCHIVED: 'Archived',
};
