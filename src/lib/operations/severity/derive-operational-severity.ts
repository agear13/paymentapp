import type { OperationalGuidanceBundle } from '@/lib/operations/explainability';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import type { AttentionItem, OperationalSeverity } from '@/lib/operations/severity/types';
import {
  CONFIDENCE_HEADLINES,
  humanizeOperatorText,
  OPERATOR_LABELS,
} from '@/lib/operations/design-language';
import { projectParticipantsPath } from '@/lib/projects/project-routes';
import { PAYOUTS_SETTLEMENTS_HREF, PAYOUTS_OBLIGATIONS_HREF } from '@/lib/navigation/operator-nav';

export type SeverityDerivationInput = {
  guidance: OperationalGuidanceBundle;
  workspace: WorkspaceOperationalContext;
  projectName?: string;
};

function severityRank(s: OperationalSeverity): number {
  return { CRITICAL: 0, ACTION_REQUIRED: 1, WARNING: 2, INFORMATIONAL: 3 }[s];
}

/**
 * Maps workspace/project signals into operator attention items by severity.
 */
export function deriveOperationalSeverity(input: SeverityDerivationInput): AttentionItem[] {
  const { guidance, workspace } = input;
  const items: AttentionItem[] = [];
  const projectHref = workspace.primaryProjectId
    ? projectParticipantsPath(workspace.primaryProjectId)
    : '/dashboard/projects';
  const conf = guidance.releaseConfidence.level;

  if (conf === 'BLOCKED' || guidance.explanation.blockers.length > 0) {
    for (const blocker of guidance.explanation.blockers) {
      const human = humanizeOperatorText(blocker);
      const isComp = /compensation|earnings|participant/i.test(blocker);
      items.push({
        id: `blocker-${blocker.slice(0, 24)}`,
        severity: conf === 'BLOCKED' ? 'CRITICAL' : 'ACTION_REQUIRED',
        title: isComp
          ? `${OPERATOR_LABELS.releaseBlocked}: participant payout setup incomplete`
          : `${OPERATOR_LABELS.releaseBlocked}: ${human}`,
        explanation: human,
        projectName: input.projectName,
        ctaLabel: isComp ? 'Configure participant earnings' : 'Resolve issue',
        ctaHref: isComp ? projectHref : projectHref,
        confidenceImpact: 'Prevents safe payout release',
        whyBlocked: human,
        whatUnlocks: isComp
          ? 'Each participant needs earnings configured and payout destination before funds can be released safely.'
          : 'Resolve this item to restore release confidence.',
        recommendedStep: guidance.actions[0]?.action,
      });
    }
  }

  const participantsIncomplete =
    workspace.participantCount > 0 &&
    workspace.participantsConfiguredCount < workspace.participantCount;
  if (participantsIncomplete && !items.some((i) => i.id.startsWith('participants-'))) {
    const missing = workspace.participantCount - workspace.participantsConfiguredCount;
    items.push({
      id: 'participants-incomplete',
      severity: 'ACTION_REQUIRED',
      title: `${missing} participant${missing === 1 ? '' : 's'} need payout setup`,
      explanation: 'Configure how each participant earns before tracking payout obligations.',
      projectName: input.projectName,
      ctaLabel: 'Configure participant earnings',
      ctaHref: projectHref,
      confidenceImpact: 'Blocks safe release',
      whyBlocked: `${missing} participant${missing === 1 ? ' has' : 's have'} not completed payout setup.`,
      whatUnlocks: 'Save earnings for each participant, then confirm payout destinations.',
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

  if (!provider && workspace.participantCount > 0) {
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

  if (workspace.releaseEligibleCount > 0 && conf !== 'BLOCKED') {
    items.push({
      id: 'release-ready',
      severity: 'INFORMATIONAL',
      title: `${workspace.releaseEligibleCount} payout${workspace.releaseEligibleCount === 1 ? '' : 's'} ${OPERATOR_LABELS.safeToRelease.toLowerCase()}`,
      explanation: CONFIDENCE_HEADLINES[conf],
      ctaHref: PAYOUTS_SETTLEMENTS_HREF,
      ctaLabel: 'Review payout release',
      confidenceImpact: 'Positive',
    });
  }

  if (workspace.obligationCount === 0 && workspace.participantCount > 0 && participantsIncomplete === false) {
    items.push({
      id: 'no-obligations',
      severity: 'INFORMATIONAL',
      title: 'No payout obligations tracked yet',
      explanation: 'Customer payments will create payout obligations automatically.',
      ctaHref: PAYOUTS_OBLIGATIONS_HREF,
      ctaLabel: 'View obligations',
    });
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
