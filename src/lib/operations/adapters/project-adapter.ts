import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { hasPersistedCompensationTerms } from '@/lib/operations/primitives/participant-earnings-primitives';
import { hydrateOperationalParticipant } from '@/lib/operations/hydration/hydrate-operational-participant';

export function projectEntityForMutation(project: RecentDeal): RecentDeal {
  return project;
}

export function detectProjectPhase(
  project: RecentDeal
): 'configuring' | 'ready' | 'active' | 'unknown' {
  const status = String(project.setupStatus ?? project.operationalCompleteness ?? '');
  if (status === 'ready' || status === 'complete') return 'ready';
  if (status === 'configuring' || status === 'draft') return 'configuring';
  const dealStatus = String(project.status ?? '');
  if (dealStatus === 'Active' || dealStatus === 'Closed Won') return 'active';
  return 'unknown';
}

export function countConfiguredParticipants(participants: DemoParticipant[]): number {
  return participants.filter((p) =>
    hasPersistedCompensationTerms(hydrateOperationalParticipant(p))
  ).length;
}
