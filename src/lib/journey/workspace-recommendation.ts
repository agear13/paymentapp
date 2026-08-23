import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { guidanceDestination, type GuidanceCapability } from '@/lib/journey/guidance-destinations';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';
import type { JourneyAssessmentSnapshot } from '@/lib/journey/journey-assessment-storage.client';

export type WorkspaceRecommendationKind =
  | 'accounting'
  | 'payment_rail'
  | 'settlement'
  | 'participant_earnings'
  | 'workflow'
  | 'branding';

/** Setup-stage only for this pass. Observed behaviour is reserved for later.
 * In-surface guidance uses layer: 'contextual' in contextual-guidance.ts — do not merge. */
export type WorkspaceRecommendationSource = 'setup' | 'observed';

export type WorkspaceRecommendationReason =
  | 'manual_reconciliation'
  | 'payment_collection'
  | 'revenue_share'
  | 'forecasting_workflow'
  | 'reporting_workflow'
  | 'explore_workflows';

export type WorkspaceRecommendation = {
  kind: WorkspaceRecommendationKind;
  source: WorkspaceRecommendationSource;
  reason: WorkspaceRecommendationReason;
  title: string;
  description: string;
  actionLabel: string;
  destination: string;
};

export type WorkspaceRecommendationState = {
  xeroConnected: boolean;
  deployedWorkflowSlugs: string[];
  /** Undefined while configuration is unknown — do not treat as configured. */
  paymentRailConfigured?: boolean;
};

const CONNECTABLE_ACCOUNTING = 'Xero';
const NO_ACCOUNTING = 'None / Spreadsheets';
const PAYMENT_SYSTEMS = new Set(['Stripe', 'GoCardless']);
const NON_CONNECTABLE_ACCOUNTING = new Set(['MYOB', 'QuickBooks', 'NetSuite', NO_ACCOUNTING]);

export function paymentRailConfiguredFromMerchantRails(rails?: {
  stripeEnabled?: boolean;
  wiseEnabled?: boolean;
  stablecoinSettlementsEnabled?: boolean;
  manualBankEnabled?: boolean;
} | null): boolean | undefined {
  if (!rails) return undefined;
  return Boolean(
    rails.stripeEnabled ||
      rails.wiseEnabled ||
      rails.stablecoinSettlementsEnabled ||
      rails.manualBankEnabled
  );
}

export function buildWorkspaceRecommendationState(input: {
  xeroConnected: boolean;
  deployedWorkflowSlugs: string[];
  readinessKnown?: boolean;
  merchantRails?: Parameters<typeof paymentRailConfiguredFromMerchantRails>[0];
}): WorkspaceRecommendationState {
  return {
    xeroConnected: input.xeroConnected,
    deployedWorkflowSlugs: input.deployedWorkflowSlugs,
    paymentRailConfigured: input.readinessKnown
      ? paymentRailConfiguredFromMerchantRails(input.merchantRails)
      : undefined,
  };
}

export function accountingIsConnectable(accounting?: string | null): boolean {
  return accounting?.trim() === CONNECTABLE_ACCOUNTING;
}

export function accountingIsNonConnectable(accounting?: string | null): boolean {
  const value = accounting?.trim();
  return Boolean(value && NON_CONNECTABLE_ACCOUNTING.has(value));
}

export function listedPaymentSystems(systems?: string[] | null): boolean {
  return Boolean(systems?.some((system) => PAYMENT_SYSTEMS.has(system)));
}

function fromGuidance(
  kind: WorkspaceRecommendationKind,
  capability: GuidanceCapability,
  reason: WorkspaceRecommendationReason,
  overrides?: Partial<Pick<WorkspaceRecommendation, 'title' | 'description' | 'actionLabel' | 'destination'>>
): WorkspaceRecommendation {
  const destination = guidanceDestination(capability);
  return {
    kind,
    source: 'setup',
    reason,
    title: overrides?.title ?? destination.title,
    description: overrides?.description ?? destination.description,
    actionLabel: overrides?.actionLabel ?? destination.actionLabel,
    destination: overrides?.destination ?? destination.href,
  };
}

function workflowAlreadyDeployed(slug: string | null | undefined, deployed: string[]): boolean {
  return Boolean(slug && deployed.includes(slug));
}

function canRecommendXero(
  accounting: string | undefined,
  xeroConnected: boolean,
  hasReconciliationSignal: boolean
): boolean {
  return hasReconciliationSignal && accountingIsConnectable(accounting) && !xeroConnected;
}

function accountingRecommendation(): WorkspaceRecommendation {
  return fromGuidance('accounting', 'accounting', 'manual_reconciliation', {
    title: 'Connect Xero',
    description:
      'Connecting Xero lets invoice and payment records sync for accounting reconciliation. You can keep working in Provvy without this.',
    actionLabel: 'Connect Xero',
  });
}

function paymentRailRecommendation(): WorkspaceRecommendation {
  return fromGuidance('payment_rail', 'payment_rail', 'payment_collection');
}

function revenueShareRecommendation(): WorkspaceRecommendation {
  return fromGuidance('workflow', 'workflow', 'revenue_share', {
    title: 'Set up a revenue-sharing workflow',
    description:
      'Choose a workflow to define how participants split and settle revenue. You can start invoicing without this.',
    actionLabel: 'Open Workflow Library',
    destination: COMMERCIAL_OS_ROUTES.workflows,
  });
}

function specificWorkflowRecommendation(
  slug: string,
  reason: Extract<WorkspaceRecommendationReason, 'forecasting_workflow' | 'reporting_workflow'>
): WorkspaceRecommendation | null {
  const catalog = getWorkflowBySlug(slug);
  if (!catalog) return null;
  return fromGuidance('workflow', 'workflow', reason, {
    title: `Explore ${catalog.name}`,
    description: `${catalog.summary} You can add this later — it is not required before you start invoicing.`,
    actionLabel: 'View workflow',
    destination: COMMERCIAL_OS_ROUTES.workflowDetail(catalog.slug),
  });
}

function exploreWorkflowsRecommendation(): WorkspaceRecommendation {
  return fromGuidance('workflow', 'workflow', 'explore_workflows', {
    description:
      'Browse workflows you can add later. Nothing here is required before you create or manage invoices.',
  });
}

/**
 * Current setup-stage recommendation heuristic (temporary).
 *
 * Objective-first: the stated primary objective outweighs a secondary challenge
 * or listed system, unless that secondary signal is required to act on the
 * objective (connecting Xero requires the user to have identified Xero and a
 * genuine reconciliation reason).
 *
 * This is not a scoring engine and is not a permanent user journey.
 * Observed-behaviour recommendations are out of scope.
 */
export function deriveWorkspaceRecommendation(input: {
  snapshot: JourneyAssessmentSnapshot;
  workspace: WorkspaceRecommendationState;
}): WorkspaceRecommendation | null {
  const objective = input.snapshot.objective?.trim() || null;
  const business = input.snapshot.business ?? {};
  const accounting = business.accounting?.trim() || undefined;
  const challenge = business.challenge?.trim() || undefined;
  const hasManualReconciliation = challenge === 'Manual reconciliation';

  if (objective) {
    return recommendationForObjective({
      objective,
      accounting,
      hasManualReconciliation,
      workspace: input.workspace,
    });
  }

  return recommendationFromSecondarySignals({
    accounting,
    challenge,
    systems: business.systems,
    workspace: input.workspace,
  });
}

function recommendationForObjective(input: {
  objective: string;
  accounting: string | undefined;
  hasManualReconciliation: boolean;
  workspace: WorkspaceRecommendationState;
}): WorkspaceRecommendation | null {
  switch (input.objective) {
    case 'paid-faster':
      if (input.workspace.paymentRailConfigured === true) return null;
      return paymentRailRecommendation();

    case 'reconcile':
      if (canRecommendXero(input.accounting, input.workspace.xeroConnected, true)) {
        return accountingRecommendation();
      }
      return exploreWorkflowsRecommendation();

    case 'reduce-admin':
      if (
        canRecommendXero(
          input.accounting,
          input.workspace.xeroConnected,
          input.hasManualReconciliation
        )
      ) {
        return accountingRecommendation();
      }
      return exploreWorkflowsRecommendation();

    case 'revenue-share':
      if (workflowAlreadyDeployed('revenue-sharing', input.workspace.deployedWorkflowSlugs)) {
        return null;
      }
      return revenueShareRecommendation();

    case 'forecast':
      if (workflowAlreadyDeployed('cashflow-forecasting', input.workspace.deployedWorkflowSlugs)) {
        return null;
      }
      return specificWorkflowRecommendation('cashflow-forecasting', 'forecasting_workflow');

    case 'reporting':
      if (workflowAlreadyDeployed('commercial-operations', input.workspace.deployedWorkflowSlugs)) {
        return null;
      }
      return specificWorkflowRecommendation('commercial-operations', 'reporting_workflow');

    case 'other':
      return exploreWorkflowsRecommendation();

    default:
      return null;
  }
}

function recommendationFromSecondarySignals(input: {
  accounting: string | undefined;
  challenge: string | undefined;
  systems?: string[];
  workspace: WorkspaceRecommendationState;
}): WorkspaceRecommendation | null {
  if (canRecommendXero(input.accounting, input.workspace.xeroConnected, input.challenge === 'Manual reconciliation')) {
    return accountingRecommendation();
  }

  if (
    (input.challenge === 'Late payments' || listedPaymentSystems(input.systems)) &&
    input.workspace.paymentRailConfigured !== true
  ) {
    return paymentRailRecommendation();
  }

  if (input.challenge === 'Fragmented systems') {
    return exploreWorkflowsRecommendation();
  }

  return null;
}

export function recommendationSourceLabel(
  recommendation: WorkspaceRecommendation | null
): string | null {
  if (!recommendation) return null;
  if (recommendation.source === 'setup') {
    return 'Based on what you told us during setup';
  }
  return null;
}
