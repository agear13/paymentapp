/**
 * Operator-facing lifecycle labels for project coordination stages.
 */

const STAGE_LABELS: Record<string, string> = {
  Introduced: 'Setup in progress',
  'In Review': 'Under review',
  Approved: 'Approved',
  Paid: 'Settled',
  Pending: 'Pending coordination',
};

export function formatOperationalStage(stage: string | null | undefined): string {
  if (!stage?.trim()) return 'Setup in progress';
  return STAGE_LABELS[stage] ?? stage;
}
