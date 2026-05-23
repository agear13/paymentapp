import type { NextRecommendedAction } from '@/lib/onboarding/next-recommended-action';
import { deriveNextRecommendedAction } from '@/lib/onboarding/next-recommended-action';
import type { WorkspaceActivationSnapshot } from '@/lib/onboarding/workspace-activation-types';

export type ContextualRouteKind =
  | 'collection_settlement'
  | 'participants'
  | 'default';

export const PAYMENT_RAILS_ANCHOR = 'payment-rails';

export const COLLECTION_SETTLEMENT_PATH = '/dashboard/settings/merchant';

export function collectionSettlementHref(anchor = PAYMENT_RAILS_ANCHOR): string {
  return `${COLLECTION_SETTLEMENT_PATH}#${anchor}`;
}

export function detectContextualRoute(currentRoute: string): ContextualRouteKind {
  const path = currentRoute.toLowerCase();
  if (
    path.includes('/settings/merchant') ||
    path.includes('collection-settlement') ||
    path.includes('collection_settlement') ||
    path.includes('payment-rail') ||
    path.includes('stripe')
  ) {
    return 'collection_settlement';
  }
  if (path.includes('/participants')) {
    return 'participants';
  }
  return 'default';
}

export function arePaymentRailsIncomplete(
  workspaceState: WorkspaceActivationSnapshot | null | undefined
): boolean {
  if (!workspaceState) return true;
  return !workspaceState.providerConnected || !workspaceState.payoutMethodConfigured;
}

export function derivePaymentRailBlockers(
  workspaceState: WorkspaceActivationSnapshot
): string[] {
  const blockers: string[] = [];
  if (!workspaceState.providerConnected) {
    blockers.push('No payment provider connected');
  }
  if (!workspaceState.payoutMethodConfigured) {
    blockers.push('Settlement rail incomplete');
  }
  if (!workspaceState.revenueConfigured) {
    blockers.push('Revenue collection not ready');
  }
  return blockers;
}

export function buildPaymentRailNextStep(
  workspaceState: WorkspaceActivationSnapshot,
  options?: { instructionalOnly?: boolean }
): NextRecommendedAction {
  return {
    id: 'payment-rails',
    title: 'Complete payment rail setup',
    description:
      'Configure how your workspace collects customer payments and settles obligations before participant payouts can be coordinated.',
    href: collectionSettlementHref(),
    ctaLabel: 'Set up payment rails',
    blockers: derivePaymentRailBlockers(workspaceState),
    instructionalOnly: options?.instructionalOnly,
  };
}

export type ContextualNextStepInput = {
  currentRoute: string;
  workspaceState: WorkspaceActivationSnapshot | null | undefined;
  operationalGuidance?: NextRecommendedAction | null;
};

/**
 * Presentation-only prioritization: visible workflow context before global blockers.
 * Does not alter underlying activation truth.
 */
export function resolveContextualNextStep(
  input: ContextualNextStepInput
): NextRecommendedAction | null {
  const { currentRoute, workspaceState, operationalGuidance } = input;
  if (!workspaceState) {
    return operationalGuidance ?? null;
  }

  const routeKind = detectContextualRoute(currentRoute);
  const globalAction =
    operationalGuidance ?? deriveNextRecommendedAction(workspaceState);

  if (routeKind === 'collection_settlement' && arePaymentRailsIncomplete(workspaceState)) {
    return buildPaymentRailNextStep(workspaceState, { instructionalOnly: true });
  }

  if (routeKind === 'collection_settlement' && !workspaceState.participantsConfigured) {
    const earningsAction = deriveNextRecommendedAction(workspaceState);
    if (earningsAction.id === 'compensation' || !workspaceState.participantsConfigured) {
      return {
        ...earningsAction,
        description:
          'Payment rails are configured. Define how each participant earns before tracking obligations.',
      };
    }
  }

  return globalAction;
}

export function shouldPrioritizePaymentRailsContext(
  currentRoute: string,
  workspaceState: WorkspaceActivationSnapshot | null | undefined
): boolean {
  return (
    detectContextualRoute(currentRoute) === 'collection_settlement' &&
    arePaymentRailsIncomplete(workspaceState)
  );
}
