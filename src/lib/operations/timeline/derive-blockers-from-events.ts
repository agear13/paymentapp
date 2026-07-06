import { resolveAnyRailConfigured } from '@/lib/onboarding/workspace-activation-state';
import type { OperationalEventType } from '@/lib/operations/contracts/operational-events';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import type { EventDerivedBlocker, OperationalTimelineReducerState } from '@/lib/operations/timeline/types';

type BlockerRule = {
  id: string;
  category: string;
  missingEventType: OperationalEventType;
  reason: string;
  remediation: string;
  applies: (ctx: WorkspaceOperationalContext) => boolean;
  severity: 'blocking' | 'warning';
};

const BLOCKER_RULES: BlockerRule[] = [
  {
    id: 'event-provider-missing',
    category: 'provider_missing',
    missingEventType: 'STRIPE_CONNECT_COMPLETED',
    reason: 'Payment provider connection has not been recorded in the operational event stream.',
    remediation: 'Complete Stripe Connect onboarding to enable revenue collection.',
    applies: (ctx) => !resolveAnyRailConfigured(ctx),
    severity: 'blocking',
  },
  {
    id: 'event-graph-initializing',
    category: 'operational_graph_initializing',
    missingEventType: 'OPERATIONAL_GRAPH_INITIALIZED',
    reason: 'Operational graph initialization event has not converged.',
    remediation: 'Wait for coordination snapshot convergence or reload settlement infrastructure.',
    applies: () => true,
    severity: 'blocking',
  },
  {
    id: 'event-compensation-missing',
    category: 'compensation_configuration_missing',
    missingEventType: 'PARTICIPANT_COMPENSATION_UPDATED',
    reason: 'No participant compensation update events observed.',
    remediation: 'Configure participant earnings so obligations can be generated.',
    applies: (ctx) =>
      ctx.participantCount > 0 &&
      ctx.participantsConfiguredCount < ctx.participantCount,
    severity: 'blocking',
  },
  {
    id: 'event-agreement-missing',
    category: 'participant_approval_missing',
    missingEventType: 'AGREEMENT_APPROVED',
    reason: 'No agreement approval events recorded for participants.',
    remediation: 'Share and collect participation agreement approvals.',
    applies: (ctx) => ctx.participantCount > 0 && ctx.releaseEligibleCount === 0,
    severity: 'warning',
  },
  {
    id: 'event-funding-missing',
    category: 'funding_missing',
    missingEventType: 'FUNDING_ALLOCATION_RESERVED',
    reason: 'Funding allocation has not been reserved against obligations.',
    remediation: 'Confirm customer payments and reserve funding against payout obligations.',
    applies: (ctx) => ctx.obligationCount > 0 && ctx.releaseEligibleCount === 0,
    severity: 'warning',
  },
];

/**
 * Blocker explainability derived from missing canonical coordination events.
 */
export function deriveBlockersFromEvents(input: {
  state: OperationalTimelineReducerState;
  workspace: WorkspaceOperationalContext;
  graphSnapshotConverged?: boolean;
}): EventDerivedBlocker[] {
  const blockers: EventDerivedBlocker[] = [];

  for (const rule of BLOCKER_RULES) {
    if (!rule.applies(input.workspace)) continue;
    if (input.state.observedTypes.has(rule.missingEventType)) continue;

    if (
      rule.missingEventType === 'OPERATIONAL_GRAPH_INITIALIZED' &&
      input.graphSnapshotConverged === true
    ) {
      continue;
    }

    blockers.push({
      id: rule.id,
      category: rule.category,
      reason: rule.reason,
      remediation: rule.remediation,
      missingEventType: rule.missingEventType,
      severity: rule.severity,
    });
  }

  return blockers;
}
