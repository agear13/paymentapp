import type { DemoParticipantRole } from '@/components/deal-network-demo/invite-participant-modal';

const CANONICAL_ROLES: readonly DemoParticipantRole[] = [
  'Introducer',
  'Connector',
  'Closer',
  'Contributor',
];

/**
 * Maps any persisted participant role label to the canonical demo role union.
 * Operational roles (e.g. "Venue Manager") map to Contributor for agreement summaries.
 */
export function normalizeDemoParticipantRole(role: string | null | undefined): DemoParticipantRole {
  const trimmed = role?.trim() ?? '';
  if ((CANONICAL_ROLES as readonly string[]).includes(trimmed)) {
    return trimmed as DemoParticipantRole;
  }
  return 'Contributor';
}
