/**
 * OPERATIONAL ORCHESTRATOR — single entry point for global coordination status.
 *
 * Replaces scattered onboarding/activation logic over time.
 * Must never throw; returns degraded-but-valid snapshots on partial failure.
 */

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { GlobalOperationalContext } from '@/lib/operations/types/operational-context';
import type { OperationalCompleteness } from '@/lib/operations/types/operational-completeness';
import { deriveReleaseEligibility } from '@/lib/operations/readiness/release-eligibility';
import { deriveWorkspaceOperationalHealth } from '@/lib/operations/readiness/workspace-readiness';
import { deriveProjectOperationalReadiness } from '@/lib/operations/readiness/project-readiness';
import type { RecommendedAction } from '@/lib/operations/types/readiness-result';
import type { WorkspaceState } from '@/lib/operations/states/workspace-state';

export type OperationalOrchestrationSnapshot = {
  workspaceState: WorkspaceState;
  phaseLabel: string;
  globalCompleteness: OperationalCompleteness;
  activationProgressPercent: number;
  blockers: string[];
  warnings: string[];
  missingRequirements: string[];
  nextRecommendedActions: RecommendedAction[];
  needsGuidance: boolean;
  degraded: boolean;
  releaseEligibleCount: number;
  canCreateRelease: boolean;
};

export type OrchestrateOptions = {
  projects?: Array<{
    project: RecentDeal;
    participants: DemoParticipant[];
    obligationCount?: number;
    hasFundingSources?: boolean;
    releaseEligibleCount?: number;
  }>;
};

export function orchestrateOperations(
  ctx: GlobalOperationalContext,
  options?: OrchestrateOptions
): OperationalOrchestrationSnapshot {
  try {
    const workspace = deriveWorkspaceOperationalHealth(ctx.workspace);
    const release = deriveReleaseEligibility(ctx.workspace);

    const blockers = [...new Set([...workspace.blockers, ...release.blockers])];
    const warnings = [...new Set(workspace.warnings)];
    const missing = [...new Set(workspace.missingRequirements)];

    const actions = [...workspace.nextRecommendedActions];
    if (actions.length === 0 && release.nextRecommendedActions.length > 0) {
      actions.push(...release.nextRecommendedActions);
    }
    actions.sort((a, b) => a.priority - b.priority);

    return {
      workspaceState: workspace.state,
      phaseLabel: workspace.phaseLabel,
      globalCompleteness: workspace.completeness,
      activationProgressPercent: workspace.readinessScore,
      blockers,
      warnings,
      missingRequirements: missing,
      nextRecommendedActions: actions,
      needsGuidance: workspace.needsGuidance,
      degraded: workspace.readinessLevel === 'degraded',
      releaseEligibleCount: release.eligibleCount,
      canCreateRelease: release.canCreateRelease,
    };
  } catch {
    const fallback = deriveWorkspaceOperationalHealth(ctx.workspace);
    return {
      workspaceState: 'DEGRADED',
      phaseLabel: 'Setup incomplete',
      globalCompleteness: fallback.completeness,
      activationProgressPercent: fallback.readinessScore,
      blockers: ['Operational status temporarily unavailable — continue setup'],
      warnings: [],
      missingRequirements: [
        'Configure participant earnings',
        'Add revenue sources',
        'Review obligations',
      ],
      nextRecommendedActions: fallback.nextRecommendedActions,
      needsGuidance: true,
      degraded: true,
      releaseEligibleCount: ctx.workspace.releaseEligibleCount,
      canCreateRelease: false,
    };
  }
}
