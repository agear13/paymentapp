import type { OperationalAction } from '@/lib/operations/explainability/types';
import type { OperationalExplainability } from '@/lib/operations/explainability/types';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import { safeOperationalNavigation } from '@/lib/operations/routing/operational-route-recovery';
import {
  PAYOUTS_OBLIGATIONS_HREF,
  PAYOUTS_SETTLEMENTS_HREF,
} from '@/lib/navigation/operator-nav';

/**
 * Priority: critical blockers → funding → participants → obligations → settlement → archive
 */
export function deriveNextOperationalActions(
  explanation: OperationalExplainability,
  ctx: WorkspaceOperationalContext
): OperationalAction[] {
  const actions: OperationalAction[] = [];
  const projectHref = safeOperationalNavigation('configure_earnings', ctx.primaryProjectId);

  const participantsConfigured =
    ctx.participantCount > 0 &&
    ctx.participantsConfiguredCount >= ctx.participantCount;
  const provider =
    ctx.stripeConfigured || ctx.wiseConfigured || ctx.hederaConfigured;

  if (ctx.participantCount > 0 && !participantsConfigured) {
    actions.push({
      id: 'configure-earnings',
      action: 'Configure participant earnings',
      reason: `${ctx.participantCount - ctx.participantsConfiguredCount} participant${ctx.participantCount - ctx.participantsConfiguredCount === 1 ? '' : 's'} cannot receive payouts yet`,
      impact: 'Release readiness blocked until earnings are saved',
      urgency: 'critical',
      destination: projectHref,
      ctaLabel: 'Configure earnings',
    });
  }

  if (!provider && (participantsConfigured || ctx.participantCount === 0)) {
    actions.push({
      id: 'connect-provider',
      action: 'Connect payment provider',
      reason: 'Revenue cannot be collected without an active provider',
      impact: 'Funding and obligation funding blocked',
      urgency: 'high',
      destination: '/dashboard/settings/merchant',
      ctaLabel: 'Connect provider',
    });
  }

  if (provider && ctx.paymentLinkCount === 0 && ctx.collectionPreferenceDecideLater) {
    actions.push({
      id: 'revenue-sources',
      action: 'Add revenue sources',
      reason: 'No invoices or collection method configured',
      impact: 'Obligations may lack funding backing',
      urgency: 'high',
      destination: '/dashboard/payment-links',
      ctaLabel: 'Add revenue',
    });
  }

  if (participantsConfigured && ctx.obligationCount === 0) {
    actions.push({
      id: 'obligations',
      action: 'Record obligations',
      reason: 'Payout coordination requires tracked obligations',
      impact: 'Release batches cannot be created',
      urgency: 'medium',
      destination: safeOperationalNavigation('review_obligations', ctx.primaryProjectId),
      ctaLabel: 'View obligations',
    });
  }

  if (ctx.releaseEligibleCount > 0 && participantsConfigured && provider) {
    actions.push({
      id: 'create-release',
      action: 'Review payout release',
      reason: `${ctx.releaseEligibleCount} obligation${ctx.releaseEligibleCount === 1 ? '' : 's'} eligible for release`,
      impact: 'Moves coordination toward settlement',
      urgency: 'medium',
      destination: PAYOUTS_SETTLEMENTS_HREF,
      ctaLabel: 'Create release',
    });
  }

  for (const rec of explanation.nextRecommendedActions) {
    if (actions.some((a) => a.id === rec.id)) continue;
    actions.push({
      id: rec.id,
      action: rec.title,
      reason: rec.description,
      impact: 'Advances operational coordination',
      urgency: 'medium',
      destination: rec.href,
      ctaLabel: rec.ctaLabel,
    });
  }

  for (const blocker of explanation.blockers) {
    if (
      actions.some((a) => a.reason.includes(blocker) || a.action.includes(blocker))
    ) {
      continue;
    }
    actions.push({
      id: `blocker-${actions.length}`,
      action: 'Resolve blocker',
      reason: blocker,
      impact: 'Progress blocked until resolved',
      urgency: 'critical',
      destination: projectHref,
    });
  }

  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return actions.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
}
