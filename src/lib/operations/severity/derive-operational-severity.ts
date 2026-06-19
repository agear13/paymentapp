import type { OperationalGuidanceBundle } from '@/lib/operations/explainability';
import type { OperationalReleaseBlockerDetail } from '@/lib/operations/explainability/derive-operational-release-blockers';
import { deriveOperationalReleaseBlockers } from '@/lib/operations/explainability/derive-operational-release-blockers';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import type { AttentionItem, OperationalSeverity } from '@/lib/operations/severity/types';
import {
  CONFIDENCE_HEADLINES,
  humanizeOperatorText,
  OPERATOR_LABELS,
} from '@/lib/operations/design-language';
import { safeOperationalNavigation } from '@/lib/operations/routing/operational-route-recovery';
import { PAYOUTS_SETTLEMENTS_HREF, PAYOUTS_OBLIGATIONS_HREF } from '@/lib/navigation/operator-nav';

export type SeverityDerivationInput = {
  guidance: OperationalGuidanceBundle;
  workspace: WorkspaceOperationalContext;
  projectName?: string;
  /** Canonical reducer KPIs — when set, overrides workspace activation counters. */
  kpis?: OperationalKPIs | null;
};

function severityForBlocker(
  blocker: OperationalReleaseBlockerDetail,
  conf: string
): OperationalSeverity {
  if (blocker.category === 'operational_graph_initializing') return 'ACTION_REQUIRED';
  if (blocker.category === 'obligation_sync_pending' && !blocker.operatorActionRequired) {
    return 'ACTION_REQUIRED';
  }
  return conf === 'BLOCKED' ? 'CRITICAL' : 'ACTION_REQUIRED';
}

function severityRank(s: OperationalSeverity): number {
  return { CRITICAL: 0, ACTION_REQUIRED: 1, WARNING: 2, INFORMATIONAL: 3 }[s];
}

/**
 * Maps workspace/project signals into operator attention items by severity.
 */
export function deriveOperationalSeverity(input: SeverityDerivationInput): AttentionItem[] {
  const { guidance, workspace } = input;
  const items: AttentionItem[] = [];
  const projectId = workspace.primaryProjectId ?? null;
  const earningsHref = safeOperationalNavigation('configure_earnings', projectId);
  const obligationsHref = safeOperationalNavigation('review_obligations', projectId);
  const conf = guidance.releaseConfidence.level;

  const participantCount = input.kpis?.participantCount ?? workspace.participantCount;
  const earningsConfiguredCount =
    input.kpis?.earningsConfiguredCount ?? workspace.participantsConfiguredCount;
  const obligationCount = input.kpis?.obligationCount ?? workspace.obligationCount;
  const releaseEligibleCount =
    input.kpis?.releaseEligibleCount ?? workspace.releaseEligibleCount;

  const participantsIncomplete =
    participantCount > 0 && earningsConfiguredCount < participantCount;

  if (participantsIncomplete) {
    const missing = participantCount - earningsConfiguredCount;
    items.push({
      id: 'participants-incomplete',
      severity: 'ACTION_REQUIRED',
      title: `${missing} participant${missing === 1 ? '' : 's'} — earnings still need setup`,
      explanation: 'Configure how each participant earns before tracking payout obligations.',
      projectName: input.projectName,
      ctaLabel: 'Configure participant earnings',
      ctaHref: earningsHref,
      confidenceImpact: 'Blocks safe release',
      whyBlocked: `${missing} participant${missing === 1 ? ' has' : 's have'} not completed payout setup.`,
      whatUnlocks: 'Save earnings for each participant, then send supplier onboarding.',
      recommendedStep: 'Configure participant earnings',
    });
  }

  const provider =
    workspace.stripeConfigured || workspace.wiseConfigured || workspace.hederaConfigured;
  if (provider && !workspace.wiseConfigured && workspace.stripeConfigured) {
    items.push({
      id: 'provider-partial',
      severity: 'WARNING',
      title: 'Stripe connected — additional payout methods optional',
      explanation: 'You can add Wise or other methods when needed for international payouts.',
      ctaLabel: 'Payment settings',
      ctaHref: '/dashboard/settings/merchant',
      confidenceImpact: 'No immediate release block',
    });
  }

  if (!provider && participantCount > 0) {
    items.push({
      id: 'provider-missing',
      severity: 'ACTION_REQUIRED',
      title: 'Connect a payment provider to collect revenue',
      explanation: 'Funding must flow in before payouts can be released safely.',
      ctaHref: '/dashboard/settings/merchant',
      ctaLabel: 'Connect provider',
      confidenceImpact: 'Blocks funding and release',
    });
  }

  if (releaseEligibleCount > 0 && conf !== 'BLOCKED') {
    items.push({
      id: 'release-ready',
      severity: 'INFORMATIONAL',
      title: `${releaseEligibleCount} payout${releaseEligibleCount === 1 ? '' : 's'} ${OPERATOR_LABELS.safeToRelease.toLowerCase()}`,
      explanation: CONFIDENCE_HEADLINES[conf],
      ctaHref: PAYOUTS_SETTLEMENTS_HREF,
      ctaLabel: 'Review payout release',
      confidenceImpact: 'Positive',
    });
  }

  if (obligationCount === 0 && participantCount > 0 && !participantsIncomplete) {
    items.push({
      id: 'no-obligations',
      severity: 'INFORMATIONAL',
      title: 'No payout obligations tracked yet',
      explanation: 'Customer payments will create payout obligations automatically.',
      ctaHref: obligationsHref,
      ctaLabel: 'View obligations',
    });
  }

  const releaseBlockers =
    guidance.releaseBlockers.length > 0
      ? guidance.releaseBlockers
      : deriveOperationalReleaseBlockers({
          snapshot: {
            participants: [],
            obligations: [],
            summary: {
              participantCount,
              earningsConfiguredCount,
              payoutReadyCount: input.kpis?.payoutReadyCount ?? 0,
              releaseReadyCount: releaseEligibleCount,
              blockerCount: guidance.explanation.blockers.length,
              allBlockers: [],
            },
            funding: { allocated: false, stage: null },
          },
          workspace,
          graphReady: !guidance.degraded,
          initializationRecoveryMessage: guidance.degraded
            ? guidance.explanation.blockers[0]
            : null,
        });

  if (releaseBlockers.length > 0 && !participantsIncomplete) {
    for (const blocker of releaseBlockers) {
      items.push({
        id: blocker.id,
        severity: severityForBlocker(blocker, conf),
        title: blocker.reason,
        explanation: blocker.remediation,
        projectName: input.projectName,
        ctaLabel: blocker.ctaLabel,
        ctaHref: blocker.ctaHref,
        confidenceImpact: blocker.operatorActionRequired
          ? 'Prevents safe payout release'
          : 'State not yet converged — refresh required',
        whyBlocked: blocker.reason,
        whatUnlocks: blocker.unlockCondition,
        recommendedStep: blocker.remediation,
      });
    }
  } else if ((conf === 'BLOCKED' || guidance.explanation.blockers.length > 0) && !participantsIncomplete) {
    for (const blocker of guidance.explanation.blockers) {
      const human = humanizeOperatorText(blocker);
      if (/compensation|earnings|participant payout/i.test(blocker)) continue;
      items.push({
        id: `blocker-${blocker.slice(0, 24)}`,
        severity: conf === 'BLOCKED' ? 'CRITICAL' : 'ACTION_REQUIRED',
        title: `${OPERATOR_LABELS.releaseBlocked}: ${human}`,
        explanation: human,
        projectName: input.projectName,
        ctaLabel: 'Resolve issue',
        ctaHref: earningsHref,
        confidenceImpact: 'Prevents safe payout release',
        whyBlocked: human,
        whatUnlocks: 'Resolve this item to restore release confidence.',
      });
    }
  }

  for (const w of guidance.explanation.warnings) {
    if (items.some((i) => i.explanation.includes(w))) continue;
    items.push({
      id: `warn-${w.slice(0, 16)}`,
      severity: 'WARNING',
      title: humanizeOperatorText(w),
      explanation: w,
      confidenceImpact: 'May delay release',
    });
  }

  if (items.length === 0) {
    items.push({
      id: 'healthy',
      severity: 'INFORMATIONAL',
      title: 'Workspace coordination is progressing',
      explanation: 'Review funding and participant setup as your projects grow.',
      ctaHref: '/dashboard/projects',
      ctaLabel: 'View projects',
    });
  }

  return items.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

export function groupAttentionBySeverity(
  items: AttentionItem[]
): Record<OperationalSeverity, AttentionItem[]> {
  return {
    CRITICAL: items.filter((i) => i.severity === 'CRITICAL'),
    ACTION_REQUIRED: items.filter((i) => i.severity === 'ACTION_REQUIRED'),
    WARNING: items.filter((i) => i.severity === 'WARNING'),
    INFORMATIONAL: items.filter((i) => i.severity === 'INFORMATIONAL'),
  };
}

export function countAttentionMetrics(items: AttentionItem[]) {
  const critical = items.filter((i) => i.severity === 'CRITICAL').length;
  const action = items.filter((i) => i.severity === 'ACTION_REQUIRED').length;
  const warning = items.filter((i) => i.severity === 'WARNING').length;
  return {
    needsAttention: critical + action + warning,
    criticalCount: critical,
    actionCount: action,
    fundingPending: items.filter((i) => /funding|revenue|invoice/i.test(i.title)).length,
    participantsIncomplete: items.filter((i) => /participant/i.test(i.title)).length,
  };
}
