/**
 * Commercial Event Bus
 *
 * The single canonical pipeline for all commercial events in Provvypay.
 *
 * Architecture principle:
 *   One commercial event updates one Commercial Graph.
 *   Every other surface (Timeline, Forecast, Workflow, Dashboard, Provvy) reacts.
 *
 * Design rules:
 *   - `processCommercialEvent` is PURE — no network calls, no side effects, no global state.
 *   - Callers handle persistence (writing to audit log, triggering refresh).
 *   - Same inputs always produce the same output (deterministic).
 *   - No component may duplicate forecast or timeline calculations.
 *   - This is the only place commercial consequence language is defined per event.
 *
 * Pipeline:
 *   CommercialEvent
 *     ↓
 *   processCommercialEvent(event, context)
 *     ↓ produces CommercialEventOutput containing:
 *   • timelineEvent     → append to CommercialTimeline
 *   • forecastMutation  → re-run deriveCommercialForecast() with mutations applied
 *   • workflowEffect    → informs which workflow stage was advanced
 *   • notification      → operator-facing toast/notification copy
 *
 * Callers are responsible for:
 *   1. Writing the audit entry (appendOperationalAuditEntry)
 *   2. Dispatching the refresh (notifyWorkspaceActivationRefresh)
 *   3. Displaying the notification (Sonner toast)
 */

import type { CommercialTimelineEvent } from '@/lib/commercial/commercial-timeline-events';
import type {
  CommercialForecastInput,
  CommercialForecastResult,
  IncomingRevenueStatus,
} from '@/lib/commercial/commercial-forecast';
import type { ProjectFundingSourceDto } from '@/lib/projects/funding-sources/types';
import type { BriefingObligationRowInput } from '@/lib/agreements/agreement-briefing.model';
import { deriveCommercialForecast } from '@/lib/commercial/commercial-forecast';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';

/* ─── Canonical event types ─────────────────────────────────────────────────── */

/**
 * Every commercial event that can flow through the pipeline.
 * Named after the commercial milestone — never the system event.
 */
export type CommercialEventKind =
  | 'agreement_negotiated'       // Agreement created / conversation imported
  | 'agreement_approved'         // Participant approved their commercial terms
  | 'obligation_created'         // Commercial obligation calculated from terms
  | 'invoice_requested'          // Invoice requested from a participant
  | 'invoice_received'           // Invoice uploaded and received
  | 'invoice_approved'           // Invoice verified and approved for payment
  | 'invoice_exported'           // Supplier bill pushed to Xero / accounting system
  | 'revenue_expected'           // Revenue source added to the forecast
  | 'revenue_confirmed'          // Revenue source confirmed (HIGH confidence / received)
  | 'funding_evidence_uploaded'  // Payment evidence attached (remittance, receipt, grant)
  | 'revenue_cleared'            // Revenue cleared into the workspace account
  | 'settlement_ready'           // All obligations funded and ready for release
  | 'payment_released'           // Payment released to a participant
  | 'settlement_completed'       // All obligations settled — agreement is operational
  | 'supplier_onboarding_started'    // Agreement approved — onboarding auto-initiated
  | 'supplier_details_submitted'     // Supplier completed their onboarding form
  | 'supplier_onboarding_approved'   // Operator verified supplier details
  | 'supplier_invoice_generated'     // Draft invoice auto-generated from agreement
  | 'supplier_invoice_exported';     // Invoice pushed to Xero by operator

/* ─── Event payload ─────────────────────────────────────────────────────────── */

export type CommercialEvent = {
  /** The commercial event kind — never a system event. */
  kind: CommercialEventKind;
  /** The agreement / project this event belongs to. */
  projectId: string;
  /** ISO timestamp when this event occurred. */
  occurredAt: string;
  /** The participant involved, if applicable. */
  participantId?: string;
  /** Display name of the participant or organisation. */
  actorName?: string;
  /** Monetary amount associated with this event. */
  amount?: number;
  /** Currency of the amount. */
  currency?: string;
  /** Name of the agreement (used in notification copy). */
  agreementName?: string;
  /** Name of the revenue source or organisation. */
  sourceName?: string;
  /** Additional context for the notification. */
  notes?: string;
  /** The funding source record being added/updated (for revenue events). */
  fundingSourcePatch?: Partial<ProjectFundingSourceDto>;
  /** The obligation row being updated (for invoice/payment events). */
  obligationPatch?: Partial<BriefingObligationRowInput> & { id: string };
};

/* ─── Context ───────────────────────────────────────────────────────────────── */

/**
 * The current state of the Commercial OS at the time an event fires.
 * The event processor uses this to derive the next state.
 */
export type CommercialEventContext = {
  /** Current forecast inputs (will be mutated by the event). */
  forecastInput: CommercialForecastInput;
  /** Current commercial timeline. */
  existingTimeline: CommercialTimelineEvent[];
  /** The agreement's display name. */
  agreementName?: string;
};

/* ─── Forecast input mutation ───────────────────────────────────────────────── */

/**
 * Describes how an event changes the forecast inputs.
 * Applied before re-running `deriveCommercialForecast()`.
 */
export type ForecastMutation = {
  /** New funding source to add, or status update for an existing one. */
  fundingSourcePatch?: Partial<ProjectFundingSourceDto> & { id: string };
  /** Obligation update (e.g. status change to FUNDED when invoice received). */
  obligationPatch?: Partial<BriefingObligationRowInput> & { id: string };
};

/* ─── Workflow effect ───────────────────────────────────────────────────────── */

export type WorkflowEffect = {
  /** Whether this event advances the workflow to a new stage. */
  advancesWorkflow: boolean;
  /** Descriptive label for what stage was unlocked. */
  unlockedStage?: string;
  /** True when this event makes the agreement commercially operational. */
  becomesOperational?: boolean;
};

/* ─── Notification ──────────────────────────────────────────────────────────── */

export type CommercialNotification = {
  /** Short headline (e.g. "Funding confirmed"). */
  title: string;
  /** One sentence commercial consequence. */
  description: string;
  /** Urgency level for toast styling. */
  level: 'success' | 'info' | 'warning' | 'error';
};

/* ─── Output ────────────────────────────────────────────────────────────────── */

export type CommercialEventOutput = {
  /** The event that was processed. */
  event: CommercialEvent;
  /** Timeline event to append to the Commercial Timeline. */
  timelineEvent: CommercialTimelineEvent;
  /** Updated timeline including the new event. */
  updatedTimeline: CommercialTimelineEvent[];
  /** Updated forecast after applying the mutation. */
  updatedForecast: CommercialForecastResult;
  /** The forecast mutation applied. */
  forecastMutation: ForecastMutation | null;
  /** Workflow advancement effect. */
  workflowEffect: WorkflowEffect;
  /** Operator-facing notification. */
  notification: CommercialNotification;
  /** Audit entry for persistence. Callers write this to the audit log. */
  auditEntry: Omit<OperationalAuditEntry, 'id'>;
};

/* ─── Core pipeline ─────────────────────────────────────────────────────────── */

/**
 * The canonical Commercial Event Processor.
 *
 * PURE FUNCTION — no side effects, no network calls.
 * Same inputs → same output, always.
 *
 * Feed it a commercial event and the current system state.
 * Receive the full updated state for every subsystem.
 *
 * Callers are responsible for:
 *   1. Writing auditEntry to the audit log
 *   2. Dispatching notifyWorkspaceActivationRefresh()
 *   3. Displaying the notification (toast)
 */
export function processCommercialEvent(
  event: CommercialEvent,
  context: CommercialEventContext
): CommercialEventOutput {
  /* ── 1. Build the timeline event ── */
  const timelineEvent = buildTimelineEventFromCommercialEvent(event, context);

  /* ── 2. Build the audit entry ── */
  const auditEntry = buildAuditEntryFromCommercialEvent(event);

  /* ── 3. Derive forecast mutation ── */
  const forecastMutation = deriveForecastMutation(event);

  /* ── 4. Apply mutation and recalculate forecast ── */
  const mutatedForecastInput = applyForecastMutation(context.forecastInput, forecastMutation);
  const updatedForecast = deriveCommercialForecast(mutatedForecastInput);

  /* ── 5. Build updated timeline ── */
  // Append the new event directly to the existing timeline.
  // Deduplicate by ID to prevent replay duplication; sort newest-first.
  const updatedTimeline = [...context.existingTimeline, timelineEvent]
    .filter((evt, idx, arr) => arr.findIndex((e) => e.id === evt.id) === idx)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  /* ── 6. Derive workflow effect ── */
  const workflowEffect = deriveWorkflowEffect(event, updatedForecast);

  /* ── 7. Build notification ── */
  const notification = buildNotification(event, updatedForecast, context);

  return {
    event,
    timelineEvent,
    updatedTimeline,
    updatedForecast,
    forecastMutation,
    workflowEffect,
    notification,
    auditEntry,
  };
}

/* ─── Timeline event builder ─────────────────────────────────────────────────── */

const EVENT_TIMELINE_TEMPLATES: Record<
  CommercialEventKind,
  {
    stage: CommercialTimelineEvent['stage'];
    type: CommercialTimelineEvent['type'];
    title: (event: CommercialEvent) => string;
    description: (event: CommercialEvent) => string;
    commercialImpact: (event: CommercialEvent) => string;
  }
> = {
  agreement_negotiated: {
    stage: 'negotiated',
    type: 'agreement_negotiated',
    title: () => 'Agreement negotiated',
    description: (e) =>
      e.actorName
        ? `${e.actorName} set up the commercial agreement.`
        : 'Commercial terms were recorded.',
    commercialImpact: () =>
      'Commercial terms are ready to be formalised. Participants can now be invited.',
  },
  agreement_approved: {
    stage: 'agreement_approved',
    type: 'agreement_approved',
    title: (e) => (e.actorName ? `${e.actorName} approved` : 'Agreement approved'),
    description: (e) =>
      e.actorName
        ? `${e.actorName} accepted the commercial terms.`
        : 'Participant accepted the commercial terms.',
    commercialImpact: () =>
      'Revenue attribution and settlement can now begin for this participant.',
  },
  obligation_created: {
    stage: 'obligations_created',
    type: 'obligations_created',
    title: () => 'Commercial obligations created',
    description: (e) =>
      e.actorName
        ? `${e.actorName}'s payment obligation was calculated from the agreed terms.`
        : 'Payment obligations were calculated from the agreed commercial terms.',
    commercialImpact: () =>
      'Settlement amounts are defined. Invoices can now be requested.',
  },
  invoice_requested: {
    stage: 'invoice_requested',
    type: 'invoice_requested',
    title: (e) => (e.actorName ? `Invoice requested from ${e.actorName}` : 'Invoice requested'),
    description: (e) =>
      e.actorName
        ? `An invoice was requested from ${e.actorName}.`
        : 'An invoice was requested from the participant.',
    commercialImpact: () =>
      'Waiting for invoice. Payment cannot be released until the invoice is received and approved.',
  },
  invoice_received: {
    stage: 'invoice_received',
    type: 'invoice_received',
    title: (e) => (e.actorName ? `Invoice received from ${e.actorName}` : 'Invoice received'),
    description: (e) => {
      const amountStr =
        e.amount && e.currency
          ? ` for ${e.currency} ${e.amount.toLocaleString()}`
          : '';
      return e.actorName
        ? `${e.actorName} submitted an invoice${amountStr}.`
        : `An invoice was received${amountStr}.`;
    },
    commercialImpact: () =>
      'Invoice is ready for verification before the supplier bill is pushed to Xero.',
  },
  invoice_approved: {
    stage: 'invoice_received',
    type: 'invoice_received',
    title: (e) => (e.actorName ? `Invoice approved for ${e.actorName}` : 'Invoice approved'),
    description: (e) =>
      e.actorName
        ? `${e.actorName}'s invoice has been verified and approved for payment.`
        : 'Invoice has been verified and approved for payment.',
    commercialImpact: () =>
      'Payment is authorised. Ready to push the supplier bill to Xero and release payment.',
  },
  invoice_exported: {
    stage: 'exported_to_xero',
    type: 'exported_to_xero',
    title: (e) => (e.actorName ? `Supplier bill pushed to Xero for ${e.actorName}` : 'Supplier bill pushed to Xero'),
    description: (e) =>
      e.actorName
        ? `${e.actorName}'s supplier bill was pushed to Xero.`
        : 'Supplier bill was pushed to the accounting system.',
    commercialImpact: () =>
      'Accounting records are updated. Payment can now be released.',
  },
  revenue_expected: {
    stage: 'obligations_created',
    type: 'revenue_received',
    title: (e) => (e.sourceName ? `Revenue expected from ${e.sourceName}` : 'Revenue expected'),
    description: (e) => {
      const amountStr =
        e.amount && e.currency
          ? ` of ${e.currency} ${e.amount.toLocaleString()}`
          : '';
      return e.sourceName
        ? `Revenue${amountStr} from ${e.sourceName} was added to the forecast.`
        : `Expected revenue${amountStr} was added to the forecast.`;
    },
    commercialImpact: () =>
      'The forecast has been updated. Review the forecast position to confirm settlement readiness.',
  },
  revenue_confirmed: {
    stage: 'obligations_created',
    type: 'revenue_confirmed',
    title: (e) => (e.sourceName ? `Revenue confirmed from ${e.sourceName}` : 'Revenue confirmed'),
    description: (e) => {
      const amountStr =
        e.amount && e.currency
          ? ` ${e.currency} ${e.amount.toLocaleString()}`
          : '';
      return e.sourceName
        ? `Payment of${amountStr} from ${e.sourceName} was confirmed.`
        : `Revenue payment was confirmed.`;
    },
    commercialImpact: () =>
      'Confirmed revenue strengthens the forecast. Settlement confidence has increased.',
  },
  funding_evidence_uploaded: {
    stage: 'obligations_created',
    type: 'payment_evidence_uploaded',
    title: (e) => (e.sourceName ? `Payment evidence uploaded for ${e.sourceName}` : 'Payment evidence uploaded'),
    description: (e) =>
      e.sourceName
        ? `Payment evidence was uploaded for ${e.sourceName}.`
        : 'Payment evidence was uploaded.',
    commercialImpact: () =>
      'Evidence increases confidence in this revenue source. Forecast accuracy has improved.',
  },
  revenue_cleared: {
    stage: 'obligations_created',
    type: 'revenue_received',
    title: (e) => (e.sourceName ? `Revenue cleared from ${e.sourceName}` : 'Revenue cleared'),
    description: (e) => {
      const amountStr =
        e.amount && e.currency
          ? ` ${e.currency} ${e.amount.toLocaleString()}`
          : '';
      return e.sourceName
        ? `${e.sourceName} payment of${amountStr} was cleared.`
        : `Revenue payment was cleared.`;
    },
    commercialImpact: () =>
      'Revenue is in the account. Obligations can now be funded for settlement.',
  },
  settlement_ready: {
    stage: 'obligations_created',
    type: 'obligations_funded',
    title: () => 'Ready for Settlement',
    description: () =>
      'All obligations are funded and verified. Settlement can proceed.',
    commercialImpact: () =>
      'Payments can now be released. Review obligations before releasing.',
  },
  payment_released: {
    stage: 'payment_released',
    type: 'payment_released',
    title: (e) => (e.actorName ? `Payment released to ${e.actorName}` : 'Payment released'),
    description: (e) => {
      const amountStr =
        e.amount && e.currency
          ? ` ${e.currency} ${e.amount.toLocaleString()}`
          : '';
      return e.actorName
        ? `${e.actorName} was paid${amountStr}.`
        : `Payment was released.`;
    },
    commercialImpact: () =>
      'Commercial obligation discharged. Participant has been paid.',
  },
  settlement_completed: {
    stage: 'settlement_complete',
    type: 'settlement_complete',
    title: () => 'Settlement complete',
    description: (e) =>
      e.agreementName
        ? `All obligations for ${e.agreementName} have been settled.`
        : 'All commercial obligations have been settled.',
    commercialImpact: () =>
      'The agreement is commercially operational. All participants have been paid.',
  },
  supplier_onboarding_started: {
    stage: 'agreement_approved',
    type: 'supplier_onboarding_requested',
    title: (e) =>
      e.actorName ? `Supplier onboarding started for ${e.actorName}` : 'Supplier onboarding started',
    description: (e) =>
      e.actorName
        ? `${e.actorName} has approved the agreement. Supplier onboarding has been automatically initiated.`
        : 'Supplier onboarding automatically initiated after agreement approval.',
    commercialImpact: () =>
      'Supplier must submit bank details, ABN, and GST status before settlement can proceed.',
  },
  supplier_details_submitted: {
    stage: 'agreement_approved',
    type: 'supplier_onboarding_completed',
    title: (e) =>
      e.actorName ? `${e.actorName} submitted onboarding details` : 'Supplier submitted details',
    description: (e) =>
      e.actorName
        ? `${e.actorName} has submitted their bank details, ABN, and GST status. Verify payout details.`
        : 'Supplier submitted bank details, ABN, and GST status.',
    commercialImpact: () =>
      'Operator must verify payout details before pushing the supplier bill to Xero.',
  },
  supplier_onboarding_approved: {
    stage: 'agreement_approved',
    type: 'supplier_invoice_approved',
    title: (e) =>
      e.actorName ? `${e.actorName}'s payout details verified` : 'Payout details verified',
    description: (e) =>
      e.actorName
        ? `${e.actorName}'s bank details, ABN, and GST status were verified.`
        : 'Supplier payout details verified.',
    commercialImpact: () =>
      'Supplier bill is ready to push to Xero.',
  },
  supplier_invoice_generated: {
    stage: 'agreement_approved',
    type: 'supplier_invoice_generated',
    title: (e) =>
      e.actorName ? `Draft invoice generated for ${e.actorName}` : 'Draft invoice generated',
    description: (e) =>
      e.actorName
        ? `Draft invoice automatically generated for ${e.actorName} from the approved commercial terms.`
        : 'Draft invoice automatically generated from the approved commercial terms.',
    commercialImpact: () =>
      'Supplier can now review and confirm their invoice. No manual upload required.',
  },
  supplier_invoice_exported: {
    stage: 'obligations_created',
    type: 'supplier_invoice_exported_to_xero',
    title: (e) =>
      e.actorName ? `Supplier bill pushed to Xero for ${e.actorName}` : 'Supplier bill pushed to Xero',
    description: (e) =>
      e.actorName
        ? `${e.actorName}'s supplier bill was pushed to Xero by the operator.`
        : 'Supplier bill pushed to Xero.',
    commercialImpact: () =>
      'Accounting is complete. Settlement preparation can now begin.',
  },
};

function buildTimelineEventFromCommercialEvent(
  event: CommercialEvent,
  context: CommercialEventContext
): CommercialTimelineEvent {
  const template = EVENT_TIMELINE_TEMPLATES[event.kind];
  const eventWithAgreementName = { ...event, agreementName: context.agreementName };

  return {
    id: `evt-${event.kind}-${event.occurredAt}-${event.participantId ?? 'global'}`,
    projectId: event.projectId,
    participantId: event.participantId,
    stage: template.stage,
    type: template.type,
    title: template.title(event),
    description: template.description(eventWithAgreementName),
    commercialImpact: template.commercialImpact(event),
    occurredAt: event.occurredAt,
    performedBy: event.actorName,
    metadata: event.amount
      ? { amount: event.amount, currency: event.currency ?? 'AUD' }
      : undefined,
  };
}

/* ─── Audit entry builder ─────────────────────────────────────────────────────── */

const KIND_TO_AUDIT_TYPE: Record<CommercialEventKind, string> = {
  agreement_negotiated: 'conversation_imported',
  agreement_approved: 'agreement_approved',
  obligation_created: 'obligations_generated',
  invoice_requested: 'obligations_generated',
  invoice_received: 'funding_linked',
  invoice_approved: 'obligations_funded',
  invoice_exported: 'release_batch_generated',
  revenue_expected: 'funding_linked',
  revenue_confirmed: 'funding_reserved_against_obligations',
  funding_evidence_uploaded: 'funding_linked',
  revenue_cleared: 'funding_reserved_against_obligations',
  settlement_ready: 'payout_eligible',
  payment_released: 'release_batch_generated',
  settlement_completed: 'release_batch_generated',
  supplier_onboarding_started: 'agreement_approved',
  supplier_details_submitted: 'obligations_generated',
  supplier_onboarding_approved: 'obligations_funded',
  supplier_invoice_generated: 'obligations_generated',
  supplier_invoice_exported: 'release_batch_generated',
};

function buildAuditEntryFromCommercialEvent(
  event: CommercialEvent
): Omit<OperationalAuditEntry, 'id'> {
  const template = EVENT_TIMELINE_TEMPLATES[event.kind];
  const auditType = KIND_TO_AUDIT_TYPE[event.kind];

  return {
    type: auditType as OperationalAuditEntry['type'],
    title: template.title(event),
    description: template.description(event),
    timestamp: event.occurredAt,
    actor: event.actorName,
    projectId: event.projectId,
    participantId: event.participantId,
  };
}

/* ─── Forecast mutation ──────────────────────────────────────────────────────── */

function deriveForecastMutation(event: CommercialEvent): ForecastMutation | null {
  switch (event.kind) {
    case 'revenue_expected':
      if (event.fundingSourcePatch) {
        return {
          fundingSourcePatch: {
            id: event.fundingSourcePatch.id ?? `new-${event.occurredAt}`,
            name: event.sourceName ?? 'Expected revenue',
            amount: event.amount ?? 0,
            currency: event.currency ?? 'AUD',
            status: 'PENDING',
            confidenceLevel: 'LOW',
            ...event.fundingSourcePatch,
          } as ProjectFundingSourceDto & { id: string },
        };
      }
      return null;

    case 'revenue_confirmed':
      if (event.fundingSourcePatch?.id) {
        return {
          fundingSourcePatch: {
            ...event.fundingSourcePatch,
            id: event.fundingSourcePatch.id,
            status: 'CONFIRMED',
            confidenceLevel: 'HIGH',
          } as unknown as ProjectFundingSourceDto & { id: string },
        };
      }
      return null;

    case 'funding_evidence_uploaded':
      if (event.fundingSourcePatch?.id) {
        return {
          fundingSourcePatch: {
            ...event.fundingSourcePatch,
            id: event.fundingSourcePatch.id,
            confidenceLevel: 'HIGH',
            linkedInvoiceId: event.fundingSourcePatch.linkedInvoiceId ?? 'evidence-linked',
          } as unknown as ProjectFundingSourceDto & { id: string },
        };
      }
      return null;

    case 'revenue_cleared':
      if (event.fundingSourcePatch?.id) {
        return {
          fundingSourcePatch: {
            ...event.fundingSourcePatch,
            id: event.fundingSourcePatch.id,
            status: 'CLEARED',
            confidenceLevel: 'HIGH',
          } as unknown as ProjectFundingSourceDto & { id: string },
        };
      }
      return null;

    case 'invoice_received':
    case 'invoice_approved':
      if (event.obligationPatch) {
        return {
          obligationPatch: {
            ...event.obligationPatch,
            status: event.kind === 'invoice_approved' ? 'FUNDED' : 'PARTIALLY_FUNDED',
          },
        };
      }
      return null;

    case 'payment_released':
      if (event.obligationPatch) {
        return {
          obligationPatch: {
            ...event.obligationPatch,
            status: 'PAID',
          },
        };
      }
      return null;

    default:
      return null;
  }
}

function applyForecastMutation(
  input: CommercialForecastInput,
  mutation: ForecastMutation | null
): CommercialForecastInput {
  if (!mutation) return input;

  let fundingSources = [...input.fundingSources];
  let obligationRows = [...input.obligationRows];

  if (mutation.fundingSourcePatch) {
    const { id, ...patch } = mutation.fundingSourcePatch;
    const existingIdx = fundingSources.findIndex((fs) => fs.id === id);
    if (existingIdx >= 0) {
      // Update existing
      fundingSources = [
        ...fundingSources.slice(0, existingIdx),
        { ...fundingSources[existingIdx], ...patch },
        ...fundingSources.slice(existingIdx + 1),
      ];
    } else {
      // Add new
      fundingSources = [...fundingSources, { ...patch, id } as ProjectFundingSourceDto];
    }
  }

  if (mutation.obligationPatch) {
    const { id, ...patch } = mutation.obligationPatch;
    const existingIdx = obligationRows.findIndex((r) => r.id === id);
    if (existingIdx >= 0) {
      obligationRows = [
        ...obligationRows.slice(0, existingIdx),
        { ...obligationRows[existingIdx], ...patch },
        ...obligationRows.slice(existingIdx + 1),
      ];
    }
  }

  return { ...input, fundingSources, obligationRows };
}

/* ─── Workflow effect ────────────────────────────────────────────────────────── */

function deriveWorkflowEffect(
  event: CommercialEvent,
  updatedForecast: CommercialForecastResult
): WorkflowEffect {
  switch (event.kind) {
    case 'agreement_approved':
    case 'supplier_onboarding_started':
      return {
        advancesWorkflow: true,
        unlockedStage: 'Supplier onboarding',
      };

    case 'supplier_invoice_generated':
      return {
        advancesWorkflow: true,
        unlockedStage: 'Supplier detail collection',
      };

    case 'supplier_details_submitted':
      return {
        advancesWorkflow: true,
        unlockedStage: 'Verify Payout Details',
      };

    case 'supplier_onboarding_approved':
      return {
        advancesWorkflow: true,
        unlockedStage: 'Push Supplier Bill to Xero',
      };

    case 'supplier_invoice_exported':
      return {
        advancesWorkflow: true,
        unlockedStage: 'Revenue collection',
      };

    case 'revenue_confirmed':
    case 'revenue_cleared':
      return {
        advancesWorkflow: updatedForecast.cashReadiness.canEveryoneBePaid,
        unlockedStage: updatedForecast.cashReadiness.canEveryoneBePaid
          ? 'Settlement review'
          : undefined,
      };

    case 'settlement_ready':
      return {
        advancesWorkflow: true,
        unlockedStage: 'Payment release',
      };

    case 'payment_released':
      return {
        advancesWorkflow: true,
        unlockedStage: 'Settlement tracking',
      };

    case 'settlement_completed':
      return {
        advancesWorkflow: true,
        unlockedStage: 'Operational',
        becomesOperational: true,
      };

    default:
      return { advancesWorkflow: false };
  }
}

/* ─── Notification builder ──────────────────────────────────────────────────── */

function buildNotification(
  event: CommercialEvent,
  updatedForecast: CommercialForecastResult,
  context: CommercialEventContext
): CommercialNotification {
  const curr = event.currency ?? 'AUD';
  const amountStr = event.amount
    ? ` ${curr} ${event.amount.toLocaleString()}`
    : '';
  const agreementName = context.agreementName ?? 'the agreement';
  const actor = event.actorName ?? 'Participant';
  const source = event.sourceName ?? 'Revenue source';

  switch (event.kind) {
    case 'agreement_negotiated':
      return {
        title: 'Project created',
        description: `Commercial terms for ${agreementName} are ready to be sent for approval.`,
        level: 'success',
      };

    case 'agreement_approved':
      return {
        title: `${actor} approved`,
        description: `${actor} accepted their commercial terms. Supplier onboarding has been automatically initiated.`,
        level: 'success',
      };

    case 'supplier_onboarding_started':
      return {
        title: 'Supplier onboarding initiated',
        description: `${actor}'s draft invoice has been generated automatically. Send onboarding to collect bank details, ABN, and GST status.`,
        level: 'info',
      };

    case 'supplier_invoice_generated':
      return {
        title: `Draft invoice generated for ${actor}`,
        description: `Invoice generated automatically from the approved commercial terms. ${actor} can now review and confirm.`,
        level: 'success',
      };

    case 'supplier_details_submitted':
      return {
        title: `${actor} completed supplier onboarding`,
        description: `${actor} submitted their bank details, ABN, and GST status. Verify payout details before pushing the supplier bill to Xero.`,
        level: 'warning',
      };

    case 'supplier_onboarding_approved':
      return {
        title: `${actor}'s payout details verified`,
        description: `${actor}'s payout details have been verified. The supplier bill is ready to push to Xero.`,
        level: 'success',
      };

    case 'supplier_invoice_exported':
      return {
        title: `Supplier bill pushed to Xero for ${actor}`,
        description: `${actor}'s supplier bill has been pushed to Xero. Settlement preparation can now begin.`,
        level: 'success',
      };

    case 'obligation_created':
      return {
        title: 'Obligations calculated',
        description: `Commercial obligations for ${actor} are ready. Request invoices to proceed.`,
        level: 'info',
      };

    case 'invoice_requested':
      return {
        title: `Invoice requested from ${actor}`,
        description: `${actor} has been asked to submit their invoice. Settlement awaits receipt.`,
        level: 'info',
      };

    case 'invoice_received':
      return {
        title: `Invoice received from ${actor}`,
        description: `${actor}'s invoice${amountStr} has been received. Approve it to proceed.`,
        level: 'success',
      };

    case 'invoice_approved':
      return {
        title: 'Invoice approved',
        description: `${actor}'s invoice is approved. Ready to push the supplier bill to Xero and release payment.`,
        level: 'success',
      };

    case 'invoice_exported':
      return {
        title: 'Supplier bill pushed to Xero',
        description: `${actor}'s supplier bill has been pushed to Xero. Payment can now be released.`,
        level: 'success',
      };

    case 'revenue_expected': {
      const positionStr = updatedForecast.cashReadiness.canEveryoneBePaid
        ? `Forecast position: +${curr} ${updatedForecast.forecastPosition.forecastSurplus.toLocaleString()}.`
        : `Forecast shortfall: ${curr} ${Math.abs(updatedForecast.forecastPosition.forecastBalance).toLocaleString()}.`;
      return {
        title: `Revenue expected: ${source}`,
        description: `${curr} ${(event.amount ?? 0).toLocaleString()} added from ${source}. ${positionStr}`,
        level: 'info',
      };
    }

    case 'revenue_confirmed': {
      const canPay = updatedForecast.cashReadiness.canEveryoneBePaid;
      return {
        title: `Revenue confirmed: ${source}`,
        description: canPay
          ? `Payment from ${source} confirmed. Forecast surplus: +${curr} ${updatedForecast.forecastPosition.forecastSurplus.toLocaleString()}.`
          : `Payment from ${source} confirmed. Shortfall remains: ${curr} ${Math.abs(updatedForecast.forecastPosition.forecastBalance).toLocaleString()}.`,
        level: canPay ? 'success' : 'warning',
      };
    }

    case 'funding_evidence_uploaded':
      return {
        title: 'Payment evidence uploaded',
        description: `Evidence for ${source} increases forecast confidence. Review the forecast position.`,
        level: 'success',
      };

    case 'revenue_cleared':
      return {
        title: `Revenue cleared: ${source}`,
        description: `${curr} ${(event.amount ?? 0).toLocaleString()} from ${source} is in the account. Obligations can now be funded.`,
        level: 'success',
      };

    case 'settlement_ready':
      return {
        title: 'Ready for settlement',
        description: 'All obligations are funded. Review commitments and release payments.',
        level: 'success',
      };

    case 'payment_released':
      return {
        title: `Payment released to ${actor}`,
        description: `${actor} has been paid${amountStr}. Their commercial obligation is discharged.`,
        level: 'success',
      };

    case 'settlement_completed':
      return {
        title: 'Settlement complete',
        description: `${agreementName} is commercially operational. All participants have been paid.`,
        level: 'success',
      };
  }
}

/* ─── Batch processing ───────────────────────────────────────────────────────── */

/**
 * Process a sequence of commercial events, threading state through each one.
 * Use for replaying the full commercial lifecycle (e.g. James demo scenario).
 *
 * Returns the output of each event in order, plus the final state.
 */
export function processCommercialEventSequence(
  events: CommercialEvent[],
  initialContext: CommercialEventContext
): {
  outputs: CommercialEventOutput[];
  finalForecast: CommercialForecastResult;
  finalTimeline: CommercialTimelineEvent[];
  notifications: CommercialNotification[];
} {
  let context = initialContext;
  const outputs: CommercialEventOutput[] = [];

  for (const event of events) {
    const output = processCommercialEvent(event, context);
    outputs.push(output);

    // Thread state forward: each event's output becomes the next event's context
    context = {
      ...context,
      forecastInput: applyForecastMutation(context.forecastInput, output.forecastMutation),
      existingTimeline: output.updatedTimeline,
    };
  }

  const lastOutput = outputs[outputs.length - 1];
  return {
    outputs,
    finalForecast: lastOutput?.updatedForecast ?? deriveCommercialForecast(initialContext.forecastInput),
    finalTimeline: lastOutput?.updatedTimeline ?? initialContext.existingTimeline,
    notifications: outputs.map((o) => o.notification),
  };
}
