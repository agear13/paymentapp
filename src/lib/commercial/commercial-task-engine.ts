/**
 * Commercial Task Engine
 *
 * The canonical engine that converts commercial state into operational tasks.
 *
 * Design rules:
 *   - `deriveCommercialTasks()` is the only permitted task generation function.
 *     No component or page may generate tasks independently.
 *   - Pure function — deterministic, no network calls, no side effects.
 *   - Task IDs are deterministic (participantId + taskType) to prevent duplicates.
 *   - One event creates one task. No duplicate task generation.
 *   - Operator language only. No technical jargon.
 *
 * Architecture:
 *   Commercial State
 *       ↓
 *   deriveCommercialTasks()
 *       ↓
 *   Today  |  This Week  |  Waiting  |  Completed
 *   Dashboard Queue  ·  Provvy Queue  ·  Timeline
 */

import type { InvoiceLifecycleState } from '@/lib/commercial/invoice-lifecycle';
import { isInvoiceAtOrAfter } from '@/lib/commercial/invoice-lifecycle';

/* ─── Task types ─────────────────────────────────────────────────────────── */

export const TASK_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = ['pending', 'in_progress', 'waiting', 'completed', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_GROUPS = ['today', 'this_week', 'waiting', 'completed'] as const;
export type TaskGroup = (typeof TASK_GROUPS)[number];

export type TaskType =
  | 'configure_earnings'
  | 'generate_agreement'
  | 'send_approval'
  | 'chase_approval'
  | 'connect_payment_provider'
  | 'enable_revenue_collection'
  | 'request_invoice'
  | 'chase_invoice'
  | 'review_invoice'
  | 'verify_bank_details'
  | 'verify_tax_details'
  | 'export_to_xero'
  | 'upload_funding_evidence'
  | 'release_payment'
  | 'archive_agreement'
  | 'resolve_invoice_discrepancy'
  | 'add_missing_participant_details';

/* ─── Commercial Operational Risk ────────────────────────────────────────── */

export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';

export type CommercialOperationalRisk = {
  /** Stable ID — deterministic, based on source. */
  id: string;
  /** Operator-facing title. */
  title: string;
  /** One sentence explaining what's at risk. */
  explanation: string;
  /** Commercial consequence if unresolved. */
  consequence: string;
  /** Exactly one action. */
  action: string;
  severity: RiskSeverity;
  /** ISO date this risk was detected. */
  detectedAt: string;
  /** Participant this risk relates to, if applicable. */
  participantId?: string;
  participantName?: string;
  /** ISO date this risk becomes critical (deadline). */
  escalatesAt?: string | null;
};

/* ─── Commercial Task ────────────────────────────────────────────────────── */

export type CommercialTask = {
  /**
   * Deterministic ID: `${participantId ?? 'workspace'}:${taskType}`.
   * Prevents duplicate tasks for the same participant + type.
   */
  id: string;
  taskType: TaskType;
  title: string;
  description: string;
  /** Why this task matters commercially. */
  commercialImpact: string;
  priority: TaskPriority;
  status: TaskStatus;
  group: TaskGroup;
  /** ISO date string. null = no deadline. */
  dueDate: string | null;
  /** Days until due (negative = overdue). null when no dueDate. */
  daysUntilDue: number | null;
  /** True when dueDate is in the past. */
  isOverdue: boolean;
  /** Primary CTA label. */
  action: string;
  /** Navigation destination for this action. */
  actionHref?: string;
  /** Participant this task belongs to. */
  participantId?: string;
  participantName?: string;
  /** ISO timestamp when this task was created. */
  createdAt: string;
  /** ISO timestamp when completed. */
  completedAt?: string | null;
};

/* ─── Input types ────────────────────────────────────────────────────────── */

export type ParticipantTaskContext = {
  participant: {
    id: string;
    name: string;
    role: string;
    email?: string | null;
  };
  agreement: {
    approved: boolean;
    agreementGenerated: boolean;
    sentAt?: string | null;
    earningsConfigured?: boolean;
  };
  invoice: {
    state: InvoiceLifecycleState;
    requestedAt?: string | null;
    receivedAt?: string | null;
    /** ISO due date for the invoice (as agreed with participant). */
    invoiceDueDate?: string | null;
    invoiceAmount?: number | null;
    obligationAmount?: number | null;
  };
  taxDetails: {
    abn?: string | null;
    gstRegistered?: boolean | null;
    abnValid?: boolean;
  };
  bankDetails: {
    bsb?: string | null;
    accountNumber?: string | null;
    accountName?: string | null;
    complete?: boolean;
  };
  funding: {
    status: 'unfunded' | 'partially_funded' | 'funded' | 'cleared' | 'paid';
  };
  accounting: {
    xeroStatus: 'not_required' | 'pending' | 'exported';
  };
  obligation: {
    amount: number;
    currency: string;
    type: 'fixed_fee' | 'revenue_share' | 'conditional' | 'unpaid_internal';
  };
};

export type CommercialTaskInput = {
  /** Project / agreement identifier. */
  projectId: string;
  /** Current ISO date string. Defaults to today if omitted. */
  currentDate?: string;
  /** All participants in this agreement. */
  participants: ParticipantTaskContext[];
  /** Is the payment provider (Stripe) connected? */
  paymentProviderConnected?: boolean;
  /** Is customer revenue collection enabled? */
  revenueCollectionEnabled?: boolean;
  /** Overall funding status for the project. */
  projectFundingStatus?: 'unfunded' | 'partially_funded' | 'funded';
  /** Default invoice due days from request (used when no specific due date). */
  invoiceDueDays?: number;
};

/* ─── Output types ───────────────────────────────────────────────────────── */

export type CommercialTaskResult = {
  /** All tasks (every status). */
  tasks: CommercialTask[];
  /** Tasks due today. */
  todaysTasks: CommercialTask[];
  /** Tasks due this week (excluding today). */
  thisWeekTasks: CommercialTask[];
  /** Tasks waiting on external parties (participants, banks, govt). */
  waitingTasks: CommercialTask[];
  /** Completed or cancelled tasks. */
  completedTasks: CommercialTask[];
  /** Number of critical-priority tasks. */
  criticalCount: number;
  /** Number of overdue tasks. */
  overdueCount: number;
  /** The single most urgent task. */
  primaryTask: CommercialTask | null;
  /** Risks detected from commercial state. */
  risks: CommercialOperationalRisk[];
  /** Provvy-ready narrative answering "What should I do now?" */
  provvyNarrative: string;
  /** Total active (non-completed) task count. */
  activeCount: number;
};

/* ─── Core engine ─────────────────────────────────────────────────────────── */

/**
 * The canonical Commercial Task Engine.
 *
 * PURE FUNCTION — no side effects, no network calls, deterministic.
 *
 * Converts commercial state into operational tasks.
 * All components must consume this function; no independent task generation.
 */
export function deriveCommercialTasks(input: CommercialTaskInput): CommercialTaskResult {
  const today = input.currentDate ?? new Date().toISOString().slice(0, 10);
  const invoiceDueDays = input.invoiceDueDays ?? 7;

  const allTasks: CommercialTask[] = [];
  const risks: CommercialOperationalRisk[] = [];

  /* ── 1. Per-participant tasks ── */
  for (const ctx of input.participants) {
    const participantTasks = buildParticipantTasks(ctx, today, invoiceDueDays);
    allTasks.push(...participantTasks.tasks);
    risks.push(...participantTasks.risks);
  }

  /* ── 2. Workspace-level tasks ── */
  const workspaceTasks = buildWorkspaceTasks(input, today);
  allTasks.push(...workspaceTasks.tasks);
  risks.push(...workspaceTasks.risks);

  /* ── 3. Deduplicate by ID (keep first occurrence) ── */
  const seen = new Set<string>();
  const deduplicated = allTasks.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  /* ── 4. Sort by priority + dueDate ── */
  const sorted = deduplicated.sort(compareTasks);

  /* ── 5. Group ── */
  const todaysTasks = sorted.filter((t) => t.group === 'today' && t.status !== 'completed');
  const thisWeekTasks = sorted.filter((t) => t.group === 'this_week' && t.status !== 'completed');
  const waitingTasks = sorted.filter((t) => t.group === 'waiting');
  const completedTasks = sorted.filter((t) => t.group === 'completed' || t.status === 'completed');
  const activeCount = sorted.filter(
    (t) => t.status !== 'completed' && t.status !== 'cancelled'
  ).length;

  /* ── 6. Primary task ── */
  const primaryTask =
    todaysTasks[0] ??
    thisWeekTasks[0] ??
    sorted.find((t) => t.status !== 'completed' && t.status !== 'cancelled') ??
    null;

  /* ── 7. Counts ── */
  const criticalCount = sorted.filter((t) => t.priority === 'critical' && t.status !== 'completed').length;
  const overdueCount = sorted.filter((t) => t.isOverdue && t.status !== 'completed').length;

  /* ── 8. Deduplicate risks ── */
  const seenRisks = new Set<string>();
  const uniqueRisks = risks.filter((r) => {
    if (seenRisks.has(r.id)) return false;
    seenRisks.add(r.id);
    return true;
  });

  /* ── 9. Provvy narrative ── */
  const provvyNarrative = buildOperationsNarrative(sorted, uniqueRisks, primaryTask);

  return {
    tasks: sorted,
    todaysTasks,
    thisWeekTasks,
    waitingTasks,
    completedTasks,
    criticalCount,
    overdueCount,
    primaryTask,
    risks: uniqueRisks,
    provvyNarrative,
    activeCount,
  };
}

/* ─── Per-participant task builder ───────────────────────────────────────── */

type TaskBundle = { tasks: CommercialTask[]; risks: CommercialOperationalRisk[] };

function buildParticipantTasks(
  ctx: ParticipantTaskContext,
  today: string,
  invoiceDueDays: number
): TaskBundle {
  const tasks: CommercialTask[] = [];
  const risks: CommercialOperationalRisk[] = [];
  const { participant, agreement, invoice, taxDetails, bankDetails, funding, accounting, obligation } = ctx;

  /* ── Earnings not configured ── */
  if (!agreement.earningsConfigured && !agreement.agreementGenerated) {
    tasks.push(makeTask({
      id: `${participant.id}:configure_earnings`,
      taskType: 'configure_earnings',
      title: `Configure ${participant.name}'s earnings`,
      description: `Set up the commercial terms for ${participant.name} before an agreement can be generated.`,
      commercialImpact: 'Agreement cannot be generated until earnings are configured.',
      priority: 'high',
      status: 'pending',
      dueDate: addDays(today, 2),
      today,
      action: 'Configure earnings',
      participantId: participant.id,
      participantName: participant.name,
    }));
  }

  /* ── Agreement not generated ── */
  if (agreement.earningsConfigured && !agreement.agreementGenerated) {
    tasks.push(makeTask({
      id: `${participant.id}:generate_agreement`,
      taskType: 'generate_agreement',
      title: `Generate ${participant.name}'s agreement`,
      description: `Earnings are configured. Generate the commercial agreement document for ${participant.name}.`,
      commercialImpact: 'Participant cannot approve until an agreement document is available.',
      priority: 'high',
      status: 'pending',
      dueDate: addDays(today, 1),
      today,
      action: 'Generate agreement',
      participantId: participant.id,
      participantName: participant.name,
    }));
  }

  /* ── Agreement not sent ── */
  if (agreement.agreementGenerated && !agreement.sentAt && !agreement.approved) {
    tasks.push(makeTask({
      id: `${participant.id}:send_approval`,
      taskType: 'send_approval',
      title: `Send approval to ${participant.name}`,
      description: `The agreement is ready. Send it to ${participant.name} for approval.`,
      commercialImpact: 'Revenue collection and settlement cannot proceed without participant approval.',
      priority: 'high',
      status: 'pending',
      dueDate: addDays(today, 1),
      today,
      action: 'Send for approval',
      participantId: participant.id,
      participantName: participant.name,
    }));
  }

  /* ── Awaiting approval (sent but not approved) ── */
  if (agreement.agreementGenerated && agreement.sentAt && !agreement.approved) {
    const daysSinceSent = daysDiff(today, agreement.sentAt);
    const overdue = daysSinceSent > 5;

    if (overdue) {
      // Chase
      tasks.push(makeTask({
        id: `${participant.id}:chase_approval`,
        taskType: 'chase_approval',
        title: `Follow up with ${participant.name} on approval`,
        description: `Approval was sent ${daysSinceSent} days ago and has not been received.`,
        commercialImpact: 'Settlement cannot begin until this participant approves.',
        priority: 'high',
        status: 'waiting',
        dueDate: addDays(agreement.sentAt, 7),
        today,
        action: 'Send reminder',
        participantId: participant.id,
        participantName: participant.name,
      }));

      risks.push({
        id: `${participant.id}:approval_overdue`,
        title: `${participant.name}'s approval is overdue`,
        explanation: `Approval was sent ${daysSinceSent} days ago with no response.`,
        consequence: 'Settlement preparation is blocked until this participant approves.',
        action: `Send ${participant.name} a reminder to approve their agreement.`,
        severity: 'high',
        detectedAt: today,
        participantId: participant.id,
        participantName: participant.name,
      });
    } else {
      tasks.push(makeTask({
        id: `${participant.id}:send_approval`,
        taskType: 'send_approval',
        title: `Waiting for ${participant.name} to approve`,
        description: `Approval sent. Waiting for ${participant.name}'s response.`,
        commercialImpact: 'Settlement cannot begin until this participant approves.',
        priority: 'medium',
        status: 'waiting',
        dueDate: addDays(agreement.sentAt!, 7),
        today,
        action: 'Send reminder',
        participantId: participant.id,
        participantName: participant.name,
      }));
    }
  }

  /* ── Missing bank details (approved but no bank details) ── */
  if (agreement.approved && !bankDetails.complete) {
    tasks.push(makeTask({
      id: `${participant.id}:verify_bank_details`,
      taskType: 'verify_bank_details',
      title: `Get bank details from ${participant.name}`,
      description: `${participant.name} has approved their agreement but bank account details are missing.`,
      commercialImpact: 'Payment cannot be transferred without valid bank details.',
      priority: 'high',
      status: 'pending',
      dueDate: addDays(today, 3),
      today,
      action: 'Request bank details',
      participantId: participant.id,
      participantName: participant.name,
    }));

    risks.push({
      id: `${participant.id}:missing_bank_details`,
      title: `${participant.name}'s bank details are missing`,
      explanation: 'Bank account details have not been provided for this participant.',
      consequence: 'Payment cannot be released without valid bank details.',
      action: `Request bank account details from ${participant.name}.`,
      severity: 'high',
      detectedAt: today,
      participantId: participant.id,
      participantName: participant.name,
    });
  }

  /* ── Missing tax details (approved but no ABN) ── */
  if (agreement.approved && !taxDetails.abn) {
    tasks.push(makeTask({
      id: `${participant.id}:verify_tax_details`,
      taskType: 'verify_tax_details',
      title: `Collect tax details from ${participant.name}`,
      description: `ABN or GST registration status has not been confirmed for ${participant.name}.`,
      commercialImpact: 'Payment may require tax withholding without a valid ABN.',
      priority: 'medium',
      status: 'pending',
      dueDate: addDays(today, 5),
      today,
      action: 'Request tax details',
      participantId: participant.id,
      participantName: participant.name,
    }));
  }

  /* ── Invoice tasks (only for participants requiring an invoice) ── */
  if (obligation.type !== 'unpaid_internal') {
    const invoiceState = invoice.state;

    if (agreement.approved && invoiceState === 'required') {
      tasks.push(makeTask({
        id: `${participant.id}:request_invoice`,
        taskType: 'request_invoice',
        title: `Request invoice from ${participant.name}`,
        description: `${participant.name} has approved their agreement. Request their invoice to proceed with settlement.`,
        commercialImpact: 'Settlement cannot proceed without an approved invoice.',
        priority: 'high',
        status: 'pending',
        dueDate: addDays(today, 2),
        today,
        action: 'Request invoice',
        participantId: participant.id,
        participantName: participant.name,
      }));
    }

    if (invoiceState === 'requested') {
      const requestedAt = invoice.requestedAt;
      const dueDateStr = invoice.invoiceDueDate ?? (requestedAt ? addDays(requestedAt, invoiceDueDays) : null);
      const isOverdue = dueDateStr ? today > dueDateStr : false;

      if (isOverdue) {
        tasks.push(makeTask({
          id: `${participant.id}:chase_invoice`,
          taskType: 'chase_invoice',
          title: `${participant.name}'s invoice is overdue`,
          description: `Invoice was requested but has not been received. It was due ${formatDue(today, dueDateStr)}.`,
          commercialImpact: 'Settlement is blocked until the invoice is received.',
          priority: 'critical',
          status: 'waiting',
          dueDate: dueDateStr,
          today,
          action: 'Send invoice reminder',
          participantId: participant.id,
          participantName: participant.name,
        }));

        risks.push({
          id: `${participant.id}:invoice_overdue`,
          title: `${participant.name}'s invoice is overdue`,
          explanation: `Invoice was requested but has not arrived by the agreed due date.`,
          consequence: 'Settlement is blocked until the invoice is received and verified.',
          action: `Send ${participant.name} a reminder to submit their invoice immediately.`,
          severity: 'critical',
          detectedAt: today,
          participantId: participant.id,
          participantName: participant.name,
        });
      } else {
        tasks.push(makeTask({
          id: `${participant.id}:request_invoice`,
          taskType: 'chase_invoice',
          title: `Waiting for ${participant.name}'s invoice`,
          description: 'Invoice has been requested. Waiting for the participant to submit.',
          commercialImpact: 'Settlement cannot proceed until the invoice is received.',
          priority: 'medium',
          status: 'waiting',
          dueDate: dueDateStr,
          today,
          action: 'Send reminder',
          participantId: participant.id,
          participantName: participant.name,
        }));
      }
    }

    if (invoiceState === 'received') {
      tasks.push(makeTask({
        id: `${participant.id}:review_invoice`,
        taskType: 'review_invoice',
        title: `Review ${participant.name}'s invoice`,
        description: `Invoice received from ${participant.name}. Verify the amount and details before proceeding.`,
        commercialImpact: 'Payment cannot be released until the invoice is verified.',
        priority: 'high',
        status: 'pending',
        dueDate: addDays(today, 1),
        today,
        action: 'Review invoice',
        participantId: participant.id,
        participantName: participant.name,
      }));

      /* Check for invoice/obligation mismatch */
      if (
        invoice.invoiceAmount != null &&
        invoice.obligationAmount != null &&
        Math.abs(invoice.invoiceAmount - invoice.obligationAmount) / invoice.obligationAmount > 0.01
      ) {
        risks.push({
          id: `${participant.id}:invoice_mismatch`,
          title: `${participant.name}'s invoice amount doesn't match agreement`,
          explanation: `Invoice is for ${formatCurrency(invoice.invoiceAmount, obligation.currency)}, but the agreed obligation is ${formatCurrency(invoice.obligationAmount, obligation.currency)}.`,
          consequence: 'An unresolved discrepancy may delay payment and create accounting issues.',
          action: `Review the invoice with ${participant.name} and resolve the discrepancy.`,
          severity: 'critical',
          detectedAt: today,
          participantId: participant.id,
          participantName: participant.name,
        });
      }
    }

    if (isInvoiceAtOrAfter(invoiceState, 'verified') && accounting.xeroStatus === 'not_required') {
      // Invoice verified and Xero not needed — funding is the next step (handled in funding block)
    }

    if (isInvoiceAtOrAfter(invoiceState, 'verified') && accounting.xeroStatus === 'pending') {
      tasks.push(makeTask({
        id: `${participant.id}:export_to_xero`,
        taskType: 'export_to_xero',
        title: `Export ${participant.name}'s invoice to Xero`,
        description: `Invoice has been verified and is ready for accounting export.`,
        commercialImpact: 'Payment cannot be released until the invoice is recorded in your accounting system.',
        priority: 'high',
        status: 'pending',
        dueDate: addDays(today, 1),
        today,
        action: 'Export to Xero',
        participantId: participant.id,
        participantName: participant.name,
      }));
    }
  }

  /* ── Funding tasks ── */
  if (agreement.approved && (funding.status === 'unfunded' || funding.status === 'partially_funded')) {
    const isPartial = funding.status === 'partially_funded';
    tasks.push(makeTask({
      id: `${participant.id}:upload_funding_evidence`,
      taskType: 'upload_funding_evidence',
      title: isPartial
        ? `Confirm remaining funding for ${participant.name}`
        : `Confirm funding for ${participant.name}`,
      description: isPartial
        ? `Funding is partially confirmed. Upload additional evidence to confirm full funding.`
        : `Funding has not been confirmed for ${participant.name}'s payment.`,
      commercialImpact: 'Payment cannot be released without confirmed funding.',
      priority: isPartial ? 'high' : 'critical',
      status: 'pending',
      dueDate: addDays(today, 3),
      today,
      action: 'Upload funding evidence',
      participantId: participant.id,
      participantName: participant.name,
    }));

    if (!isPartial) {
      risks.push({
        id: `${participant.id}:funding_not_confirmed`,
        title: `Funding not confirmed for ${participant.name}`,
        explanation: `No payment evidence has been uploaded for this participant's obligation.`,
        consequence: 'Payment cannot be released without confirmed funding.',
        action: 'Upload payment evidence or funding confirmation documents.',
        severity: 'critical',
        detectedAt: today,
        participantId: participant.id,
        participantName: participant.name,
      });
    }
  }

  /* ── Release payment ── */
  const invoiceReady =
    obligation.type === 'unpaid_internal' ||
    isInvoiceAtOrAfter(invoice.state, 'verified');
  const fundingReady = funding.status === 'funded' || funding.status === 'cleared' || funding.status === 'paid';
  const xeroReady =
    accounting.xeroStatus === 'exported' || accounting.xeroStatus === 'not_required';
  const taxReady = Boolean(taxDetails.abn) && Boolean(taxDetails.abnValid);
  const bankReady = Boolean(bankDetails.complete);

  if (
    agreement.approved &&
    invoiceReady &&
    fundingReady &&
    xeroReady &&
    taxReady &&
    bankReady &&
    funding.status !== 'paid'
  ) {
    tasks.push(makeTask({
      id: `${participant.id}:release_payment`,
      taskType: 'release_payment',
      title: `Release payment to ${participant.name}`,
      description: `All settlement requirements are met. ${formatCurrency(obligation.amount, obligation.currency)} is ready to be paid to ${participant.name}.`,
      commercialImpact: `${participant.name} will receive ${formatCurrency(obligation.amount, obligation.currency)}.`,
      priority: 'high',
      status: 'pending',
      dueDate: addDays(today, 1),
      today,
      action: 'Release payment',
      participantId: participant.id,
      participantName: participant.name,
    }));
  }

  /* ── Paid — mark as completed ── */
  if (funding.status === 'paid') {
    tasks.push(makeTask({
      id: `${participant.id}:release_payment`,
      taskType: 'release_payment',
      title: `Payment released to ${participant.name}`,
      description: `${formatCurrency(obligation.amount, obligation.currency)} has been paid to ${participant.name}.`,
      commercialImpact: `Settlement complete for ${participant.name}.`,
      priority: 'low',
      status: 'completed',
      dueDate: null,
      today,
      action: 'View payment',
      participantId: participant.id,
      participantName: participant.name,
    }));
  }

  return { tasks, risks };
}

/* ─── Workspace-level tasks ───────────────────────────────────────────────── */

function buildWorkspaceTasks(input: CommercialTaskInput, today: string): TaskBundle {
  const tasks: CommercialTask[] = [];
  const risks: CommercialOperationalRisk[] = [];

  const allApproved =
    input.participants.length > 0 &&
    input.participants.every((p) => p.agreement.approved);

  /* ── Connect payment provider ── */
  if (allApproved && !input.paymentProviderConnected) {
    tasks.push(makeTask({
      id: 'workspace:connect_payment_provider',
      taskType: 'connect_payment_provider',
      title: 'Connect payment provider',
      description: 'All participants have approved their agreements. Connect Stripe to start collecting customer payments.',
      commercialImpact: 'Revenue collection cannot begin until a payment provider is connected.',
      priority: 'critical',
      status: 'pending',
      dueDate: addDays(today, 1),
      today,
      action: 'Connect Stripe',
    }));

    risks.push({
      id: 'workspace:payment_provider_missing',
      title: 'Payment provider not connected',
      explanation: 'All participants have approved but Stripe has not been connected.',
      consequence: 'Customers cannot pay until a payment provider is connected.',
      action: 'Connect Stripe to start collecting customer payments.',
      severity: 'critical',
      detectedAt: today,
    });
  }

  /* ── Enable revenue collection ── */
  if (input.paymentProviderConnected && !input.revenueCollectionEnabled) {
    tasks.push(makeTask({
      id: 'workspace:enable_revenue_collection',
      taskType: 'enable_revenue_collection',
      title: 'Enable revenue collection',
      description: 'Payment provider is connected. Enable customer-facing payment links to start collecting revenue.',
      commercialImpact: 'No revenue will be collected until payment links are enabled.',
      priority: 'high',
      status: 'pending',
      dueDate: addDays(today, 1),
      today,
      action: 'Enable payment links',
    }));
  }

  /* ── Check if all paid — archive ── */
  const allPaid = input.participants.every((p) => p.funding.status === 'paid');
  if (allPaid && input.participants.length > 0) {
    tasks.push(makeTask({
      id: 'workspace:archive_agreement',
      taskType: 'archive_agreement',
      title: 'Archive commercial relationship',
      description: 'All participants have been paid. Archive this agreement to complete the commercial lifecycle.',
      commercialImpact: 'Archiving finalises the commercial record and closes the settlement cycle.',
      priority: 'low',
      status: 'pending',
      dueDate: addDays(today, 7),
      today,
      action: 'Archive agreement',
    }));
  }

  return { tasks, risks };
}

/* ─── Task factory ────────────────────────────────────────────────────────── */

type MakeTaskInput = {
  id: string;
  taskType: TaskType;
  title: string;
  description: string;
  commercialImpact: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  today: string;
  action: string;
  actionHref?: string;
  participantId?: string;
  participantName?: string;
};

function makeTask(opts: MakeTaskInput): CommercialTask {
  const { dueDate, today } = opts;

  let daysUntilDue: number | null = null;
  let isOverdue = false;

  if (dueDate) {
    daysUntilDue = daysDiff(dueDate, today);
    isOverdue = daysUntilDue < 0 && opts.status !== 'completed';
  }

  const group = deriveGroup(opts.status, dueDate, today, isOverdue);

  return {
    id: opts.id,
    taskType: opts.taskType,
    title: opts.title,
    description: opts.description,
    commercialImpact: opts.commercialImpact,
    priority: opts.priority,
    status: opts.status,
    group,
    dueDate,
    daysUntilDue,
    isOverdue,
    action: opts.action,
    actionHref: opts.actionHref,
    participantId: opts.participantId,
    participantName: opts.participantName,
    createdAt: today,
    completedAt: opts.status === 'completed' ? today : null,
  };
}

function deriveGroup(
  status: TaskStatus,
  dueDate: string | null,
  today: string,
  isOverdue: boolean
): TaskGroup {
  if (status === 'completed' || status === 'cancelled') return 'completed';
  // Overdue waiting tasks surface in "today" — they need immediate attention
  if (status === 'waiting' && isOverdue) return 'today';
  if (status === 'waiting') return 'waiting';
  if (!dueDate) return 'this_week';

  if (isOverdue || dueDate === today) return 'today';

  const diff = daysDiff(dueDate, today);
  if (diff <= 7) return 'this_week';
  return 'this_week';
}

/* ─── Task sorting ────────────────────────────────────────────────────────── */

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function compareTasks(a: CommercialTask, b: CommercialTask): number {
  // Completed to end
  if (a.status === 'completed' && b.status !== 'completed') return 1;
  if (b.status === 'completed' && a.status !== 'completed') return -1;

  // Overdue first
  if (a.isOverdue && !b.isOverdue) return -1;
  if (b.isOverdue && !a.isOverdue) return 1;

  // Priority
  const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (pDiff !== 0) return pDiff;

  // Due date (earlier first)
  if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;

  return 0;
}

/* ─── Provvy narrative ────────────────────────────────────────────────────── */

function buildOperationsNarrative(
  tasks: CommercialTask[],
  risks: CommercialOperationalRisk[],
  primaryTask: CommercialTask | null
): string {
  if (tasks.length === 0) {
    return 'No active commercial tasks. Everything is up to date.';
  }

  const activeTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
  const overdueItems = tasks.filter((t) => t.isOverdue);
  const criticalRisks = risks.filter((r) => r.severity === 'critical');

  const lines: string[] = [];

  if (overdueItems.length > 0) {
    lines.push(
      `${overdueItems.length} task${overdueItems.length > 1 ? 's are' : ' is'} overdue and need${overdueItems.length === 1 ? 's' : ''} immediate attention.`
    );
  }

  if (criticalRisks.length > 0) {
    lines.push(
      `${criticalRisks.length} critical risk${criticalRisks.length > 1 ? 's' : ''} detected: ${criticalRisks.map((r) => r.title.toLowerCase()).join(', ')}.`
    );
  }

  if (activeTasks.length > 0) {
    lines.push(`${activeTasks.length} task${activeTasks.length !== 1 ? 's' : ''} remaining.`);
  }

  if (primaryTask) {
    lines.push('');
    lines.push(`Recommended next action: ${primaryTask.action}.`);
    lines.push(primaryTask.commercialImpact);
  }

  return lines.join('\n');
}

/* ─── Date utilities ──────────────────────────────────────────────────────── */

/** Add N days to an ISO date string. Returns ISO date string. */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Days from dateA to dateB (negative = dateA is in the future relative to dateB).
 * daysDiff('2024-06-10', '2024-06-08') → -2 (dateA is 2 days after dateB)
 * daysDiff('2024-06-08', '2024-06-10') → 2 (dateA is 2 days before dateB)
 */
export function daysDiff(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

function formatDue(today: string, dueDate: string | null): string {
  if (!dueDate) return 'the agreed date';
  const diff = daysDiff(today, dueDate);
  if (diff === 0) return 'today';
  if (diff > 0) return `${diff} day${diff > 1 ? 's' : ''} ago`;
  return `in ${Math.abs(diff)} day${Math.abs(diff) > 1 ? 's' : ''}`;
}

function formatCurrency(amount: number, currency = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
