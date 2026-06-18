/**
 * Commercial Decision Engine — the single source of truth for operator guidance.
 *
 * Deterministic. No AI APIs. No duplicate business logic.
 * Every page that needs guidance consumes this engine.
 *
 * Priority order (highest first):
 *   1. Money blocked — revenue exists but cannot flow
 *   2. Settlement blocked — payouts ready but stuck
 *   3. Participant approvals pending
 *   4. Payment provider not connected
 *   5. Earnings not configured
 *   6. Participants not added
 *   7. Setup / initial configuration
 */

import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import type {
  OperationalGuidanceBundle,
  ReleaseConfidenceSnapshot,
} from '@/lib/operations/explainability/types';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import type { WorkspaceActivationSnapshot } from '@/lib/onboarding/workspace-activation-types';
import type { OperationalAuditEntry, OperationalAuditEventType } from '@/lib/operations/audit/operational-audit';
import type { AttentionItem } from '@/lib/operations/severity';
import {
  deriveWorkflowContext,
  type WorkflowStage,
} from '@/components/workflow/workflow-context';

/* ─── Types ─── */

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type PriorityTier =
  | 'money_blocked'
  | 'settlement_blocked'
  | 'approvals_pending'
  | 'payment_provider'
  | 'earnings_config'
  | 'participants_missing'
  | 'setup'
  | 'optimisation';

export type PriorityItem = {
  tier: PriorityTier;
  title: string;
  explanation: string;
  /** What completing this unlocks */
  consequences: string[];
  estimatedMinutes: number;
  href: string;
  label: string;
};

export type WorkflowMemory = {
  /** e.g. "Yesterday we finished connecting your payment provider." */
  lastActionSentence: string;
  /** e.g. "Today I'd like to collect participant approvals." */
  todayIntentSentence: string;
  /** ISO timestamp of last significant audit event */
  lastActivityAt: string | null;
};

/**
 * The single authority on what a business has accomplished.
 *
 * Every UI that shows a completion state (checklist, progress bar, readiness
 * widget, onboarding screen, dashboard) MUST read from this object.
 * No component may infer completion independently.
 *
 * Rules:
 *  - A capability is true ONLY when the underlying persisted state confirms it.
 *  - No optimistic values based on wizard steps visited or forms advanced.
 *  - This is derived deterministically from the same inputs the rest of the engine uses.
 */
export type CommercialCapabilities = {
  /** At least one participant has been invited to the agreement */
  participantsInvited: boolean;
  /** ALL participants have had their earnings (compensation) configured */
  earningsConfigured: boolean;
  /** ALL participants have approved the agreement */
  approvalsComplete: boolean;
  /** A payment provider (Stripe/Wise/Hedera) is connected */
  paymentProviderConnected: boolean;
  /** Revenue collection is enabled — requires payment provider */
  revenueCollectionEnabled: boolean;
  /** Customer revenue has been received (collectedRevenue > 0) */
  revenueFlowing: boolean;
  /** Funds are currently ready to release to participants */
  settlementReady: boolean;
  /** At least one payout batch has been released to participants */
  payoutComplete: boolean;
};

export type CommercialDecisionResult = {
  /**
   * The complete set of commercial capabilities — the single source of truth
   * for every completion indicator in the product.
   * Dashboard, onboarding, agreement pages and settlement pages all read from here.
   */
  commercialCapabilities: CommercialCapabilities;
  /** Ordered priority queue — highest value first */
  priorityQueue: PriorityItem[];
  /** The single highest-value action to take right now */
  recommendedAction: PriorityItem | null;
  /** Overall guidance confidence */
  confidence: ConfidenceLevel;
  /** One-sentence confidence explanation */
  confidenceReason: string;
  /** Deterministic bullet-point reasoning behind the recommendation */
  reasoning: string[];
  /** What completing the recommended action unlocks */
  consequences: string[];
  /** Current workflow stage */
  workflowStage: WorkflowStage;
  /** Label for the next stage */
  nextStep: string;
  /** Estimated time for recommended action */
  estimatedMinutes: number;
  /** Where Continue should navigate */
  continueHref: string;
  /** Continue button label */
  continueLabel: string;
  /**
   * First-person Provvy narrative.
   * e.g. "I reviewed your agreement. The only thing preventing customer payments is connecting Stripe."
   */
  conversationalSummary: string;
  /** Memory derived from audit history — null when no real audit events exist */
  memory: WorkflowMemory | null;
};

export type CommercialDecisionInput = {
  projectId: string;
  agreementName?: string;
  kpis: OperationalKPIs | null;
  releaseConfidence: ReleaseConfidenceSnapshot | null;
  workspaceContext: WorkspaceOperationalContext | null;
  activation: WorkspaceActivationSnapshot | null;
  attentionItems?: AttentionItem[];
  auditEntries?: OperationalAuditEntry[];
  guidance?: OperationalGuidanceBundle | null;
};

/* ─── Helpers ─── */

const base = (projectId: string) =>
  `/dashboard/projects/${encodeURIComponent(projectId)}`;

const DAYS_MS = 86_400_000;

function relativeTimeDescription(iso: string | null | undefined): string {
  if (!iso) return 'recently';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.round(diff / 60_000)} minutes ago`;
  if (diff < DAYS_MS) return 'earlier today';
  if (diff < 2 * DAYS_MS) return 'yesterday';
  if (diff < 7 * DAYS_MS) return `${Math.floor(diff / DAYS_MS)} days ago`;
  return 'last week';
}

/* ─── Audit-based memory ─── */

const MEMORY_SENTENCES: Partial<Record<OperationalAuditEventType, string>> = {
  stripe_connected:            'connecting your payment provider',
  payment_rails_connected:     'connecting your payment provider',
  compensation_updated:        'configuring participant earnings',
  attribution_configured:      'configuring revenue attribution',
  obligations_generated:       'generating payment obligations',
  obligations_funded:          'funding payment obligations',
  agreement_approved:          'receiving a participant approval',
  agreement_shared:            'sharing the agreement for approval',
  funding_linked:              'connecting a revenue source',
  release_batch_generated:     'releasing payouts to team members',
  payout_eligible:             'confirming payout eligibility',
  conversation_imported:       'setting up your agreement from a conversation',
};

function deriveMemory(
  auditEntries: OperationalAuditEntry[] | undefined,
  currentStage: WorkflowStage,
  nextAction: string
): WorkflowMemory | null {
  if (!auditEntries || auditEntries.length === 0) return null;

  // Find the most recent significant event
  const significant = [...auditEntries]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .find((e) => MEMORY_SENTENCES[e.type]);

  if (!significant) return null;

  const when = relativeTimeDescription(significant.timestamp);
  const what = MEMORY_SENTENCES[significant.type]!;
  const whenCapitalized = when.charAt(0).toUpperCase() + when.slice(1);

  const lastActionSentence =
    when === 'just now'
      ? `We just finished ${what}.`
      : `${whenCapitalized} we finished ${what}.`;

  const todayIntentSentence =
    currentStage === 'operational'
      ? "Everything is running. I'll let you know when something needs attention."
      : `Now let's ${nextAction.toLowerCase()}.`;

  return {
    lastActionSentence,
    todayIntentSentence,
    lastActivityAt: significant.timestamp,
  };
}

/* ─── Priority queue derivation ─── */

function buildPriorityQueue(
  input: CommercialDecisionInput,
  base_: string
): PriorityItem[] {
  const queue: PriorityItem[] = [];

  const {
    kpis,
    releaseConfidence,
    workspaceContext,
    activation,
    attentionItems = [],
  } = input;

  const participantCount = kpis?.participantCount ?? 0;
  const earningsConfigured = kpis?.earningsConfiguredCount ?? 0;
  const approvedCount = kpis?.approvedAgreementCount ?? 0;
  const readyToRelease = releaseConfidence?.readyToRelease ?? 0;
  const collectedRevenue = releaseConfidence?.collectedRevenue ?? 0;
  const providerConnected =
    workspaceContext?.stripeConfigured === true ||
    activation?.providerConnected === true;

  // ── Tier 1: Money is blocked (revenue in, not moving)
  if (collectedRevenue > 0 && !providerConnected) {
    queue.push({
      tier: 'money_blocked',
      title: 'Unlock customer payments',
      explanation: 'Revenue is being collected but cannot flow without a payment provider.',
      consequences: ['Customer payments begin flowing', 'Revenue tracking activates', 'Settlement becomes available'],
      estimatedMinutes: 2,
      href: `${base_}/funding`,
      label: 'Connect payment provider',
    });
  }

  // ── Tier 2: Settlement is blocked (ready to release but held)
  if (readyToRelease > 0 && (releaseConfidence?.heldBackReasons?.length ?? 0) > 0) {
    const reasons = releaseConfidence?.heldBackReasons ?? [];
    queue.push({
      tier: 'settlement_blocked',
      title: 'Release is blocked',
      explanation: reasons[0] ?? 'Settlement cannot proceed until blockers are resolved.',
      consequences: ['Team members receive their payments', 'Settlement obligations close', 'Agreement moves to operational'],
      estimatedMinutes: 5,
      href: `${base_}/payouts`,
      label: 'Review blockers',
    });
  }

  // ── Tier 3: Approvals pending
  const pendingApprovals = participantCount - approvedCount;
  if (pendingApprovals > 0 && earningsConfigured >= participantCount && participantCount > 0) {
    queue.push({
      tier: 'approvals_pending',
      title: pendingApprovals === 1
        ? 'One team member needs to approve'
        : `${pendingApprovals} team members need to approve`,
      explanation: 'All earnings are configured. Approvals must be collected before payouts can be released.',
      consequences: ['Participant payouts become available', 'Settlement releases unlock', 'Agreement advances to payment-ready'],
      estimatedMinutes: 3,
      href: `${base_}/participants`,
      label: 'Request approvals',
    });
  }

  // ── Tier 4: Payment provider not connected
  if (!providerConnected && pendingApprovals === 0 && participantCount > 0) {
    queue.push({
      tier: 'payment_provider',
      title: 'Connect your payment provider',
      explanation: 'All approvals are collected. Connecting a payment provider enables customer payments.',
      consequences: ['Customer payments begin', 'Revenue tracking activates', 'Settlement readiness unlocks'],
      estimatedMinutes: 2,
      href: `${base_}/funding`,
      label: 'Connect provider',
    });
  }

  // ── Tier 5: Earnings not configured
  const pendingEarnings = participantCount - earningsConfigured;
  if (pendingEarnings > 0 && participantCount > 0) {
    queue.push({
      tier: 'earnings_config',
      title: pendingEarnings === 1
        ? 'Configure earnings for 1 team member'
        : `Configure earnings for ${pendingEarnings} team members`,
      explanation: 'Earnings define how revenue is distributed. Approvals cannot be sent until earnings are configured.',
      consequences: ['Approval collection can begin', 'Settlement obligations are generated', 'Payout automation activates'],
      estimatedMinutes: Math.max(3, pendingEarnings * 4),
      href: `${base_}/participants`,
      label: 'Configure earnings',
    });
  }

  // ── Tier 6: No participants added
  if (participantCount === 0) {
    queue.push({
      tier: 'participants_missing',
      title: 'Add your first team member',
      explanation: 'This agreement has no team members yet. Adding people is the first step toward operational readiness.',
      consequences: ['Earnings configuration becomes available', 'Agreement preparation can begin', 'Approval workflow unlocks'],
      estimatedMinutes: 5,
      href: `${base_}/participants`,
      label: 'Add team member',
    });
  }

  // ── Supplement with attention items for extra context
  for (const item of attentionItems) {
    if (item.severity === 'CRITICAL' && !queue.find((q) => q.href === item.ctaHref)) {
      queue.push({
        tier: 'money_blocked',
        title: item.title,
        explanation: item.explanation ?? item.title,
        consequences: [],
        estimatedMinutes: 3,
        href: item.ctaHref ?? base_,
        label: 'Fix now',
      });
    }
  }

  return queue;
}

/* ─── Confidence derivation ─── */

function deriveConfidence(
  queue: PriorityItem[],
  stage: WorkflowStage
): { level: ConfidenceLevel; reason: string } {
  if (stage === 'operational') {
    return { level: 'HIGH', reason: 'The commercial relationship is fully operational.' };
  }
  if (queue.length === 0) {
    return { level: 'HIGH', reason: 'No blockers detected. Everything is on track.' };
  }
  if (queue.length === 1) {
    return { level: 'HIGH', reason: 'Only one action remains before the next milestone.' };
  }
  if (queue.length === 2) {
    return { level: 'MEDIUM', reason: 'Two actions remain. Complete them in order.' };
  }
  return { level: 'LOW', reason: `${queue.length} actions are required before commercial readiness.` };
}

/* ─── Conversational summary ─── */

function buildConversationalSummary(
  agreementName: string | undefined,
  stage: WorkflowStage,
  recommended: PriorityItem | null,
  queue: PriorityItem[],
  estimatedMinutes: number
): string {
  const name = agreementName ? `${agreementName}` : 'your agreement';

  if (stage === 'operational') {
    return `${name} is commercially operational. Revenue is flowing and all obligations are confirmed. I'll alert you when something needs attention.`;
  }

  if (!recommended) {
    return `${name} is progressing well. Continue reviewing to advance to the next stage.`;
  }

  const timeStr = estimatedMinutes > 0 ? ` Estimated work: ${estimatedMinutes} minutes.` : '';

  switch (recommended.tier) {
    case 'money_blocked':
      return `I reviewed ${name}. Revenue is held back because ${recommended.explanation.toLowerCase()} This is the highest-priority action.${timeStr}`;

    case 'settlement_blocked':
      return `I reviewed ${name}. Settlement is ready but blocked. Resolving this releases team member payments.${timeStr}`;

    case 'approvals_pending': {
      const after =
        queue.length > 1
          ? ` After approvals, I'll guide you through the next step.`
          : ' Once complete, the agreement is ready to collect payments.';
      return `I reviewed ${name}. ${recommended.title}. Approvals must be collected before payouts can be released.${after}${timeStr}`;
    }

    case 'payment_provider':
      return `I reviewed ${name}. The only thing preventing customer payments is connecting a payment provider. Once that's done, revenue can begin flowing.${timeStr}`;

    case 'earnings_config': {
      const nextAfter =
        queue.length > 1
          ? ` After that, I'll guide you through collecting approvals.`
          : '';
      return `I reviewed ${name}. ${recommended.title} to complete preparation.${nextAfter}${timeStr}`;
    }

    case 'participants_missing':
      return `I reviewed ${name}. No team members have been added yet. Let's start by adding participants — they're required before approvals or payouts can happen.${timeStr}`;

    default:
      return `I reviewed ${name}. ${recommended.explanation}${timeStr}`;
  }
}

/* ─── Reasoning bullets ─── */

function buildReasoning(
  input: CommercialDecisionInput,
  stage: WorkflowStage,
  recommended: PriorityItem | null
): string[] {
  const {
    kpis,
    releaseConfidence,
    workspaceContext,
    activation,
  } = input;

  const reasons: string[] = [];

  const participantCount = kpis?.participantCount ?? 0;
  const earningsConfigured = kpis?.earningsConfiguredCount ?? 0;
  const approvedCount = kpis?.approvedAgreementCount ?? 0;
  const providerConnected =
    workspaceContext?.stripeConfigured === true || activation?.providerConnected === true;

  if (participantCount > 0) {
    reasons.push(`${participantCount} team member${participantCount === 1 ? ' has' : 's have'} been added`);
  }
  if (earningsConfigured > 0 && earningsConfigured < participantCount) {
    reasons.push(`${earningsConfigured} of ${participantCount} team members have earnings configured`);
  } else if (earningsConfigured >= participantCount && participantCount > 0) {
    reasons.push('all team member earnings are configured');
  }
  if (approvedCount > 0) {
    reasons.push(`${approvedCount} of ${participantCount} team members have approved`);
  }
  if (providerConnected) {
    reasons.push('a payment provider is connected');
  } else {
    reasons.push('no payment provider is connected');
  }
  if ((releaseConfidence?.collectedRevenue ?? 0) > 0) {
    reasons.push('revenue has been collected');
  }
  if ((releaseConfidence?.readyToRelease ?? 0) > 0) {
    reasons.push('funds are ready to release to team members');
  }

  if (recommended) {
    reasons.push(`completing this unlocks: ${recommended.consequences.slice(0, 2).join(' and ').toLowerCase()}`);
  }

  return reasons;
}

/* ─── Public API ─── */

/**
 * Derive the set of commercial capabilities from raw operational inputs.
 *
 * This is the ONLY place where capability completion is computed.
 * Call it once (via analyseWorkspace) and distribute the result to every UI.
 *
 * Invariants:
 *  - A capability is true ONLY when persisted server state confirms it.
 *  - No capability is set true by a wizard advancing, a default value, or an optimistic update.
 *  - earningsConfigured is true ONLY when ALL participants have earnings set.
 *  - approvalsComplete is true ONLY when ALL participants have approved.
 *  - revenueFlowing is true ONLY when collectedRevenue > 0 (real money received).
 */
export function deriveCommercialCapabilities(
  input: Pick<CommercialDecisionInput, 'kpis' | 'releaseConfidence' | 'workspaceContext' | 'activation'>
): CommercialCapabilities {
  const { kpis, releaseConfidence, workspaceContext, activation } = input;

  const participantCount =
    kpis?.participantCount ?? activation?.participantCount ?? 0;
  const earningsConfiguredCount =
    kpis?.earningsConfiguredCount ?? activation?.participantsConfiguredCount ?? 0;
  const approvedCount = kpis?.approvedAgreementCount ?? 0;

  const paymentProviderConnected =
    workspaceContext?.stripeConfigured === true ||
    activation?.providerConnected === true;

  const participantsInvited = participantCount > 0;
  // earningsConfigured: ALL participants must have their earnings set — no partial credit
  const earningsConfigured =
    participantsInvited && earningsConfiguredCount >= participantCount;
  // approvalsComplete: ALL participants must have approved — no partial credit
  const approvalsComplete =
    participantsInvited && approvedCount >= participantCount;
  // revenueFlowing: only true after real revenue received — never true by default
  const revenueFlowing = (releaseConfidence?.collectedRevenue ?? 0) > 0;
  // settlementReady: only true when funds are genuinely awaiting release
  const settlementReady = (releaseConfidence?.readyToRelease ?? 0) > 0;
  // payoutComplete: only true after the first real release batch runs
  const payoutComplete = activation?.firstReleaseCompleted === true;

  return {
    participantsInvited,
    earningsConfigured,
    approvalsComplete,
    paymentProviderConnected,
    revenueCollectionEnabled: paymentProviderConnected,
    revenueFlowing,
    settlementReady,
    payoutComplete,
  };
}

/**
 * Analyse the current workspace state and return a complete commercial guidance package.
 *
 * Call this once per page render — feed it KPIs, release confidence, workspace context,
 * activation snapshot, optional attention items and audit history.
 * Every guidance surface consumes this single result.
 */
export function analyseWorkspace(input: CommercialDecisionInput): CommercialDecisionResult {
  const projectBase = base(input.projectId);

  // Derive workflow stage from existing engine
  const workflowCtx = deriveWorkflowContext({
    projectId: input.projectId,
    agreementName: input.agreementName,
    kpis: input.kpis,
    releaseConfidence: input.releaseConfidence,
    workspaceContext: input.workspaceContext,
    activation: input.activation,
  });

  const priorityQueue = buildPriorityQueue(input, projectBase);
  const recommended = priorityQueue[0] ?? null;

  const { level: confidence, reason: confidenceReason } = deriveConfidence(
    priorityQueue,
    workflowCtx.currentStage
  );

  const reasoning = buildReasoning(input, workflowCtx.currentStage, recommended);
  const consequences = recommended?.consequences ?? [];

  const estimatedMinutes = recommended?.estimatedMinutes ?? workflowCtx.nextActionMinutes;
  const continueHref = recommended?.href ?? workflowCtx.continueHref;
  const continueLabel = recommended?.label ?? workflowCtx.continueLabel;

  const conversationalSummary = buildConversationalSummary(
    input.agreementName,
    workflowCtx.currentStage,
    recommended,
    priorityQueue,
    estimatedMinutes
  );

  const memory = deriveMemory(
    input.auditEntries,
    workflowCtx.currentStage,
    workflowCtx.nextAction
  );

  const commercialCapabilities = deriveCommercialCapabilities(input);

  return {
    commercialCapabilities,
    priorityQueue,
    recommendedAction: recommended,
    confidence,
    confidenceReason,
    reasoning,
    consequences,
    workflowStage: workflowCtx.currentStage,
    nextStep: workflowCtx.stageTitle,
    estimatedMinutes,
    continueHref,
    continueLabel,
    conversationalSummary,
    memory,
  };
}
