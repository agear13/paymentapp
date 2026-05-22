import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { deriveProjectOperationalReadiness } from '@/lib/operations/readiness/project-readiness';
import { safeProjectState } from '@/lib/operations/guards/hydration-guards';
import type { ProjectOperationalContext } from '@/lib/operations/types/operational-context';

export function selectProjectState(project: RecentDeal | null | undefined) {
  return safeProjectState(project);
}

export function selectProjectReadiness(
  project: RecentDeal | null | undefined,
  participants: DemoParticipant[],
  ctx?: Partial<ProjectOperationalContext>
) {
  return deriveProjectOperationalReadiness(project, participants, ctx);
}
