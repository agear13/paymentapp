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
import { MERCHANT_STRIPE_HREF } from '@/lib/navigation/operator-nav';
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
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';
import {
  deriveCommercialForecast,
  buildForecastProvvyNarrative,
  formatForecastAmount,
} from '@/lib/commercial/commercial-forecast';

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
  /**
   * A payment provider account (Stripe/Wise/Hedera) has been connected.
   *
   * This answers: "Did the operator link an account?"
   * It does NOT answer: "Can the business accept customer payments right now?"
   *
   * Example: Stripe account ID exists in merchant_settings, but the operator has
   * not completed Stripe's own onboarding form. paymentProviderConnected = true,
   * but the account is not yet charges-enabled.
   *
   * See: revenueCollectionEnabled for the charges-capability check.
   */
  paymentProviderConnected: boolean;
  /**
   * The business can genuinely accept customer payments right now.
   *
   * Architecturally distinct from paymentProviderConnected:
   *   paymentProviderConnected = account linked
   *   revenueCollectionEnabled = account operational (charges_enabled, payouts_enabled)
   *
   * Current status: CONSERVATIVE APPROXIMATION ONLY.
   *
   * The Stripe account's charges_enabled / payouts_enabled flags are not yet
   * persisted in the data model. This field currently mirrors paymentProviderConnected
   * and will remain incorrect for accounts that are connected but not yet charges-enabled
   * (e.g. Stripe onboarding incomplete, restricted accounts, under review).
   *
   * TODO: Persist Stripe account health from the account.updated webhook into
   * merchant_settings.charges_enabled. Once that field exists, populate this from:
   *   workspaceContext.chargesEnabled ?? activation.chargesEnabled
   * rather than the provider connection flag.
   *
   * Do not use this capability in contexts where the distinction matters until
   * the backend data exists.
   */
  revenueCollectionEnabled: boolean;
  /** Customer revenue has been received (collectedRevenue > 0 from confirmed treasury) */
  revenueFlowing: boolean;
  /** Funds are currently ready to release to participants (readyToRelease > 0) */
  settlementReady: boolean;
  /** At least one payout batch has been released to participants (payout_batches row exists) */
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
  /**
   * Backend Stripe account health signal.
   *
   * TODO: Populate this from merchant_settings.charges_enabled once the field
   * is persisted via the Stripe account.updated webhook. When present, this is
   * the authoritative source for revenueCollectionEnabled.
   *
   * Until populated, revenueCollectionEnabled conservatively approximates
   * from paymentProviderConnected (see CommercialCapabilities.revenueCollectionEnabled).
   */
  chargesEnabled?: boolean;
  /**
   * Treasury aggregate from the funding page.
   * When provided, Provvy can answer commercial forecast questions
   * (e.g. "Can we afford to pay everyone?") with specific figures.
   */
  treasury?: ProjectTreasurySummary | null;
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

/**
 * Maps audit event types to commercial-language memory phrases.
 *
 * These phrases are used by Provvy to recall what happened most recently,
 * producing contextual sentences like:
 *   "Yesterday we finished receiving a participant approval."
 *
 * The actor name from the audit entry is woven in where available
 * (see deriveMemory below).
 */
const MEMORY_SENTENCES: Partial<Record<OperationalAuditEventType, (actor?: string) => string>> = {
  // Payment infrastructure
  stripe_connected:            () => 'connecting your payment provider',
  payment_rails_connected:     () => 'connecting your payment provider',

  // Agreement lifecycle
  conversation_imported:       () => 'setting up your agreement from a conversation',
  agreement_shared:            (actor) => actor ? `sending the agreement to ${actor} for approval` : 'sharing the agreement for approval',
  agreement_viewed:            (actor) => actor ? `${actor} opening the agreement` : 'a participant opening the agreement',
  agreement_approved:          (actor) => actor ? `${actor} approving the agreement` : 'receiving a participant approval',

  // Earnings & obligations
  compensation_updated:        (actor) => actor ? `configuring ${actor}'s earnings` : 'configuring participant earnings',
  attribution_configured:      (actor) => actor ? `configuring revenue attribution for ${actor}` : 'configuring revenue attribution',
  obligations_generated:       () => 'calculating commercial obligations',
  obligations_funded:          () => 'funding payment obligations',

  // Revenue & payouts
  funding_linked:              () => 'connecting a revenue source',
  payout_eligible:             (actor) => actor ? `confirming ${actor} is ready for payment` : 'confirming payout eligibility',
  release_batch_generated:     () => 'releasing payouts to team members',
};

function deriveMemory(
  auditEntries: OperationalAuditEntry[] | undefined,
  currentStage: WorkflowStage,
  nextAction: string
): WorkflowMemory | null {
  if (!auditEntries || auditEntries.length === 0) return null;

  // Find the most recent significant event that has a memory sentence
  const significant = [...auditEntries]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .find((e) => MEMORY_SENTENCES[e.type]);

  if (!significant) return null;

  const when = relativeTimeDescription(significant.timestamp);
  const sentenceFn = MEMORY_SENTENCES[significant.type]!;
  const what = sentenceFn(significant.actor);
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
      consequences: ['Team members receive their payments', 'Settlement obligations close', 'Project moves to operational'],
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
      consequences: ['Participant payouts become available', 'Settlement releases unlock', 'Project advances to payment-ready'],
      estimatedMinutes: 3,
      href: `${base_}/participants?focus=approvals`,
      label: 'Open Approval Centre',
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
      href: MERCHANT_STRIPE_HREF,
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
      consequences: ['Earnings configuration becomes available', 'Project preparation can begin', 'Approval workflow unlocks'],
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

/**
 * Builds Provvy's conversational overview of the current commercial state.
 *
 * When audit entries are provided, the narrative references participants by name
 * from recent timeline events — producing answers like:
 *   "Sarah approved yesterday. Ben is still waiting to approve."
 * instead of generic:
 *   "Approvals are pending."
 */
function buildConversationalSummary(
  agreementName: string | undefined,
  stage: WorkflowStage,
  recommended: PriorityItem | null,
  queue: PriorityItem[],
  estimatedMinutes: number,
  auditEntries?: OperationalAuditEntry[],
  treasury?: ProjectTreasurySummary | null
): string {
  const name = agreementName ? `${agreementName}` : 'your agreement';

  if (stage === 'operational') {
    // When treasury data is available, include forecast figures in the operational summary
    if (treasury && treasury.confirmedFunding > 0) {
      const currency = 'AUD';
      const forecastResult = deriveCommercialForecast({
        fundingSources: [],
        treasury,
        obligationRows: [],
        releaseConfidence: null,
        currency,
      });
      const canPay = forecastResult.cashReadiness.canEveryoneBePaid;
      const balanceLabel = canPay
        ? formatForecastAmount(forecastResult.forecastPosition.forecastBalance, currency)
        : `-${formatForecastAmount(Math.abs(forecastResult.forecastPosition.forecastBalance), currency)}`;
      return `${name} is commercially operational. Revenue is flowing and all obligations are confirmed. Forecast position: ${balanceLabel}. I'll alert you when something needs attention.`;
    }
    return `${name} is commercially operational. Revenue is flowing and all obligations are confirmed. I'll alert you when something needs attention.`;
  }

  if (!recommended) {
    return `${name} is progressing well. Continue reviewing to advance to the next stage.`;
  }

  const timeStr = estimatedMinutes > 0 ? ` Estimated work: ${estimatedMinutes} minutes.` : '';

  switch (recommended.tier) {
    case 'money_blocked': {
      // Augment with forecast context when treasury data is available
      const forecastNote = buildTreasuryForecastNote(treasury);
      return `I reviewed ${name}. Revenue is held back because ${recommended.explanation.toLowerCase()}${forecastNote} This is the highest-priority action.${timeStr}`;
    }

    case 'settlement_blocked': {
      const forecastNote = buildTreasuryForecastNote(treasury);
      return `I reviewed ${name}. Settlement is ready but blocked.${forecastNote} Resolving this releases team member payments.${timeStr}`;
    }

    case 'approvals_pending': {
      // Reference recently approved participants by name using the audit timeline
      const recentApproval = auditEntries
        ?.filter((e) => e.type === 'agreement_approved' && e.actor)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

      const approvalNarrative = recentApproval?.actor
        ? `${recentApproval.actor} approved ${relativeTimeDescription(recentApproval.timestamp)}.`
        : null;

      const after =
        queue.length > 1
          ? ` After approvals, I'll guide you through the next step.`
          : ' Once complete, the agreement is ready to collect payments.';

      const prefix = approvalNarrative
        ? `${approvalNarrative} I reviewed ${name}. ${recommended.title}.`
        : `I reviewed ${name}. ${recommended.title}.`;

      return `${prefix} Approvals must be collected before payouts can be released.${after}${timeStr}`;
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

/**
 * Builds a short Provvy-friendly forecast note from treasury aggregates.
 * Used to enrich money-blocked and settlement-blocked summaries.
 */
function buildTreasuryForecastNote(treasury?: ProjectTreasurySummary | null): string {
  if (!treasury || treasury.confirmedFunding + treasury.pendingFunding === 0) return '';
  const currency = 'AUD';
  const total = treasury.confirmedFunding + treasury.pendingFunding + treasury.forecastFunding;
  const committed = treasury.obligationsTotal;
  if (total === 0) return '';
  const balance = total - committed;
  if (balance > 0) {
    return ` Forecast position shows a ${formatForecastAmount(balance, currency)} surplus once revenue is received.`;
  }
  if (balance < 0) {
    return ` Forecast shows a ${formatForecastAmount(Math.abs(balance), currency)} shortfall — revenue may not cover all commitments.`;
  }
  return '';
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
  input: Pick<CommercialDecisionInput, 'kpis' | 'releaseConfidence' | 'workspaceContext' | 'activation' | 'chargesEnabled'>
): CommercialCapabilities {
  const { kpis, releaseConfidence, workspaceContext, activation, chargesEnabled } = input;

  const participantCount =
    kpis?.participantCount ?? activation?.participantCount ?? 0;
  const earningsConfiguredCount =
    kpis?.earningsConfiguredCount ?? activation?.participantsConfiguredCount ?? 0;
  const approvedCount = kpis?.approvedAgreementCount ?? 0;

  // paymentProviderConnected: a payment rail account ID is stored in merchant_settings.
  // This does NOT mean the account is operationally healthy (charges_enabled, payouts_enabled).
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
  // revenueFlowing: only true after real confirmed treasury revenue — never inferred
  const revenueFlowing = (releaseConfidence?.collectedRevenue ?? 0) > 0;
  // settlementReady: funds genuinely awaiting release (dollar or count > 0)
  const settlementReady = (releaseConfidence?.readyToRelease ?? 0) > 0;
  // payoutComplete: only true after a real payout_batches row exists in DB
  const payoutComplete = activation?.firstReleaseCompleted === true;

  // revenueCollectionEnabled: whether the business can ACTUALLY accept customer payments.
  // When chargesEnabled is provided (future: from Stripe account.updated webhook persisted
  // into merchant_settings), use it. Until then, this is a conservative approximation:
  // we assume a connected provider is also charges-enabled. This will be incorrect for
  // accounts in Stripe's onboarding flow or under review. See CommercialCapabilities JSDoc.
  const revenueCollectionEnabled =
    chargesEnabled !== undefined ? chargesEnabled : paymentProviderConnected;

  return {
    participantsInvited,
    earningsConfigured,
    approvalsComplete,
    paymentProviderConnected,
    revenueCollectionEnabled,
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
    estimatedMinutes,
    input.auditEntries,
    input.treasury
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
