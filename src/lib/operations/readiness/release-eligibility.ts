import { resolveAnyRailConfigured } from '@/lib/onboarding/workspace-activation-state';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import type { OperationalReadinessResult } from '@/lib/operations/types/readiness-result';
import { emptyReadiness } from '@/lib/operations/types/readiness-result';
import { PAYOUTS_SETTLEMENTS_HREF } from '@/lib/navigation/operator-nav';

export type ReleaseEligibilityResult = OperationalReadinessResult & {
  eligibleCount: number;
  canCreateRelease: boolean;
};

/**
 * Release eligibility — validates orchestration preconditions without executing payout logic.
 */
export function deriveReleaseEligibility(
  ctx: WorkspaceOperationalContext
): ReleaseEligibilityResult {
  const blockers: string[] = [];
  const participantsConfigured =
    ctx.participantCount > 0 &&
    ctx.participantsConfiguredCount >= ctx.participantCount;

  if (!participantsConfigured) {
    blockers.push('Participant compensation not fully configured');
  }
  if (ctx.obligationCount === 0) {
    blockers.push('No obligations tracked');
  }
  const provider =
    resolveAnyRailConfigured(ctx);
  if (!provider) {
    blockers.push('No payment provider connected');
  }

  const eligibleCount = ctx.releaseEligibleCount;
  const canCreateRelease = eligibleCount > 0 && blockers.length === 0;

  return {
    ...emptyReadiness({
      readinessScore: canCreateRelease ? 100 : eligibleCount > 0 ? 60 : 20,
      readinessLevel: canCreateRelease ? 'ready' : blockers.length ? 'blocked' : 'partial',
      blockers,
      needsGuidance: !canCreateRelease,
    }),
    eligibleCount,
    canCreateRelease,
    nextRecommendedActions: canCreateRelease
      ? [
          {
            id: 'release',
            title: 'Create payout release batch',
            description: `${eligibleCount} payout${eligibleCount === 1 ? '' : 's'} ready for release.`,
            href: PAYOUTS_SETTLEMENTS_HREF,
            ctaLabel: 'Create release batch',
            priority: 1,
          },
        ]
      : [],
  };
}
