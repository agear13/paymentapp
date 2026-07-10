/**
 * Workflow Navigation Engine
 *
 * The single source of truth for all CTA destinations in Provvypay.
 *
 * No component determines its own routing.
 * Every button, link, and redirect resolves through this module.
 *
 * Extends the lower-level workflow-context.ts stage derivation with
 * full navigation intent, including scroll targets and page section anchors.
 */

import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';
import {
  deriveWorkflowContext,
  type WorkflowStage,
  type WorkflowInputData,
} from '@/components/workflow/workflow-context';
import { MERCHANT_STRIPE_HREF } from '@/lib/navigation/operator-nav';

/* ─── Route constants ─── */

const DASHBOARD_HREF = '/dashboard';
const MERCHANT_SETTINGS_HREF = '/dashboard/settings/merchant';

function agreementBase(projectId: string): string {
  return `/dashboard/projects/${encodeURIComponent(projectId)}`;
}

/* ─── Intent types ─── */

/**
 * A resolved navigation destination.
 * Every CTA in the app resolves to one of these.
 */
export type NavigationDestination = {
  /** The URL to navigate to */
  href: string;
  /** Button/link label */
  label: string;
  /** Estimated minutes to complete the action */
  estimatedMinutes: number;
  /** One-sentence reason for this destination */
  reason: string;
  /** Optional scroll anchor (e.g. "#payment-provider") */
  anchor?: string;
};

/* ─── resolveWorkflowDestination ─── */

/**
 * Given a workflow stage + projectId, resolve where the operator should go next.
 * This is the primary function for all "Continue" buttons.
 *
 * Stage → destination mapping is deliberate and documented.
 * Never send operators to a generic page when they need specific work.
 */
export function resolveWorkflowDestination(
  stage: WorkflowStage,
  projectId: string
): NavigationDestination {
  const base = agreementBase(projectId);

  switch (stage) {
    case 'setup':
      return {
        href: `${base}/participants`,
        label: 'Add team member',
        estimatedMinutes: 5,
        reason: 'Add your first team member to begin configuring earnings.',
      };
    case 'configuring':
      return {
        href: `${base}/participants`,
        label: 'Configure earnings',
        estimatedMinutes: 5,
        reason: 'Configure how each team member earns before collecting approvals.',
      };
    case 'collecting-approvals':
      return {
        href: `${base}/participants?focus=approvals`,
        label: 'Open Approval Centre',
        estimatedMinutes: 3,
        reason: 'Share agreements with team members so they can approve before payouts are released.',
      };
    case 'preparing-payments':
      return {
        href: `${base}/participants?focus=onboarding`,
        label: 'Complete payment setup',
        estimatedMinutes: 5,
        reason: 'Collect bank details, ABN, and GST status from suppliers before settlement can proceed.',
      };
    case 'ready-to-collect':
    case 'collecting-revenue':
      return {
        href: `${base}/payouts`,
        label: 'Review settlement',
        estimatedMinutes: 3,
        reason: 'Review payment obligations before releasing payouts.',
      };
    case 'ready-to-release':
      return {
        href: `${base}/payouts`,
        label: 'Release payouts',
        estimatedMinutes: 2,
        reason: 'Revenue is ready — release payouts to settle team obligations.',
      };
    case 'operational':
      return {
        href: `${base}/activity`,
        label: 'View business story',
        estimatedMinutes: 0,
        reason: 'Your agreement is commercially operational.',
      };
  }
}

/* ─── resolveNextAction ─── */

/**
 * Given the full workflow input, derive the next action with full metadata.
 * Used by WorkflowHeader, ProvvyCopilot, and any component displaying "next step."
 */
export function resolveNextAction(data: WorkflowInputData): NavigationDestination & {
  headline: string;
  consequences: string[];
} {
  const ctx = deriveWorkflowContext(data);
  const destination = resolveWorkflowDestination(ctx.currentStage, data.projectId);

  const consequences = STAGE_CONSEQUENCES[ctx.currentStage] ?? [];

  return {
    ...destination,
    href: destination.href,
    label: ctx.continueLabel,
    headline: ctx.nextAction,
    consequences,
  };
}

/* ─── resolveDashboardDestination ─── */

export type DashboardDestinationType =
  | 'funding-sources'      // Payment provider section in merchant settings
  | 'payment-setup'        // Full merchant settings page
  | 'workspace-dashboard'  // The Today dashboard — home
  | 'release-review'       // Payouts hub for releasing funds
  | 'agreement-overview';  // A specific agreement's overview page

/**
 * Resolves specific dashboard CTA destinations by intent name.
 * Use this for any dashboard link that isn't part of a workflow stage.
 *
 * Prevents components from hardcoding paths.
 */
export function resolveDashboardDestination(
  type: DashboardDestinationType,
  opts: { projectId?: string } = {}
): NavigationDestination {
  switch (type) {
    case 'funding-sources':
    case 'payment-setup':
      return {
        href: MERCHANT_STRIPE_HREF,
        label: 'Configure payment provider',
        estimatedMinutes: 2,
        reason: 'Connect a payment provider to enable customer payments.',
        anchor: '#payment-provider',
      };
    case 'workspace-dashboard':
      return {
        href: DASHBOARD_HREF,
        label: 'Go to workspace',
        estimatedMinutes: 0,
        reason: "Return to today's workspace overview.",
      };
    case 'release-review':
      return {
        href: opts.projectId
          ? `${agreementBase(opts.projectId)}/payouts`
          : '/dashboard/payouts',
        label: 'Review release',
        estimatedMinutes: 2,
        reason: 'Revenue is ready to be released to team members.',
      };
    case 'agreement-overview':
      if (!opts.projectId) {
        return {
          href: DASHBOARD_HREF,
          label: 'Go to workspace',
          estimatedMinutes: 0,
          reason: 'Return to workspace overview.',
        };
      }
      return {
        href: agreementBase(opts.projectId),
        label: 'View agreement',
        estimatedMinutes: 0,
        reason: 'Open the agreement workspace.',
      };
  }
}

/* ─── resolveAgreementDestination ─── */

/**
 * Within an agreement workspace, resolve what page serves a given intent.
 * Used by WorkflowHeader and agreement page CTAs.
 */
export function resolveAgreementDestination(
  intent:
    | 'configure-earnings'
    | 'request-approvals'
    | 'connect-provider'
    | 'review-obligations'
    | 'release-payouts'
    | 'view-history',
  projectId: string
): NavigationDestination {
  const base = agreementBase(projectId);

  switch (intent) {
    case 'configure-earnings':
      return {
        href: `${base}/participants`,
        label: 'Configure earnings',
        estimatedMinutes: 5,
        reason: 'Configure how each team member earns from this agreement.',
      };
    case 'request-approvals':
      return {
        href: `${base}/participants?focus=approvals`,
        label: 'Open Approval Centre',
        estimatedMinutes: 3,
        reason: 'Share agreements with team members so they can approve before payouts are released.',
      };
    case 'connect-provider':
      return {
        href: MERCHANT_STRIPE_HREF,
        label: 'Connect payment provider',
        estimatedMinutes: 2,
        reason: 'Connecting a payment provider enables customer payments and settlement.',
        anchor: '#payment-provider',
      };
    case 'review-obligations':
      return {
        href: `${base}/payouts`,
        label: 'Review obligations',
        estimatedMinutes: 5,
        reason: 'Review what is owed before releasing payouts.',
      };
    case 'release-payouts':
      return {
        href: `${base}/payouts`,
        label: 'Release payouts',
        estimatedMinutes: 2,
        reason: 'Release revenue to settle team obligations.',
      };
    case 'view-history':
      return {
        href: `${base}/activity`,
        label: 'View business story',
        estimatedMinutes: 0,
        reason: `Review the full business history ${PRODUCT_TERMINOLOGY.forThisProject}.`,
      };
  }
}

/* ─── Consequence catalogue ─── */

/**
 * What completing each stage unlocks — used by consequence-first CTAs.
 * "Connect Stripe → Unlocks: Customer payments · Revenue tracking · Settlement readiness"
 */
const STAGE_CONSEQUENCES: Partial<Record<WorkflowStage, string[]>> = {
  'setup':                ['Earnings configuration', 'Approval collection', 'Settlement readiness'],
  'configuring':          ['Approval collection', 'Payout calculations', 'Settlement eligibility'],
  'collecting-approvals': ['Participant payouts', 'Revenue releases', 'Settlement readiness'],
  'preparing-payments':   ['Customer payments', 'Revenue tracking', 'Settlement automation'],
  'ready-to-collect':     ['Revenue collection', 'Obligation tracking', 'Payout scheduling'],
  'collecting-revenue':   ['Obligation confirmation', 'Payout readiness', 'Settlement release'],
  'ready-to-release':     ['Team member payments', 'Obligation settlement', 'Payout completion'],
};

/**
 * Returns consequences for a given workflow stage.
 * Used by consequence-first CTA displays (WorkflowHeader, ProjectPageCopilot).
 */
export function getStageConsequences(stage: WorkflowStage): string[] {
  return STAGE_CONSEQUENCES[stage] ?? [];
}

/**
 * Resolves where "Go to Dashboard" should always navigate.
 * This is the ONLY place that defines the post-onboarding destination.
 * Always the workspace Today view — never a specific agreement page.
 */
export function resolvePostOnboardingDestination(): string {
  return DASHBOARD_HREF;
}

/**
 * Resolves where "Continue Workflow" should navigate for a given project.
 * Uses the workflow stage to determine the exact destination.
 * Never falls back to a generic agreement overview page.
 */
export function resolveContinueWorkflowHref(
  projectId: string,
  stage: WorkflowStage
): string {
  return resolveWorkflowDestination(stage, projectId).href;
}
