import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type {
  OperationalExplainability,
  OperationalGuidanceBundle,
} from '@/lib/operations/explainability/types';
import type { TrustLevel } from '@/lib/operations/explainability/types';
import { deriveNextOperationalActions } from '@/lib/operations/explainability/derive-next-operational-actions';
import { deduplicateOperationalActions } from '@/lib/operations/explainability/deduplicate-operational-actions';
import { deriveOperationalReleaseBlockers } from '@/lib/operations/explainability/derive-operational-release-blockers';
import { deriveReleaseConfidence } from '@/lib/operations/explainability/release-confidence';
import { buildOperationalTimeline } from '@/lib/operations/explainability/operational-timeline';
import { deriveTrustSignals } from '@/lib/operations/explainability/trust-signals';
import {
  explainProjectState,
  explainWorkspaceState,
} from '@/lib/operations/explainability/state-explanations';
import { explainProjectTransition } from '@/lib/operations/explainability/transition-explanations';
import { orchestrateOperations } from '@/lib/operations/orchestration/operational-orchestrator';
import { deriveProjectOperationalReadiness } from '@/lib/operations/readiness/project-readiness';
import { deriveWorkspaceOperationalHealth } from '@/lib/operations/readiness/workspace-readiness';
import {
  deriveParticipantPayoutReadiness,
  summarizeProjectReadinessGaps,
} from '@/lib/operations/readiness/participant-readiness';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';
import { safeProjectState } from '@/lib/operations/guards/hydration-guards';

export type ExplainReadinessInput = {
  workspace: WorkspaceOperationalContext;
  scope?: 'workspace' | 'project';
  scopeTitle?: string;
  project?: RecentDeal | null;
  participants?: DemoParticipant[];
  treasury?: ProjectTreasurySummary | null;
  previousProjectState?: string | null;
};

function buildExplainabilityBullets(
  blockers: string[],
  warnings: string[],
  missing: string[],
  scope: 'workspace' | 'project',
  gaps?: ReturnType<typeof summarizeProjectReadinessGaps>
): { headline: string; bullets: string[] } {
  const bullets: string[] = [];

  if (blockers.length > 0) {
    bullets.push(...blockers.map((b) => `• ${b}`));
  }
  if (gaps && gaps.gapLabels.length > 0 && scope === 'project') {
    for (const label of gaps.gapLabels) {
      bullets.push(`• ${label} incomplete on this project`);
    }
  }
  if (warnings.length > 0) {
    bullets.push(...warnings.map((w) => `• ${w}`));
  }
  if (missing.length > 0 && bullets.length < 6) {
    for (const m of missing.slice(0, 4)) {
      if (!bullets.some((b) => b.includes(m))) bullets.push(`• Still needed: ${m}`);
    }
  }

  const headline =
    blockers.length > 0
      ? `Release blocked because:`
      : warnings.length > 0
        ? 'Coordination in progress — attention needed:'
        : missing.length > 0
          ? 'Setup progressing — remaining items:'
          : 'Ready for next coordination step';

  return { headline, bullets: bullets.map((b) => (b.startsWith('•') ? b.slice(2).trim() : b)) };
}

function trustFromLevel(
  readinessLevel: string,
  confidence: string,
  degraded: boolean
): TrustLevel {
  if (degraded) return 'risk';
  if (confidence === 'BLOCKED' || readinessLevel === 'blocked') return 'attention';
  if (confidence === 'HIGH' && readinessLevel === 'ready') return 'healthy';
  if (readinessLevel === 'degraded') return 'attention';
  return 'unknown';
}

/**
 * Central explainability engine — WHY readiness looks the way it does.
 */
export function explainOperationalReadiness(
  input: ExplainReadinessInput
): OperationalExplainability {
  const scope = input.scope ?? (input.project ? 'project' : 'workspace');
  const orch = orchestrateOperations({ workspace: input.workspace });
  const workspaceHealth = deriveWorkspaceOperationalHealth(input.workspace);

  let readinessScore = orch.activationProgressPercent;
  let readinessLevel = workspaceHealth.readinessLevel;
  let blockers = [...orch.blockers];
  let warnings = [...orch.warnings];
  let missing = [...orch.missingRequirements];
  let phaseLabel = orch.phaseLabel;
  let actions = [...orch.nextRecommendedActions];

  const participants = input.participants ?? [];
  const gaps =
    participants.length > 0 ? summarizeProjectReadinessGaps(participants) : undefined;

  if (scope === 'project' && input.project) {
    const proj = deriveProjectOperationalReadiness(input.project, participants, {
      projectId: input.project.id,
      hasFundingSources: input.treasury?.hasFundingSources ?? false,
      obligationCount: input.treasury?.obligationsTotal ?? input.workspace.obligationCount,
      releaseEligibleCount: input.treasury?.obligationsReady ?? input.workspace.releaseEligibleCount,
      participantCount: participants.length,
      participantsPayoutReadyCount: gaps?.payoutReadyCount ?? 0,
      participantsConfiguredCount: participants.filter(
        (p) => deriveParticipantPayoutReadiness(p).flags.hasCompensation
      ).length,
      providerConnected:
        input.workspace.stripeConfigured ||
        input.workspace.wiseConfigured ||
        input.workspace.hederaConfigured,
    });
    readinessScore = proj.readinessScore;
    readinessLevel = proj.readinessLevel;
    blockers = [...new Set([...blockers, ...proj.blockers])];
    missing = [...new Set([...missing, ...proj.missingRequirements])];
    if (proj.nextRecommendedActions.length) actions = proj.nextRecommendedActions;
    phaseLabel = proj.state;
  }

  const releaseConf = deriveReleaseConfidence({
    workspace: input.workspace,
    participants,
    treasury: input.treasury,
  });

  const { headline, bullets } = buildExplainabilityBullets(
    blockers,
    warnings,
    missing,
    scope,
    gaps
  );

  return {
    readinessLevel,
    readinessScore,
    blockers,
    warnings,
    missingRequirements: missing,
    confidence: releaseConf.level,
    nextRecommendedActions: actions,
    explainability: { headline, bullets },
    trustState: trustFromLevel(readinessLevel, releaseConf.level, orch.degraded),
    phaseLabel,
    scopeTitle: input.scopeTitle ?? (scope === 'project' ? 'Project' : 'Workspace'),
  };
}

export function buildOperationalGuidance(
  input: ExplainReadinessInput
): OperationalGuidanceBundle {
  try {
    const explanation = explainOperationalReadiness(input);
    const scope = input.scope ?? (input.project ? 'project' : 'workspace');
    const participants = input.participants ?? [];

    const stateExplanation =
      scope === 'project' && input.project
        ? explainProjectState(
            safeProjectState(input.project),
            explanation.blockers
          )
        : explainWorkspaceState(
            deriveWorkspaceOperationalHealth(input.workspace).state,
            explanation.blockers
          );

    const actions = deduplicateOperationalActions(
      deriveNextOperationalActions(explanation, input.workspace)
    );
    const trustSignals = deriveTrustSignals({
      workspace: input.workspace,
      treasury: input.treasury,
    });
    const releaseConfidence = deriveReleaseConfidence({
      workspace: input.workspace,
      participants,
      treasury: input.treasury,
    });
    const timeline = buildOperationalTimeline({
      workspace: input.workspace,
      projectName: input.project?.dealName,
    });

    let transition = null;
    if (scope === 'project' && input.project && input.previousProjectState) {
      const to = safeProjectState(input.project);
      transition = explainProjectTransition(
        input.previousProjectState as Parameters<typeof explainProjectTransition>[0],
        to,
        explanation.explainability.bullets
      );
    }

    return {
      explanation,
      stateExplanation,
      actions,
      trustSignals,
      releaseConfidence,
      releaseBlockers: deriveOperationalReleaseBlockers({
        snapshot: {
          participants: [],
          obligations: [],
          summary: {
            participantCount: input.participants?.length ?? 0,
            earningsConfiguredCount: input.workspace.participantsConfiguredCount,
            payoutReadyCount: 0,
            releaseReadyCount: input.workspace.releaseEligibleCount,
            blockerCount: explanation.blockers.length,
            allBlockers: [],
          },
          funding: { allocated: false, stage: null },
        },
        workspace: input.workspace,
        graphReady: true,
      }),
      timeline,
      transition,
      degraded: deriveWorkspaceOperationalHealth(input.workspace).readinessLevel === 'degraded',
    };
  } catch {
    const fallbackExplanation: OperationalExplainability = {
      readinessLevel: 'degraded',
      readinessScore: 0,
      blockers: ['Operational status temporarily unavailable — continue setup'],
      warnings: [],
      missingRequirements: [
        'Configure participant earnings',
        'Add revenue sources',
        'Review obligations',
      ],
      confidence: 'BLOCKED',
      nextRecommendedActions: [],
      explainability: {
        headline: 'Operational guidance unavailable',
        bullets: [
          'Continue configuring participants and funding',
          'Refresh this page if status does not update',
        ],
      },
      trustState: 'unknown',
      phaseLabel: 'Setup incomplete',
      scopeTitle: input.scopeTitle ?? 'Workspace',
    };
    return {
      explanation: fallbackExplanation,
      stateExplanation: explainWorkspaceState('DEGRADED', fallbackExplanation.blockers),
      actions: deduplicateOperationalActions(
        deriveNextOperationalActions(fallbackExplanation, input.workspace)
      ),
      trustSignals: deriveTrustSignals({ workspace: input.workspace }),
      releaseConfidence: deriveReleaseConfidence({
        workspace: input.workspace,
        participants: input.participants,
      }),
      releaseBlockers: [],
      timeline: buildOperationalTimeline({ workspace: input.workspace }),
      transition: null,
      degraded: true,
    };
  }
}
