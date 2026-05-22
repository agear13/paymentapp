import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  countPayoutReadyParticipants,
  deriveParticipantPayoutReadiness,
} from '@/lib/operations/readiness/participant-readiness';
import { safeProjectState } from '@/lib/operations/guards/hydration-guards';
import type { ProjectOperationalContext } from '@/lib/operations/types/operational-context';
import type { OperationalCompleteness } from '@/lib/operations/types/operational-completeness';
import { defaultOperationalCompleteness } from '@/lib/operations/types/operational-completeness';
import type { OperationalReadinessResult } from '@/lib/operations/types/readiness-result';
import { emptyReadiness } from '@/lib/operations/types/readiness-result';
import { projectParticipantsPath } from '@/lib/projects/project-routes';
import type { ProjectState } from '@/lib/operations/states/project-state';

export type ProjectOperationalReadiness = OperationalReadinessResult & {
  projectId: string;
  state: ProjectState;
  completeness: OperationalCompleteness;
};

export function deriveProjectOperationalReadiness(
  project: RecentDeal | null | undefined,
  participants: DemoParticipant[],
  ctx?: Partial<ProjectOperationalContext>
): ProjectOperationalReadiness {
  const projectId = project?.id ?? ctx?.projectId ?? 'unknown';
  const state = safeProjectState(project);
  const payoutReady = countPayoutReadyParticipants(participants);
  const total = participants.length;
  const configured = participants.filter(
    (p) => deriveParticipantPayoutReadiness(p).flags.hasCompensation
  ).length;

  const completeness: OperationalCompleteness = {
    ...defaultOperationalCompleteness(),
    setupComplete: total > 0 && configured === total,
    fundingReady: ctx?.hasFundingSources ?? false,
    payoutReady: total > 0 && payoutReady === total,
    releaseReady: (ctx?.releaseEligibleCount ?? 0) > 0,
    settlementReady: state === 'SETTLED',
  };

  const blockers: string[] = [];
  const missing: string[] = [];
  if (total === 0) missing.push('Participants added');
  if (total > 0 && configured < total) {
    missing.push('Earnings configured');
    blockers.push('Configure participant earnings before obligations');
  }
  if (!completeness.fundingReady) missing.push('Revenue sources');
  if ((ctx?.obligationCount ?? 0) === 0) missing.push('Obligations recorded');
  if (total > 0 && payoutReady < total) missing.push('Payout destinations');

  completeness.blockers = blockers;
  completeness.missingRequirements = missing;
  completeness.warnings = [];

  const href = projectParticipantsPath(projectId);
  const actions =
    total > 0 && configured < total
      ? [
          {
            id: 'configure-earnings',
            title: 'Configure participant earnings',
            description: 'Define how each participant earns before obligations.',
            href,
            ctaLabel: 'Configure earnings',
            priority: 1,
          },
        ]
      : [];

  const score =
    total === 0
      ? 10
      : Math.round(
          ((configured / total) * 30 +
            (payoutReady / total) * 30 +
            (completeness.fundingReady ? 20 : 0) +
            ((ctx?.obligationCount ?? 0) > 0 ? 20 : 0)) *
            1
        );

  return {
    projectId,
    state,
    completeness,
    readinessScore: Math.min(100, score),
    readinessLevel: completeness.payoutReady ? 'ready' : blockers.length ? 'partial' : 'none',
    blockers,
    warnings: [],
    missingRequirements: missing,
    nextRecommendedActions: actions,
    needsGuidance: !completeness.setupComplete || !completeness.payoutReady,
  };
}
