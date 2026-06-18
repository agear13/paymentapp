/**
 * Operations Manager — the highest-level orchestrator.
 *
 * The Commercial Decision Engine determines what is true.
 * The Operations Manager determines what the operator should experience.
 *
 * Consumes the Decision Engine. Adds workspace-level synthesis:
 *   - "Today's focus" items (top 3 actions across all agreements)
 *   - Mission framing for each agreement
 *   - Workspace maturity mode (auto-derived, no feature flags)
 *   - Celebration moments (recent completions)
 *   - Interruptions (critical blockers needing immediate attention)
 *
 * Every dashboard screen consumes this object.
 * No page derives its own business logic separately.
 */

import {
  analyseWorkspace,
  deriveCommercialCapabilities,
  type CommercialDecisionResult,
  type CommercialCapabilities,
  type WorkflowMemory,
  type ConfidenceLevel,
} from '@/components/workflow/commercial-decision-engine';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability/types';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import type { WorkspaceActivationSnapshot } from '@/lib/onboarding/workspace-activation-types';
import type { OperationalAuditEntry, OperationalAuditEventType } from '@/lib/operations/audit/operational-audit';
import type { AttentionItem } from '@/lib/operations/severity';
import type { AgreementHealthSnapshot } from '@/lib/agreements/health/agreement-health.types';
import { formatCompactCurrency } from '@/lib/formatters/format-currency';

/* ─── Workspace maturity ─── */

/**
 * Auto-derived from operational state. No feature flags.
 *
 *   preparing   → Setting up agreements, no revenue yet
 *   growing     → Revenue flowing, building toward settlement
 *   operational → First release completed, agreements running
 *   mature      → Multiple agreements operational, regular releases
 */
export type WorkspaceMode =
  | 'preparing'   // focus: preparation
  | 'growing'     // focus: customer payments
  | 'operational' // focus: settlement
  | 'mature';     // focus: performance

/* ─── Today's focus item ─── */

export type FocusItem = {
  /** Short, action-oriented headline */
  headline: string;
  /** One sentence of context — "Without this, X cannot happen." */
  context: string;
  /** What completing this unlocks */
  consequences: string[];
  /** Estimated minutes */
  estimatedMinutes: number;
  /** Where to go */
  href: string;
  /** Button label */
  label: string;
  /** Priority rank for ordering */
  priority: number;
  /** Which agreement this relates to */
  agreementName: string | null;
};

/* ─── Mission ─── */

export type Mission = {
  /** Agreement name */
  agreementName: string;
  /** "Prepare Sunset Sessions for customer payments." */
  missionStatement: string;
  /** Conversational progress: "Only one step remains before customer payments can begin." */
  progressNarrative: string;
  /** The next concrete action */
  nextAction: string;
  /** Estimated minutes to complete the mission's current step */
  estimatedMinutes: number;
  /** Where Continue goes */
  continueHref: string;
  /** 0–100 */
  completionPct: number;
  /** Decision engine result for this agreement */
  decision: CommercialDecisionResult;
};

/* ─── Interruption (critical items) ─── */

export type Interruption = {
  severity: 'critical' | 'high';
  headline: string;
  explanation: string;
  href: string;
  label: string;
  agreementName: string | null;
};

/* ─── Celebration ─── */

export type Celebration = {
  headline: string;
  context: string;
  /** ISO timestamp */
  at: string;
};

/* ─── Full workspace experience ─── */

export type WorkspaceExperience = {
  /**
   * Aggregated commercial capabilities for the workspace.
   * Derived from the primary agreement's CommercialBrain result.
   * Every dashboard widget that shows completion state reads from here.
   * Always present — never null.
   */
  commercialCapabilities: CommercialCapabilities;
  /** Top 3 actionable items for today — the primary "Today" experience */
  todaysFocus: FocusItem[];
  /** Current primary mission (lowest-score agreement needing work) */
  currentMission: Mission | null;
  /** Critical items requiring immediate attention */
  interruptions: Interruption[];
  /** Provvy memory from audit history */
  memory: WorkflowMemory | null;
  /** Recent positive milestone celebration */
  celebration: Celebration | null;
  /** Current workspace maturity mode */
  workspaceMode: WorkspaceMode;
  /** Greeting: "Good afternoon, Alisha." */
  greeting: string;
  /** First-person opening summary */
  openingSummary: string;
};

/* ─── Input ─── */

export type WorkspaceExperienceInput = {
  operatorName?: string;
  snapshots: AgreementHealthSnapshot[];
  kpis: OperationalKPIs | null;
  releaseConfidence: ReleaseConfidenceSnapshot | null;
  workspaceContext: WorkspaceOperationalContext | null;
  activation: WorkspaceActivationSnapshot | null;
  attentionItems: AttentionItem[];
  auditEntries: OperationalAuditEntry[];
};

/* ─── Helpers ─── */

function timeOfDayGreeting(name?: string): string {
  const h = new Date().getHours();
  const base = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return name ? `${base}, ${name}.` : `${base}.`;
}

function deriveMode(
  snapshots: AgreementHealthSnapshot[],
  releaseConfidence: ReleaseConfidenceSnapshot | null,
  activation: WorkspaceActivationSnapshot | null
): WorkspaceMode {
  if (activation?.firstReleaseCompleted) {
    const multipleOperational = snapshots.filter(
      (s) => s.category === 'excellent' || s.category === 'healthy'
    ).length >= 2;
    return multipleOperational ? 'mature' : 'operational';
  }
  if ((releaseConfidence?.collectedRevenue ?? 0) > 0) return 'growing';
  return 'preparing';
}

function deriveProgressNarrative(decision: CommercialDecisionResult): string {
  const blockers = decision.priorityQueue.length;
  const stage = decision.workflowStage;

  if (stage === 'operational') return 'This agreement is commercially operational.';
  if (blockers === 0) return 'Everything is on track. This agreement is ready to proceed.';
  if (blockers === 1) {
    return `Only one step remains before ${stage === 'preparing-payments' ? 'customer payments can begin' : 'the next milestone is reached'}.`;
  }
  return `${blockers} steps remain before this agreement is ready.`;
}

function deriveMissionStatement(
  agreementName: string,
  decision: CommercialDecisionResult
): string {
  const stage = decision.workflowStage;
  switch (stage) {
    case 'setup':
    case 'configuring':
      return `Prepare ${agreementName} for revenue collection.`;
    case 'collecting-approvals':
      return `Complete ${agreementName} approvals to unlock payouts.`;
    case 'preparing-payments':
      return `Prepare ${agreementName} for customer payments.`;
    case 'ready-to-collect':
      return `${agreementName} is ready to begin collecting revenue.`;
    case 'collecting-revenue':
      return `Review ${agreementName} revenue and obligations.`;
    case 'ready-to-release':
      return `Release ${agreementName} payouts to team members.`;
    case 'operational':
      return `${agreementName} is commercially operational.`;
  }
}

const CELEBRATION_EVENTS: Partial<Record<OperationalAuditEventType, { headline: string; context: string }>> = {
  stripe_connected:        { headline: 'Payments are now live.', context: 'Customers can begin paying immediately.' },
  payment_rails_connected: { headline: 'Payment provider connected.', context: 'Revenue can now begin flowing.' },
  agreement_approved:      { headline: 'Approval received.', context: 'The agreement is moving forward.' },
  release_batch_generated: { headline: 'Payouts released.', context: 'Team members will receive their payments shortly.' },
  obligations_funded:      { headline: 'Revenue allocated.', context: 'Payment obligations are funded and ready.' },
  payout_eligible:         { headline: 'Payouts unlocked.', context: 'Team members are now eligible for payment.' },
};

const NINETY_MINUTES = 90 * 60 * 1000;

function findCelebration(auditEntries: OperationalAuditEntry[]): Celebration | null {
  const now = Date.now();
  const recent = [...auditEntries]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .find((e) => {
      const copy = CELEBRATION_EVENTS[e.type];
      if (!copy) return false;
      return now - new Date(e.timestamp).getTime() < NINETY_MINUTES;
    });

  if (!recent) return null;
  const copy = CELEBRATION_EVENTS[recent.type]!;
  return { headline: copy.headline, context: copy.context, at: recent.timestamp };
}

/* ─── Build today's focus ─── */

function buildTodaysFocus(
  decisions: Array<{ decision: CommercialDecisionResult; snapshot: AgreementHealthSnapshot }>,
  releaseConfidence: ReleaseConfidenceSnapshot | null,
  currency: string
): FocusItem[] {
  const items: FocusItem[] = [];

  // Gather priority items across all agreements
  for (const { decision, snapshot } of decisions) {
    for (const item of decision.priorityQueue.slice(0, 2)) {
      items.push({
        headline: item.title,
        context: item.explanation,
        consequences: item.consequences,
        estimatedMinutes: item.estimatedMinutes,
        href: item.href,
        label: item.label,
        priority: ['money_blocked', 'settlement_blocked'].includes(item.tier) ? 0
          : ['approvals_pending', 'payment_provider'].includes(item.tier) ? 1
          : 2,
        agreementName: snapshot.agreementName,
      });
    }
  }

  // Add settlement release if ready
  if ((releaseConfidence?.readyToRelease ?? 0) > 0) {
    const amount = formatCompactCurrency(releaseConfidence!.readyToRelease, currency);
    const existing = items.find((i) => i.href.includes('/payouts'));
    if (!existing) {
      items.push({
        headline: `${amount} is ready to release.`,
        context: 'Revenue has cleared and team members are ready to receive their payments.',
        consequences: ['Team members receive payments', 'Settlement obligations close'],
        estimatedMinutes: 2,
        href: `/dashboard/projects/${decisions[0]?.snapshot.projectId ?? ''}/payouts`,
        label: 'Release payouts',
        priority: 0,
        agreementName: decisions[0]?.snapshot.agreementName ?? null,
      });
    }
  }

  // Sort by priority, deduplicate by href, take top 3
  return items
    .sort((a, b) => a.priority - b.priority)
    .filter((item, idx, arr) => arr.findIndex((i) => i.href === item.href) === idx)
    .slice(0, 3);
}

/* ─── Opening summary ─── */

function buildOpeningSummary(
  mode: WorkspaceMode,
  focus: FocusItem[],
  memory: WorkflowMemory | null,
  celebration: Celebration | null
): string {
  if (celebration) {
    return `${celebration.headline} ${celebration.context}`;
  }

  if (memory?.lastActionSentence) {
    return `${memory.lastActionSentence} ${memory.todayIntentSentence}`;
  }

  if (focus.length === 0) {
    switch (mode) {
      case 'operational': return "Everything is running normally. I'll let you know when something needs attention.";
      case 'mature':      return "Your agreements are commercially operational. I'm monitoring them now.";
      default:            return "I've reviewed your business. Everything is on track.";
    }
  }

  const count = focus.length;
  return count === 1
    ? "I've reviewed your business. There's one thing worth your attention today."
    : `I've reviewed your business. ${count === 2 ? 'Two things are' : `${count} things are`} worth your attention today.`;
}

/* ─── Public API ─── */

/**
 * Build the complete workspace experience.
 * Call once per dashboard render — feed it all workspace data.
 * Every screen consumes the resulting object.
 */
export function buildWorkspaceExperience(
  input: WorkspaceExperienceInput
): WorkspaceExperience {
  const {
    operatorName,
    snapshots,
    kpis,
    releaseConfidence,
    workspaceContext,
    activation,
    attentionItems,
    auditEntries,
  } = input;

  const currency = releaseConfidence?.currency ?? workspaceContext?.defaultCurrency ?? 'AUD';
  const mode = deriveMode(snapshots, releaseConfidence, activation);

  // Run Decision Engine for each agreement (sorted: needs-most-work first)
  const sortedSnapshots = [...snapshots].sort((a, b) => a.score - b.score);
  const decisions = sortedSnapshots.map((snapshot) => ({
    snapshot,
    decision: analyseWorkspace({
      projectId: snapshot.projectId,
      agreementName: snapshot.agreementName,
      kpis,
      releaseConfidence,
      workspaceContext,
      activation,
      attentionItems,
      auditEntries,
    }),
  }));

  // Primary mission = lowest-score agreement with remaining work
  const primaryEntry = decisions.find((d) => !d.decision.priorityQueue.length === false)
    ?? decisions[0];

  const currentMission: Mission | null = primaryEntry
    ? {
        agreementName: primaryEntry.snapshot.agreementName,
        missionStatement: deriveMissionStatement(
          primaryEntry.snapshot.agreementName,
          primaryEntry.decision
        ),
        progressNarrative: deriveProgressNarrative(primaryEntry.decision),
        nextAction: primaryEntry.decision.recommendedAction?.title ?? primaryEntry.decision.nextStep,
        estimatedMinutes: primaryEntry.decision.estimatedMinutes,
        continueHref: primaryEntry.decision.continueHref,
        completionPct: primaryEntry.decision.workflowStage === 'operational' ? 100
          : Math.round(primaryEntry.snapshot.score),
        decision: primaryEntry.decision,
      }
    : null;

  // Interruptions = critical items across all agreements
  const interruptions: Interruption[] = decisions
    .flatMap(({ decision, snapshot }) =>
      decision.priorityQueue
        .filter((item) => item.tier === 'money_blocked' || item.tier === 'settlement_blocked')
        .map((item) => ({
          severity: 'critical' as const,
          headline: item.title,
          explanation: item.explanation,
          href: item.href,
          label: item.label,
          agreementName: snapshot.agreementName,
        }))
    )
    .slice(0, 3);

  const todaysFocus = buildTodaysFocus(decisions, releaseConfidence, currency);
  const memory = decisions[0]?.decision.memory ?? null;
  const celebration = findCelebration(auditEntries);

  const greeting = timeOfDayGreeting(operatorName);
  const openingSummary = buildOpeningSummary(mode, todaysFocus, memory, celebration);

  // Derive workspace-level capabilities from the primary agreement's engine result.
  // If the primary agreement has already computed them, reuse that result directly;
  // otherwise compute fresh from workspace-level inputs. Always returns a value.
  const commercialCapabilities =
    decisions[0]?.decision.commercialCapabilities ??
    deriveCommercialCapabilities({ kpis, releaseConfidence, workspaceContext, activation });

  return {
    commercialCapabilities,
    todaysFocus,
    currentMission,
    interruptions,
    memory,
    celebration,
    workspaceMode: mode,
    greeting,
    openingSummary,
  };
}
