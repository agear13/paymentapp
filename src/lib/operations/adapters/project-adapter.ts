import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

export function projectEntityForMutation(project: RecentDeal): RecentDeal {
  return project;
}

export function detectProjectPhase(
  project: RecentDeal
): 'configuring' | 'ready' | 'active' | 'unknown' {
  const status = project.setupStatus ?? project.operationalCompleteness;
  if (status === 'ready' || status === 'complete') return 'ready';
  if (status === 'configuring' || status === 'draft') return 'configuring';
  if (project.status === 'Active' || project.status === 'Closed Won') return 'active';
  return 'unknown';
}

export function countConfiguredParticipants(participants: DemoParticipant[]): number {
  return participants.filter((p) => p.compensationProfile?.configured === true).length;
}
