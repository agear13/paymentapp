/**
 * Commercial Timeline Events
 *
 * The canonical timeline model for commercial commitments.
 *
 * Design rules:
 *   - Every event describes a commercial milestone, not a system event.
 *   - Every event has a `commercialImpact` — why it matters to the business.
 *   - Events are deduplicated by `id` and sorted newest-first by default.
 *   - No component may construct timeline events itself — use `buildCommercialTimeline`.
 *   - The builder bridges from `OperationalAuditEntry[]` to this model.
 *     When audit entries improve, this timeline improves automatically.
 *
 * Do NOT build audit log events. Model commercial milestones.
 */

import type { OperationalAuditEntry, OperationalAuditEventType } from '@/lib/operations/audit/operational-audit';
import { mergeAuditTimeline } from '@/lib/operations/audit/operational-audit';
import type { CommercialCommitmentStage } from '@/lib/commercial/commitment-lifecycle';

/* ─── Event type ────────────────────────────────────────────────────────────── */

/**
 * The commercial event types surfaced in the timeline.
 * These are the business events an operator cares about — not system events.
 */
export type CommercialEventType =
  | 'agreement_negotiated'      // Agreement created / conversation imported
  | 'agreement_generated'       // Agreement document generated for participant
  | 'agreement_sent'            // Agreement sent to participant for review
  | 'agreement_viewed'          // Participant opened the agreement
  | 'agreement_approved'        // Participant approved the commercial terms
  | 'participant_added'         // New participant added to the agreement
  | 'earnings_configured'       // Earnings / compensation terms configured
  | 'payment_provider_connected'// Payment provider (Stripe / Wise / Hedera) connected
  | 'revenue_received'          // Revenue / funding source linked
  | 'revenue_confirmed'         // Revenue source confirmed (HIGH confidence or RECEIVED)
  | 'revenue_threshold_achieved'// Revenue milestone reached
  | 'deposit_received'          // Deposit / down-payment received
  | 'payment_evidence_uploaded' // Remittance advice, receipt, or grant approval uploaded
  | 'forecast_updated'          // Commercial forecast recalculated after a change
  | 'commercial_risk_resolved'  // A commercial risk has been resolved
  | 'obligations_created'       // Commercial obligations calculated
  | 'obligations_funded'        // Obligations backed by collected revenue
  | 'invoice_requested'         // Invoice requested from participant
  | 'invoice_received'          // Invoice received and verified
  | 'exported_to_xero'          // Exported to Xero for accounting
  | 'payment_released'          // Payout released to participant
  | 'settlement_complete'       // All obligations settled
  | 'conditional_bonus_unlocked'// Conditional payment unlocked by revenue trigger
  | 'referral_commission_confirmed' // Referral commission confirmed;

/* ─── Event model ───────────────────────────────────────────────────────────── */

/**
 * A single milestone in a commercial relationship's timeline.
 *
 * Every event answers:
 *   1. What happened?   → title + description
 *   2. Who did it?      → performedBy
 *   3. Why does it matter commercially?  → commercialImpact
 */
export type CommercialTimelineEvent = {
  /** Stable deduplication key. */
  id: string;
  /** Agreement this event belongs to. */
  projectId?: string;
  /** Participant this event relates to, if applicable. */
  participantId?: string;
  /** The commercial lifecycle stage this event advances. */
  stage: CommercialCommitmentStage;
  /** Semantic event classification. */
  type: CommercialEventType;
  /** Commercial-language title. e.g. "Agreement approved" */
  title: string;
  /** One sentence explaining what happened. e.g. "Ben accepted the commercial terms." */
  description: string;
  /**
   * One sentence explaining why this matters commercially.
   * e.g. "Revenue attribution and settlement can now begin."
   */
  commercialImpact: string;
  /** ISO timestamp when this event occurred. */
  occurredAt: string;
  /** Name of the person who performed this action, if known. */
  performedBy?: string;
  /** Supplementary structured data for specialised rendering. */
  metadata?: Record<string, unknown>;
};

/* ─── Audit-type → commercial event mapping ─────────────────────────────────── */

type AuditMapping = {
  type: CommercialEventType;
  stage: CommercialCommitmentStage;
  title: string;
  /** Generates the description from the audit entry. Receives the entry for context. */
  description: (entry: OperationalAuditEntry) => string;
  /** Why this matters commercially. */
  commercialImpact: string;
};

const AUDIT_TO_COMMERCIAL: Partial<Record<OperationalAuditEventType, AuditMapping>> = {
  conversation_imported: {
    type: 'agreement_negotiated',
    stage: 'negotiated',
    title: 'Agreement negotiated',
    description: (e) =>
      e.conversationImport?.extractionSummary?.oneLiner
        ? e.conversationImport.extractionSummary.oneLiner
        : e.actor
          ? `${e.actor} set up the commercial agreement.`
          : 'Commercial terms were recorded from a conversation.',
    commercialImpact:
      'Commercial terms are recorded. The agreement is ready to be formalised and sent for approval.',
  },

  agreement_shared: {
    type: 'agreement_sent',
    stage: 'agreement_generated',
    title: 'Agreement sent for approval',
    description: (e) =>
      e.actor
        ? `Agreement sent to ${e.actor} for review.`
        : 'Agreement sent to participant for review.',
    commercialImpact:
      'The participant has been invited to approve their commercial terms. Payouts cannot be released until approved.',
  },

  agreement_viewed: {
    type: 'agreement_viewed',
    stage: 'agreement_generated',
    title: 'Agreement reviewed by participant',
    description: (e) =>
      e.actor
        ? `${e.actor} opened the agreement.`
        : 'Participant opened and reviewed the agreement.',
    commercialImpact:
      'The participant is reviewing their commercial terms. Approval may follow shortly.',
  },

  agreement_approved: {
    type: 'agreement_approved',
    stage: 'agreement_approved',
    title: 'Agreement approved',
    description: (e) =>
      e.actor
        ? `${e.actor} accepted the commercial terms.`
        : 'Participant accepted the commercial terms.',
    commercialImpact:
      'Revenue attribution and settlement can now begin for this participant.',
  },

  compensation_updated: {
    type: 'earnings_configured',
    stage: 'negotiated',
    title: 'Earnings configured',
    description: (e) =>
      e.actor
        ? `${e.actor}'s earnings were configured.`
        : 'Participant earnings and compensation terms were configured.',
    commercialImpact:
      'Settlement amounts will be calculated from these earnings. The agreement can now be sent for approval.',
  },

  stripe_connected: {
    type: 'payment_provider_connected',
    stage: 'agreement_approved',
    title: 'Payment provider connected',
    description: () => 'Stripe was connected as the payment provider.',
    commercialImpact:
      'Customer payments can now be collected and revenue can begin flowing.',
  },

  payment_rails_connected: {
    type: 'payment_provider_connected',
    stage: 'agreement_approved',
    title: 'Payment provider connected',
    description: () => 'A payment provider was connected to the workspace.',
    commercialImpact:
      'Customer payments can now be collected and revenue can begin flowing.',
  },

  funding_linked: {
    type: 'revenue_received',
    stage: 'obligations_created',
    title: 'Revenue source linked',
    description: (e) =>
      // The description field is already formatted with name/amount/currency by auditEntryFromOperationalEvent
      e.description && e.description !== 'Funding source updated'
        ? e.description
        : 'A revenue source was linked to the agreement.',
    commercialImpact:
      'Revenue is being tracked against settlement obligations. Payouts will be calculated from this income.',
  },

  funding_reserved_against_obligations: {
    type: 'obligations_funded',
    stage: 'obligations_created',
    title: 'Revenue reserved for settlement',
    description: () => 'Collected revenue has been allocated against participant obligations.',
    commercialImpact:
      'Sufficient funds are reserved. Obligations can be released when all conditions are met.',
  },

  obligations_generated: {
    type: 'obligations_created',
    stage: 'obligations_created',
    title: 'Commercial obligations created',
    description: (e) => {
      // The description may already contain the obligation count from auditEntryFromOperationalEvent
      if (e.description && /obligation/i.test(e.description)) {
        return e.description;
      }
      return 'Payment obligations were calculated from the agreed commercial terms.';
    },
    commercialImpact:
      'Settlement amounts are now calculated and ready for review. Invoices can be requested.',
  },

  obligations_funded: {
    type: 'obligations_funded',
    stage: 'obligations_created',
    title: 'Obligations confirmed for settlement',
    description: () => 'Participant obligations have been funded and confirmed.',
    commercialImpact:
      'Settlement can proceed. Payments will be released once all conditions are satisfied.',
  },

  payout_eligible: {
    type: 'payment_released',
    stage: 'payment_released',
    title: 'Participant cleared for payment',
    description: (e) =>
      e.actor
        ? `${e.actor} is cleared for payment release.`
        : 'Participant payout has been verified and approved.',
    commercialImpact:
      'This participant will receive payment in the next release batch.',
  },

  release_batch_generated: {
    type: 'payment_released',
    stage: 'payment_released',
    title: 'Payments released',
    description: (e) =>
      e.actor
        ? `Payment batch released by ${e.actor}.`
        : 'A payment batch was released to team members.',
    commercialImpact:
      'Team members have received their payments. Settlement obligations are now discharged.',
  },

  attribution_configured: {
    type: 'referral_commission_confirmed',
    stage: 'obligations_created',
    title: 'Revenue attribution configured',
    description: (e) =>
      e.actor
        ? `Revenue attribution for ${e.actor} was configured.`
        : 'Revenue attribution rules were configured for this agreement.',
    commercialImpact:
      'Commission tracking is active. Revenue will be attributed automatically to qualifying participants.',
  },

  workspace_created: {
    type: 'agreement_negotiated',
    stage: 'negotiated',
    title: 'Workspace created',
    description: () => 'Commercial workspace was initialised.',
    commercialImpact:
      'The commercial relationship is ready to be configured with participants and terms.',
  },

  project_initialized: {
    type: 'agreement_negotiated',
    stage: 'negotiated',
    title: 'Agreement created',
    description: () => 'Agreement was created in the commercial workspace.',
    commercialImpact:
      'Participants and earnings can now be configured.',
  },
};

/* ─── Participant timeline helper ───────────────────────────────────────────── */

/**
 * Derives a participant's commercial journey as a compact ordered list.
 * Each item is a stage label and completion boolean.
 * Used by participant cards to show "Negotiated → Approved → Paid" history.
 */
export type ParticipantCommercialJourneyStep = {
  stage: CommercialCommitmentStage;
  label: string;
  completed: boolean;
  occurredAt?: string;
};

/* ─── Canonical builder ─────────────────────────────────────────────────────── */

export type BuildCommercialTimelineInput = {
  /** Audit entries from the operational audit store / coordination-snapshot. */
  auditEntries: OperationalAuditEntry[];
  /** Optional additional audit entries to merge (e.g. from conversation import). */
  additionalEntries?: OperationalAuditEntry[];
  /** When set, only events for this project are included. */
  projectId?: string;
  /** When set, returns only events relevant to this participant. */
  participantId?: string;
  /**
   * When true, returns entries newest-first (default).
   * Set to false for participant journey displays where oldest-first is clearer.
   */
  newestFirst?: boolean;
};

/**
 * The canonical factory for all CommercialTimelineEvent arrays.
 *
 * No component may construct CommercialTimelineEvent objects itself.
 * Every timeline in the product must go through this function.
 *
 * The builder:
 *   1. Merges and deduplicates audit entries
 *   2. Filters to the requested scope (project / participant)
 *   3. Maps each entry to a CommercialTimelineEvent using commercial language
 *   4. Drops non-commercial system events (unmapped entries are excluded)
 *   5. Deduplicates resulting events
 *   6. Sorts by occurredAt (newest-first by default)
 */
export function buildCommercialTimeline(
  input: BuildCommercialTimelineInput
): CommercialTimelineEvent[] {
  const { projectId, participantId, newestFirst = true } = input;

  // 1. Merge and deduplicate source entries
  const merged = input.additionalEntries?.length
    ? mergeAuditTimeline(input.auditEntries, input.additionalEntries)
    : [...input.auditEntries];

  // 2. Scope filter
  const scoped = merged.filter((e) => {
    if (projectId && e.projectId && e.projectId !== projectId) return false;
    if (participantId && e.participantId && e.participantId !== participantId) return false;
    return true;
  });

  // 3. Map to commercial events
  const mapped: CommercialTimelineEvent[] = [];
  const seenIds = new Set<string>();

  for (const entry of scoped) {
    const mapping = AUDIT_TO_COMMERCIAL[entry.type];
    if (!mapping) continue; // drop system-only events

    const event: CommercialTimelineEvent = {
      id: entry.id,
      projectId: entry.projectId,
      participantId: entry.participantId,
      stage: mapping.stage,
      type: mapping.type,
      title: mapping.title,
      description: mapping.description(entry),
      commercialImpact: mapping.commercialImpact,
      occurredAt: entry.timestamp,
      performedBy: entry.actor,
      metadata: buildEventMetadata(entry),
    };

    // 4. Deduplication — same id wins for the first occurrence
    if (!seenIds.has(event.id)) {
      seenIds.add(event.id);
      mapped.push(event);
    }
  }

  // 5. Sort
  mapped.sort((a, b) => {
    const diff = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
    return newestFirst ? diff : -diff;
  });

  return mapped;
}

function buildEventMetadata(
  entry: OperationalAuditEntry
): Record<string, unknown> | undefined {
  if (entry.type === 'conversation_imported' && entry.conversationImport) {
    return { conversationImport: entry.conversationImport };
  }
  return undefined;
}

/* ─── Participant journey builder ────────────────────────────────────────────── */

import {
  COMMITMENT_STAGE_ORDER,
  COMMITMENT_STAGE_SHORT_LABELS,
} from '@/lib/commercial/commitment-lifecycle';

/**
 * Derives the compact commercial journey steps for a single participant.
 * Returns the stages the participant has passed through, in order.
 *
 * Used by participant cards to render "Negotiated → Approved → Paid" history.
 */
export function buildParticipantCommercialJourney(
  events: CommercialTimelineEvent[],
  participantId: string
): ParticipantCommercialJourneyStep[] {
  const participantEvents = events.filter(
    (e) => !e.participantId || e.participantId === participantId
  );

  const completedByStage = new Map<CommercialCommitmentStage, string>();
  for (const e of participantEvents) {
    if (!completedByStage.has(e.stage)) {
      completedByStage.set(e.stage, e.occurredAt);
    }
  }

  const highestStageIdx = completedByStage.size > 0
    ? Math.max(...[...completedByStage.keys()].map((s) => COMMITMENT_STAGE_ORDER.indexOf(s)))
    : -1;

  return COMMITMENT_STAGE_ORDER.map((stage, idx) => ({
    stage,
    label: COMMITMENT_STAGE_SHORT_LABELS[stage],
    completed: idx <= highestStageIdx || completedByStage.has(stage),
    occurredAt: completedByStage.get(stage),
  }));
}

/* ─── AI timeline context builder ───────────────────────────────────────────── */

/**
 * Produces a concise plain-text summary of recent commercial events for use
 * in Provvy's conversational context.
 *
 * Example output:
 *   "Sarah approved yesterday. Ben received the agreement 2 days ago.
 *    Payments were released last week."
 */
export function buildCommercialTimelineContext(
  events: CommercialTimelineEvent[],
  maxEvents = 5
): string {
  if (events.length === 0) return '';

  const recent = events.slice(0, maxEvents);
  const sentences = recent.map((e) => {
    const when = relativeTimeLabel(e.occurredAt);
    const who = e.performedBy ? `${e.performedBy} ` : '';
    return `${who}${e.title.toLowerCase()} ${when}.`;
  });

  return sentences.join(' ');
}

/**
 * Returns a summary sentence for Provvy about the most recent commercial event
 * and what must happen next.
 *
 * Example:
 *   "Sarah approved yesterday. Ben is still waiting to approve.
 *    Once Ben approves, invoices can be requested."
 */
export function buildProvvyTimelineNarrative(input: {
  events: CommercialTimelineEvent[];
  pendingParticipantNames?: string[];
  nextCommercialAction?: string;
}): string {
  const { events, pendingParticipantNames = [], nextCommercialAction } = input;

  const parts: string[] = [];

  // Most recent completed event
  const mostRecent = events[0];
  if (mostRecent) {
    const when = relativeTimeLabel(mostRecent.occurredAt);
    const who = mostRecent.performedBy ? `${mostRecent.performedBy} ` : '';
    parts.push(`${who}${mostRecent.title.toLowerCase()} ${when}.`);
  }

  // Pending participants
  if (pendingParticipantNames.length === 1) {
    parts.push(`${pendingParticipantNames[0]} is still waiting to approve.`);
  } else if (pendingParticipantNames.length > 1) {
    const names = pendingParticipantNames.join(', ');
    parts.push(`${names} are still waiting to approve.`);
  }

  // Next action consequence
  if (nextCommercialAction) {
    parts.push(`Once complete, ${nextCommercialAction.toLowerCase()}.`);
  }

  return parts.join(' ');
}

/* ─── Utilities ─────────────────────────────────────────────────────────────── */

export function relativeTimeLabel(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 2) return 'just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 2) return 'an hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return 'last week';
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}
