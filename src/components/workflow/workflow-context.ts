/**
 * Workflow Context — pure computation, no React.
 *
 * Derives the current commercial workflow stage from existing operational data.
 * Never duplicates state — consumes the same types already used across the app.
 *
 * The result is the single source of truth for:
 *   - Where the operator currently is in the commercial journey
 *   - What they should do next
 *   - Where the Continue button should navigate
 */

import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability/types';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import type { WorkspaceActivationSnapshot } from '@/lib/onboarding/workspace-activation-types';

/* ─── Stage enum ─── */

export type WorkflowStage =
  | 'setup'                 // Agreement created, no team members yet
  | 'configuring'           // Team members added, earnings not configured
  | 'collecting-approvals'  // Earnings configured, awaiting team approvals
  | 'preparing-payments'    // All approved, payment provider not yet connected
  | 'ready-to-collect'      // Provider connected, ready to accept revenue
  | 'collecting-revenue'    // Revenue flowing in
  | 'ready-to-release'      // Revenue ready to distribute
  | 'operational';          // Fully operational — first payout released

/* ─── WorkflowContext output ─── */

export type WorkflowContext = {
  /** Current commercial journey stage */
  currentStage: WorkflowStage;
  /** Human-readable stage title */
  stageTitle: string;
  /** Next stage identifier (null when operational) */
  nextStage: WorkflowStage | null;
  /** What the operator should do now */
  nextAction: string;
  /** One-sentence explanation of why */
  nextActionHint: string;
  /** Estimated minutes to complete */
  nextActionMinutes: number;
  /** 0–100 journey completion */
  completionPercentage: number;
  /** The href Continue should navigate to — never hardcoded */
  continueHref: string;
  /** Label for the Continue button */
  continueLabel: string;
  /** True when stage is operational */
  isCompleted: boolean;
  /** Project ID of the primary agreement */
  primaryAgreementId: string | null;
  /** Name of the primary agreement */
  primaryAgreementName: string | null;
};

/* ─── Input ─── */

export type WorkflowInputData = {
  projectId: string;
  agreementName?: string;
  kpis: OperationalKPIs | null;
  releaseConfidence: ReleaseConfidenceSnapshot | null;
  workspaceContext: WorkspaceOperationalContext | null;
  activation: WorkspaceActivationSnapshot | null;
};

/* ─── Stage derivation ─── */

function deriveStage(data: WorkflowInputData): WorkflowStage {
  const { kpis, releaseConfidence, workspaceContext, activation } = data;

  const participantCount = kpis?.participantCount ?? 0;
  const earningsConfigured = kpis?.earningsConfiguredCount ?? 0;
  const approvedCount = kpis?.approvedAgreementCount ?? 0;
  const collectedRevenue = releaseConfidence?.collectedRevenue ?? 0;
  const readyToRelease = releaseConfidence?.readyToRelease ?? 0;

  const providerConnected =
    workspaceContext?.stripeConfigured === true ||
    activation?.providerConnected === true;

  // Walk down the journey in reverse (most advanced stage wins)
  if (activation?.firstReleaseCompleted) return 'operational';
  if (readyToRelease > 0) return 'ready-to-release';
  if (collectedRevenue > 0 && providerConnected) return 'collecting-revenue';
  if (providerConnected) return 'ready-to-collect';

  const allApproved =
    participantCount > 0 && approvedCount >= participantCount;
  if (allApproved) return 'preparing-payments';

  const allEarningsConfigured =
    participantCount > 0 && earningsConfigured >= participantCount;
  if (allEarningsConfigured) return 'collecting-approvals';

  if (participantCount > 0) return 'configuring';

  return 'setup';
}

/* ─── Stage metadata ─── */

const STAGE_TITLES: Record<WorkflowStage, string> = {
  'setup':                'Preparing agreement',
  'configuring':          'Configuring earnings',
  'collecting-approvals': 'Collecting approvals',
  'preparing-payments':   'Preparing payments',
  'ready-to-collect':     'Ready for payments',
  'collecting-revenue':   'Collecting revenue',
  'ready-to-release':     'Ready for settlement',
  'operational':          'Commercially operational',
};

const STAGE_ORDER: WorkflowStage[] = [
  'setup',
  'configuring',
  'collecting-approvals',
  'preparing-payments',
  'ready-to-collect',
  'collecting-revenue',
  'ready-to-release',
  'operational',
];

/**
 * Canonical progress percentage for each workflow stage.
 * This is the single formula used everywhere — never recompute it independently.
 */
export const STAGE_COMPLETION: Record<WorkflowStage, number> = {
  'setup':                5,
  'configuring':          20,
  'collecting-approvals': 40,
  'preparing-payments':   58,
  'ready-to-collect':     72,
  'collecting-revenue':   85,
  'ready-to-release':     95,
  'operational':          100,
};

/**
 * Map a health/readiness score back to the nearest canonical workflow stage.
 * Use this instead of independent score-threshold logic in UI components.
 * All components that need a stage from a score MUST use this function.
 */
export function stageFromScore(score: number): WorkflowStage {
  if (score >= STAGE_COMPLETION['operational'])      return 'operational';
  if (score >= STAGE_COMPLETION['ready-to-release']) return 'ready-to-release';
  if (score >= STAGE_COMPLETION['collecting-revenue']) return 'collecting-revenue';
  if (score >= STAGE_COMPLETION['ready-to-collect']) return 'ready-to-collect';
  if (score >= STAGE_COMPLETION['preparing-payments']) return 'preparing-payments';
  if (score >= STAGE_COMPLETION['collecting-approvals']) return 'collecting-approvals';
  if (score >= STAGE_COMPLETION['configuring'])      return 'configuring';
  return 'setup';
}

function nextStage(stage: WorkflowStage): WorkflowStage | null {
  const idx = STAGE_ORDER.indexOf(stage);
  return idx >= 0 && idx < STAGE_ORDER.length - 1
    ? STAGE_ORDER[idx + 1]!
    : null;
}

/* ─── Derive next action ─── */

function deriveNextAction(
  stage: WorkflowStage,
  data: WorkflowInputData
): { action: string; hint: string; minutes: number; label: string } {
  const pendingApprovals =
    (data.kpis?.participantCount ?? 0) - (data.kpis?.approvedAgreementCount ?? 0);
  const pendingEarnings =
    (data.kpis?.participantCount ?? 0) - (data.kpis?.earningsConfiguredCount ?? 0);

  switch (stage) {
    case 'setup':
      return {
        action: 'Add your first team member',
        hint: 'Adding people unlocks earnings configuration and approval collection.',
        minutes: 5,
        label: 'Add team member',
      };
    case 'configuring':
      return {
        action: pendingEarnings === 1
          ? 'Configure earnings for 1 team member'
          : `Configure earnings for ${pendingEarnings} team members`,
        hint: 'Earnings configuration defines how revenue is distributed before approvals.',
        minutes: Math.max(3, pendingEarnings * 4),
        label: 'Configure earnings',
      };
    case 'collecting-approvals':
      return {
        action: pendingApprovals === 1
          ? 'Share the agreement with 1 team member'
          : `Share agreements with ${pendingApprovals} team members`,
        hint: 'All approvals must be collected before payouts can be released.',
        minutes: 3,
        label: 'Open Approval Centre',
      };
    case 'preparing-payments':
      return {
        action: 'Connect your payment provider',
        hint: 'Connecting a payment provider enables customer payments and payout automation.',
        minutes: 2,
        label: 'Connect provider',
      };
    case 'ready-to-collect':
      return {
        action: 'Review funding and begin collecting',
        hint: 'Your agreement is fully prepared. Revenue can now flow.',
        minutes: 1,
        label: 'Review',
      };
    case 'collecting-revenue':
      return {
        action: 'Review payment obligations',
        hint: 'Confirm obligations are correctly recorded before releasing payouts.',
        minutes: 5,
        label: 'Review obligations',
      };
    case 'ready-to-release':
      return {
        action: 'Release payouts to team members',
        hint: 'Revenue is ready. Releasing payouts settles obligations and pays team members.',
        minutes: 2,
        label: 'Release payouts',
      };
    case 'operational':
      return {
        action: 'Agreement is commercially operational',
        hint: 'Your commercial relationship is running. Monitor activity in the business story.',
        minutes: 0,
        label: 'View activity',
      };
  }
}

/* ─── Derive continue href ─── */

function deriveContinueHref(stage: WorkflowStage, projectId: string): string {
  const base = `/dashboard/projects/${encodeURIComponent(projectId)}`;

  switch (stage) {
    case 'setup':
    case 'configuring':
      return `${base}/participants`;
    case 'collecting-approvals':
      return `${base}/participants?focus=approvals`;
    case 'preparing-payments':
      return `${base}/funding`;
    case 'ready-to-collect':
    case 'collecting-revenue':
    case 'ready-to-release':
      return `${base}/payouts`;
    case 'operational':
      return `${base}/activity`;
  }
}

/* ─── Public API ─── */

/**
 * Derives the full workflow context for a single agreement workspace.
 * Call this from WorkflowHeader — feed it KPIs, release confidence, and workspace context.
 */
export function deriveWorkflowContext(data: WorkflowInputData): WorkflowContext {
  const stage = deriveStage(data);
  const next = nextStage(stage);
  const actionMeta = deriveNextAction(stage, data);
  const continueHref = deriveContinueHref(stage, data.projectId);

  return {
    currentStage: stage,
    stageTitle: STAGE_TITLES[stage],
    nextStage: next,
    nextAction: actionMeta.action,
    nextActionHint: actionMeta.hint,
    nextActionMinutes: actionMeta.minutes,
    completionPercentage: STAGE_COMPLETION[stage],
    continueHref,
    continueLabel: actionMeta.label,
    isCompleted: stage === 'operational',
    primaryAgreementId: data.projectId,
    primaryAgreementName: data.agreementName ?? null,
  };
}

/**
 * Helper for dashboard-level CTA routing.
 * Given attention items and snapshots, resolves the next workflow CTA href.
 * Used by ProvvyCopilot and ContinueWorkflowCard.
 */
export function resolveNextWorkflowStep(opts: {
  projectId: string;
  stage: WorkflowStage;
  topBlockerHint?: string;
  explicitHref?: string;
}): { href: string; label: string; minutes: number; reason: string } {
  const { projectId, stage, topBlockerHint = '', explicitHref } = opts;
  const base = `/dashboard/projects/${encodeURIComponent(projectId)}`;
  const action = deriveNextAction(stage, {
    projectId,
    kpis: null,
    releaseConfidence: null,
    workspaceContext: null,
    activation: null,
  });

  // Explicit href always wins (from attention item)
  if (explicitHref) {
    return { href: explicitHref, label: action.label, minutes: action.minutes, reason: action.hint };
  }

  // Derive from hint string when no explicit href
  if (/stripe|payment provider|merchant|payment rail/i.test(topBlockerHint)) {
    return {
      href: `${base}/funding`,
      label: 'Connect provider',
      minutes: 2,
      reason: 'Connecting a payment provider unlocks customer payments.',
    };
  }
  if (/participant|approval|invite|team member|send agreement/i.test(topBlockerHint)) {
    return {
      href: `${base}/participants`,
      label: 'Request approvals',
      minutes: 3,
      reason: 'All approvals must be collected before payouts can be released.',
    };
  }
  if (/obligation|payout|settlement|release/i.test(topBlockerHint)) {
    return {
      href: `${base}/payouts`,
      label: 'Review payouts',
      minutes: 5,
      reason: 'Review obligations to confirm settlement details.',
    };
  }

  return {
    href: deriveContinueHref(stage, projectId),
    label: action.label,
    minutes: action.minutes,
    reason: action.hint,
  };
}
