/**
 * Workspace Settlement view-model.
 *
 * Maps existing pilot obligations, attribution earnings, and payout batches
 * into canonical operator money states. Does not recalculate amounts or invent
 * commercial sources.
 *
 * Canonical states:
 * Earned → Owed → Pending | Requires action | Ready for payout → Released → Paid
 *
 * Recovery (existing payout domain only — PayoutStatus is DRAFT | SUBMITTED |
 * PAID | FAILED; PayoutBatchStatus is DRAFT | SUBMITTED | COMPLETED):
 * - A removed draft release (no remaining payout rows) must not consume Ready.
 * - FAILED never overlays as Paid or Released; the obligation returns to its
 *   stored status (typically Ready) so it can be re-released. mark-failed
 *   already unassigns ledger lines for re-batching.
 * - There is no persisted CANCELLED / RETURNED payout status and no cancel
 *   write-path. Do not invent those labels.
 * - Pilot REVERSED is a deal-level obligation status, not a payout return.
 *
 * Attribution-as-owed rule (Scenario A / Jordan):
 * Unpaid `commission_obligation_items` (POSTED) are immediately owed Pending
 * obligations. The commission engine posts items when attribution is recorded
 * against a paid invoice, so outstanding attribution is already a payment
 * obligation — not a pre-obligation earning. Do not introduce an
 * "earned but not owed" workspace state unless the engine gains a status that
 * means earned-without-posting. Revenue-referred activity with no commission
 * items yet is already earned $0 / not owed.
 */

import {
  getObligationBlockingIssue,
  getObligationNextAction,
} from '@/lib/payouts/obligation-status-labels';
import { formatCurrency } from '@/lib/formatters/format-currency';

export const SETTLEMENT_SOURCE_FILTERS = [
  'all',
  'referral-management',
  'revenue-sharing',
  'agreements',
  'other',
] as const;

export type SettlementSourceFilter = (typeof SETTLEMENT_SOURCE_FILTERS)[number];
export type SettlementSource = Exclude<SettlementSourceFilter, 'all'>;

export const SETTLEMENT_STATUS_FILTERS = [
  'all',
  'pending',
  'requires_action',
  'ready',
  'released',
  'paid',
] as const;

export type SettlementStatusFilter = (typeof SETTLEMENT_STATUS_FILTERS)[number];
export type SettlementWorkspaceStatus = Exclude<SettlementStatusFilter, 'all'>;

export type SettlementObligationKind = 'pilot' | 'attribution';

export type PilotObligationApiRow = {
  id: string;
  deal_id?: string | null;
  participant_id?: string | null;
  obligation_type?: string | null;
  status?: string | null;
  amount_owed?: number | null;
  currency?: string | null;
  beneficiary_name?: string | null;
  deal?: { id?: string | null; name?: string | null; partner?: string | null } | null;
  participant?: {
    id?: string | null;
    name?: string | null;
    approvalStatus?: string | null;
    onboardingStatus?: string | null;
  } | null;
};

export type AttributionEarningsApiRow = {
  participantId: string;
  participantName: string;
  dealId: string | null;
  dealName: string | null;
  outstandingAmount: number;
  paidAmount: number;
  currency: string;
  items: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    createdAt?: string;
    shortCode?: string | null;
    invoiceReference?: string | null;
    referralCode?: string | null;
  }>;
};

export type PayoutBatchApiRow = {
  id: string;
  currency: string;
  status: string;
  payoutCount: number;
  totalAmount: number;
  createdAt?: string | Date | null;
  submittedAt?: string | Date | null;
  completedAt?: string | Date | null;
  payouts?: Array<{
    id?: string;
    status?: string;
    participantId?: string;
    user_id?: string;
  }>;
};

export type SettlementPayoutReceipt = {
  participantId: string;
  status: string;
};

export const SETTLEMENT_IN_FLIGHT_PAYOUT_STATUSES = ['DRAFT', 'SUBMITTED', 'PROCESSING'] as const;

export type SettlementObligationRow = {
  id: string;
  kind: SettlementObligationKind;
  sourceId: string;
  source: SettlementSource;
  sourceLabel: string;
  relationshipId: string | null;
  relationshipLabel: string;
  participantId: string | null;
  participantName: string;
  amountOwed: number;
  currency: string;
  nextAction: string;
  reason: string | null;
  workspaceStatus: SettlementWorkspaceStatus;
  workspaceStatusLabel: string;
  rawStatus: string;
  obligationType: string;
  paidAmount: number;
};

export type SettlementEarningRow = {
  id: string;
  participantId: string;
  participantName: string;
  source: SettlementSource;
  sourceLabel: string;
  relationshipId: string | null;
  relationshipLabel: string;
  earned: number;
  unpaid: number;
  paid: number;
  currency: string;
  settlementStatus: SettlementWorkspaceStatus | null;
  settlementStatusLabel: string;
  nextAction: string | null;
  itemCount: number;
};

export type SettlementReleasePaymentState = 'draft' | 'released' | 'paid' | 'failed';

export type SettlementReleaseRow = {
  id: string;
  status: string;
  statusLabel: string;
  paymentState: SettlementReleasePaymentState;
  paymentNote: string | null;
  label: string;
  payoutCount: number;
  paidPayoutCount: number;
  totalAmount: number;
  currency: string;
  createdAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  cancellable: boolean;
};

export type SettlementSummary = {
  currency: string;
  owed: number;
  pending: number;
  requiresAction: number;
  readyForPayout: number;
  released: number;
  paid: number;
  pendingCount: number;
  requiresActionCount: number;
  requiresActionParticipants: number;
  readyCount: number;
};

export type SettlementAttentionItem = {
  issue: string;
  count: number;
  amount: number;
  currency: string;
  firstObligationId: string;
  participantName: string | null;
};

export type SettlementCommercialMovement = {
  periodLabel: string;
  currency: string;
  earned: number;
  released: number;
  paidToDate: number;
  paidPeriodSupported: boolean;
};

export const SETTLEMENT_SOURCE_LABELS: Record<SettlementSource, string> = {
  'referral-management': 'Referral Management',
  'revenue-sharing': 'Revenue Sharing',
  agreements: 'Agreements',
  other: 'Other',
};

export const SETTLEMENT_STATUS_LABELS: Record<SettlementWorkspaceStatus, string> = {
  pending: 'Pending',
  requires_action: 'Requires action',
  ready: 'Ready for payout',
  released: 'Released',
  paid: 'Paid',
};

const STATUS_PRIORITY: SettlementWorkspaceStatus[] = [
  'requires_action',
  'ready',
  'pending',
  'released',
  'paid',
];

const KNOWN_ACTION_STATUSES = new Set([
  'PENDING_APPROVAL',
  'UNFUNDED',
  'PARTIALLY_FUNDED',
  'DRAFT',
  'REJECTED',
  'REVERSED',
]);

export function attributionObligationId(participantId: string): string {
  return `attribution:${participantId}`;
}

export function parseSettlementObligationId(id: string): {
  kind: SettlementObligationKind;
  sourceId: string;
} {
  if (id.startsWith('attribution:')) {
    return { kind: 'attribution', sourceId: id.slice('attribution:'.length) };
  }
  return { kind: 'pilot', sourceId: id };
}

export function classifyCommercialSource(input: {
  dealId?: string | null;
  obligationType?: string | null;
  kind?: SettlementObligationKind;
}): SettlementSource {
  const dealId = String(input.dealId ?? '');
  if (dealId.startsWith('rmwf-')) return 'referral-management';

  const type = String(input.obligationType ?? '').toLowerCase();
  if (input.kind === 'attribution') return 'referral-management';
  if (type.includes('revenue') || type.includes('share')) return 'revenue-sharing';
  if (type === 'platform_fee') return 'other';
  if (type) return 'agreements';
  return 'other';
}

/**
 * Canonical settlement status. Ready for payout comes only from the settlement
 * domain (AVAILABLE_FOR_PAYOUT / RELEASE_READY), never from onboarding.
 */
export function classifyWorkspaceStatus(input: {
  status?: string | null;
  blockingIssue?: string | null;
}): SettlementWorkspaceStatus {
  const status = String(input.status ?? '').toUpperCase();
  if (status === 'PAID') return 'paid';
  if (status === 'AVAILABLE_FOR_PAYOUT' || status === 'RELEASE_READY') return 'ready';
  if (status === 'SUBMITTED' || status === 'PROCESSING') return 'released';
  if (input.blockingIssue) return 'requires_action';
  if (KNOWN_ACTION_STATUSES.has(status)) return 'requires_action';
  return 'pending';
}

export function pickDominantSettlementStatus(
  statuses: Array<SettlementWorkspaceStatus | null | undefined>
): SettlementWorkspaceStatus | null {
  for (const candidate of STATUS_PRIORITY) {
    if (statuses.includes(candidate)) return candidate;
  }
  return null;
}

export function mapPilotObligation(row: PilotObligationApiRow): SettlementObligationRow {
  const status = String(row.status ?? 'DRAFT');
  const obligationType = String(row.obligation_type ?? 'PARTICIPANT');
  const participant = row.participant
    ? {
        id: row.participant.id ?? row.participant_id ?? '',
        name: row.participant.name ?? undefined,
        approvalStatus: row.participant.approvalStatus ?? undefined,
        onboardingStatus: row.participant.onboardingStatus ?? undefined,
      }
    : row.participant_id
      ? { id: row.participant_id }
      : null;
  const nextInput = {
    status: status as Parameters<typeof getObligationNextAction>[0]['status'],
    obligation_type: obligationType,
    participant,
  };
  const reason = getObligationBlockingIssue(nextInput);
  const source = classifyCommercialSource({
    dealId: row.deal_id ?? row.deal?.id,
    obligationType,
    kind: 'pilot',
  });
  const workspaceStatus = classifyWorkspaceStatus({ status, blockingIssue: reason });
  const amountOwed = Number(row.amount_owed) || 0;
  const nextAction =
    workspaceStatus === 'pending'
      ? 'No action required — settlement is still processing.'
      : getObligationNextAction(nextInput);

  return {
    id: row.id,
    kind: 'pilot',
    sourceId: row.id,
    source,
    sourceLabel: SETTLEMENT_SOURCE_LABELS[source],
    relationshipId: row.deal_id ?? row.deal?.id ?? null,
    relationshipLabel: row.deal?.name?.trim() || 'Commercial relationship',
    participantId: row.participant?.id ?? row.participant_id ?? null,
    participantName:
      row.participant?.name?.trim() || row.beneficiary_name?.trim() || 'Participant',
    amountOwed,
    currency: row.currency || 'AUD',
    nextAction,
    reason,
    workspaceStatus,
    workspaceStatusLabel: SETTLEMENT_STATUS_LABELS[workspaceStatus],
    rawStatus: status,
    obligationType,
    paidAmount: workspaceStatus === 'paid' ? amountOwed : 0,
  };
}

export function mapAttributionEarning(row: AttributionEarningsApiRow): SettlementEarningRow {
  const source = classifyCommercialSource({
    dealId: row.dealId,
    kind: 'attribution',
  });
  return {
    id: attributionObligationId(row.participantId),
    participantId: row.participantId,
    participantName: row.participantName || 'Participant',
    source,
    sourceLabel: SETTLEMENT_SOURCE_LABELS[source],
    relationshipId: row.dealId,
    relationshipLabel: row.dealName?.trim() || 'Referral attribution',
    earned: row.paidAmount + row.outstandingAmount,
    unpaid: row.outstandingAmount,
    paid: row.paidAmount,
    currency: row.currency || 'AUD',
    settlementStatus: null,
    settlementStatusLabel: row.outstandingAmount > 0 ? 'Pending' : 'Paid',
    nextAction: null,
    itemCount: row.items.length,
  };
}

export function mapAttributionObligation(
  row: AttributionEarningsApiRow
): SettlementObligationRow | null {
  if (row.outstandingAmount <= 0) return null;
  const earning = mapAttributionEarning(row);
  return {
    id: earning.id,
    kind: 'attribution',
    sourceId: row.participantId,
    source: earning.source,
    sourceLabel: earning.sourceLabel,
    relationshipId: earning.relationshipId,
    relationshipLabel: earning.relationshipLabel,
    participantId: earning.participantId,
    participantName: earning.participantName,
    amountOwed: earning.unpaid,
    currency: earning.currency,
    nextAction: 'No action required — attribution settlement is still processing.',
    reason: null,
    workspaceStatus: 'pending',
    workspaceStatusLabel: SETTLEMENT_STATUS_LABELS.pending,
    rawStatus: 'POSTED',
    obligationType: 'ATTRIBUTION_COMMISSION',
    paidAmount: earning.paid,
  };
}

export function attachEarningSettlementStatus(
  earnings: SettlementEarningRow[],
  obligations: SettlementObligationRow[]
): SettlementEarningRow[] {
  return earnings.map((earning) => {
    const related = obligations.filter((row) => row.participantId === earning.participantId);
    const status =
      pickDominantSettlementStatus(related.map((row) => row.workspaceStatus)) ??
      (earning.unpaid > 0 ? 'pending' : earning.paid > 0 ? 'paid' : null);
    const nextAction =
      related.find((row) => row.workspaceStatus === 'requires_action')?.nextAction ??
      related.find((row) => row.workspaceStatus === 'ready')?.nextAction ??
      related[0]?.nextAction ??
      null;
    return {
      ...earning,
      settlementStatus: status,
      settlementStatusLabel: status ? SETTLEMENT_STATUS_LABELS[status] : 'No settlement yet',
      nextAction,
    };
  });
}

export function canCancelDraftReleaseBatch(input: {
  batchStatus?: string | null;
  payoutStatuses?: Array<string | null | undefined>;
}): { ok: true } | { ok: false; code: 'not_draft_batch' | 'has_non_draft_payouts' } {
  if (String(input.batchStatus ?? '').toUpperCase() !== 'DRAFT') {
    return { ok: false, code: 'not_draft_batch' };
  }
  const hasNonDraftPayout = (input.payoutStatuses ?? []).some(
    (status) => String(status ?? '').toUpperCase() !== 'DRAFT'
  );
  if (hasNonDraftPayout) {
    return { ok: false, code: 'has_non_draft_payouts' };
  }
  return { ok: true };
}

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.toISOString();
}

export function mapPayoutBatch(row: PayoutBatchApiRow): SettlementReleaseRow {
  const status = String(row.status ?? 'DRAFT').toUpperCase();
  const payouts = row.payouts ?? [];
  const paidPayoutCount = payouts.filter((payout) => String(payout.status).toUpperCase() === 'PAID')
    .length;
  const failedPayoutCount = payouts.filter(
    (payout) => String(payout.status).toUpperCase() === 'FAILED'
  ).length;
  const inFlightPayoutCount = payouts.filter((payout) => {
    const payoutStatus = String(payout.status).toUpperCase();
    return SETTLEMENT_IN_FLIGHT_PAYOUT_STATUSES.includes(
      payoutStatus as (typeof SETTLEMENT_IN_FLIGHT_PAYOUT_STATUSES)[number]
    );
  }).length;
  const allPaid =
    payouts.length > 0 && paidPayoutCount === payouts.length && failedPayoutCount === 0;

  let paymentState: SettlementReleasePaymentState = 'draft';
  let statusLabel = 'Draft';
  let paymentNote: string | null = null;

  if (allPaid) {
    paymentState = 'paid';
    statusLabel = 'Paid';
  } else if (failedPayoutCount > 0 && inFlightPayoutCount === 0) {
    paymentState = 'failed';
    statusLabel = 'Released — payment failed';
    if (paidPayoutCount > 0) {
      paymentNote = `${paidPayoutCount} of ${payouts.length} payouts paid. ${failedPayoutCount} payout failed.`;
    }
  } else if (
    status === 'SUBMITTED' ||
    status === 'PROCESSING' ||
    (status === 'DRAFT' && payouts.length > 0) ||
    inFlightPayoutCount > 0
  ) {
    paymentState = 'released';
    statusLabel = 'Released — processing';
    if (failedPayoutCount > 0) {
      paymentNote = `${failedPayoutCount} payout failed. Remaining payouts are still processing.`;
    }
  } else if (status === 'FAILED' || status === 'BLOCKED') {
    paymentState = 'failed';
    statusLabel = 'Released — payment failed';
  } else if (status === 'COMPLETED') {
    paymentState = 'released';
    statusLabel = 'Released';
    paymentNote = 'Batch completed. Payment receipt has not been confirmed yet.';
  }

  const createdAt = toIso(row.createdAt);
  return {
    id: row.id,
    status,
    statusLabel,
    paymentState,
    paymentNote,
    label: createdAt ? formatReleaseDayLabel(createdAt) : 'Release',
    payoutCount: Number(row.payoutCount) || payouts.length,
    paidPayoutCount,
    totalAmount: Number(row.totalAmount) || 0,
    currency: row.currency || 'AUD',
    createdAt,
    submittedAt: toIso(row.submittedAt),
    completedAt: toIso(row.completedAt),
    cancellable: canCancelDraftReleaseBatch({
      batchStatus: status,
      payoutStatuses: payouts.map((payout) => payout.status),
    }).ok,
  };
}

export function labelReleaseBatches(rows: SettlementReleaseRow[]): SettlementReleaseRow[] {
  const sorted = [...rows].sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));
  const monthCounts = new Map<string, number>();
  const monthSeen = new Map<string, number>();
  for (const row of sorted) {
    const key = monthKey(row.createdAt);
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  return sorted.map((row) => {
    const key = monthKey(row.createdAt);
    const seen = (monthSeen.get(key) ?? 0) + 1;
    monthSeen.set(key, seen);
    const total = monthCounts.get(key) ?? 1;
    return {
      ...row,
      label: formatReleaseLabel(row.createdAt, seen, total),
    };
  });
}

function monthKey(iso: string | null): string {
  if (!iso) return 'unknown';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function formatReleaseDayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Release';
  return `${date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} release`;
}

function formatReleaseLabel(iso: string | null, indexInMonth: number, totalInMonth: number): string {
  if (!iso) return `Release #${indexInMonth}`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return `Release #${indexInMonth}`;
  if (totalInMonth > 1) {
    const month = date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
    return `${month} release #${indexInMonth}`;
  }
  return formatReleaseDayLabel(iso);
}

export function participantIdsCoveredByPilotObligation(
  rows: SettlementObligationRow[]
): Set<string> {
  return new Set(
    rows
      .filter((row) => row.kind === 'pilot' && row.participantId)
      .map((row) => row.participantId as string)
  );
}

/**
 * One canonical queue row per economic obligation. If an attribution commission
 * is already represented by a linked/underlying pilot obligation for the same
 * participant, suppress the synthetic attribution row. Earnings keep the
 * attribution independently.
 */
export function canonicalObligationRows(
  rows: SettlementObligationRow[]
): SettlementObligationRow[] {
  const covered = participantIdsCoveredByPilotObligation(rows);
  return rows.filter(
    (row) => row.kind === 'pilot' || !covered.has(row.participantId ?? '')
  );
}

export function collectPayoutReceipts(batches: PayoutBatchApiRow[]): SettlementPayoutReceipt[] {
  return batches.flatMap((batch) =>
    (batch.payouts ?? [])
      .map((payout) => ({
        participantId: String(payout.participantId ?? payout.user_id ?? ''),
        status: String(payout.status ?? ''),
      }))
      .filter((receipt) => receipt.participantId)
  );
}

function withWorkspaceStatus(
  row: SettlementObligationRow,
  status: SettlementWorkspaceStatus,
  nextAction: string
): SettlementObligationRow {
  return {
    ...row,
    workspaceStatus: status,
    workspaceStatusLabel: SETTLEMENT_STATUS_LABELS[status],
    nextAction,
    reason: status === 'requires_action' ? row.reason : null,
    paidAmount: status === 'paid' ? row.amountOwed : row.kind === 'attribution' ? row.paidAmount : 0,
  };
}

export function classifyPayoutReceiptState(
  status?: string | null
): 'paid' | 'released' | 'failed' | null {
  const normalized = String(status ?? '').toUpperCase();
  if (normalized === 'PAID') return 'paid';
  if (normalized === 'FAILED') return 'failed';
  if (
    SETTLEMENT_IN_FLIGHT_PAYOUT_STATUSES.includes(
      normalized as (typeof SETTLEMENT_IN_FLIGHT_PAYOUT_STATUSES)[number]
    )
  ) {
    return 'released';
  }
  return null;
}

/**
 * Overlay payout receipt state onto obligation rows. Creating or submitting a
 * release never means Paid — only a confirmed PAID receipt does. Each
 * participant follows their own payout, not the batch as a whole.
 *
 * FAILED does not consume Ready: mark-failed unassigns ledger lines so the
 * obligation can be re-released. Do not treat FAILED as Released or Paid.
 */
export function overlayPayoutReceipts(
  rows: SettlementObligationRow[],
  receipts: SettlementPayoutReceipt[] = []
): SettlementObligationRow[] {
  const byParticipant = new Map<string, Array<'paid' | 'released' | 'failed'>>();
  for (const receipt of receipts) {
    const state = classifyPayoutReceiptState(receipt.status);
    if (!receipt.participantId || !state) continue;
    const current = byParticipant.get(receipt.participantId) ?? [];
    current.push(state);
    byParticipant.set(receipt.participantId, current);
  }

  return rows.map((row) => {
    if (!row.participantId) return row;
    const states = byParticipant.get(row.participantId);
    if (!states?.length) return row;
    if (states.includes('released')) {
      return withWorkspaceStatus(
        row,
        'released',
        'Payout is in progress — waiting for payment confirmation.'
      );
    }
    if (states.includes('paid')) {
      return withWorkspaceStatus(row, 'paid', 'Completed');
    }
    return row;
  });
}

export function buildSettlementObligationRows(
  pilotRows: PilotObligationApiRow[],
  attributionRows: AttributionEarningsApiRow[],
  receipts: SettlementPayoutReceipt[] = []
): SettlementObligationRow[] {
  const mappedPilot = pilotRows.map(mapPilotObligation);
  const attribution = attributionRows
    .map(mapAttributionObligation)
    .filter((row): row is SettlementObligationRow => row != null);
  return overlayPayoutReceipts(canonicalObligationRows([...mappedPilot, ...attribution]), receipts);
}

export function filterSettlementObligations(
  rows: SettlementObligationRow[],
  filters: { source?: string | null; status?: string | null; participant?: string | null }
): SettlementObligationRow[] {
  const source = filters.source?.trim() || 'all';
  const status = filters.status?.trim() || 'all';
  const participant = filters.participant?.trim() || '';
  return rows.filter((row) => {
    if (source !== 'all' && row.source !== source) return false;
    if (status !== 'all' && row.workspaceStatus !== status) return false;
    if (participant && row.participantId !== participant) return false;
    return true;
  });
}

export function countSettlementFilters(rows: SettlementObligationRow[]): {
  sources: Record<SettlementSourceFilter, number>;
  statuses: Record<SettlementStatusFilter, number>;
} {
  const sources = Object.fromEntries(
    SETTLEMENT_SOURCE_FILTERS.map((key) => [key, 0])
  ) as Record<SettlementSourceFilter, number>;
  const statuses = Object.fromEntries(
    SETTLEMENT_STATUS_FILTERS.map((key) => [key, 0])
  ) as Record<SettlementStatusFilter, number>;
  sources.all = rows.length;
  statuses.all = rows.length;
  for (const row of rows) {
    sources[row.source] += 1;
    statuses[row.workspaceStatus] += 1;
  }
  return { sources, statuses };
}

function countsTowardOwed(
  row: SettlementObligationRow,
  coveredPilotParticipantIds: Set<string>
): boolean {
  if (row.workspaceStatus === 'paid' || row.workspaceStatus === 'released') return false;
  if (row.kind === 'attribution' && coveredPilotParticipantIds.has(row.participantId ?? '')) {
    return false;
  }
  return true;
}

export function summarizeSettlement(rows: SettlementObligationRow[]): SettlementSummary {
  const canonical = canonicalObligationRows(rows);
  const coveredPilotParticipantIds = participantIdsCoveredByPilotObligation(canonical);

  const currency = canonical[0]?.currency ?? 'AUD';
  let pending = 0;
  let requiresAction = 0;
  let readyForPayout = 0;
  let released = 0;
  let paid = 0;
  let pendingCount = 0;
  let requiresActionCount = 0;
  let readyCount = 0;
  const requiresActionParticipants = new Set<string>();

  for (const row of canonical) {
    const include = countsTowardOwed(row, coveredPilotParticipantIds);
    if (row.workspaceStatus === 'ready' && include) {
      readyForPayout += row.amountOwed;
      readyCount += 1;
    } else if (row.workspaceStatus === 'requires_action' && include) {
      requiresAction += row.amountOwed;
      requiresActionCount += 1;
      if (row.participantId) requiresActionParticipants.add(row.participantId);
    } else if (row.workspaceStatus === 'pending' && include) {
      pending += row.amountOwed;
      pendingCount += 1;
    } else if (row.workspaceStatus === 'released') {
      released += row.amountOwed;
    } else if (row.workspaceStatus === 'paid') {
      paid += row.amountOwed;
    }
  }

  return {
    currency,
    owed: pending + requiresAction + readyForPayout,
    pending,
    requiresAction,
    readyForPayout,
    released,
    paid,
    pendingCount,
    requiresActionCount,
    requiresActionParticipants: requiresActionParticipants.size,
    readyCount,
  };
}

export function groupAttentionBlockers(rows: SettlementObligationRow[]): SettlementAttentionItem[] {
  const groups = new Map<
    string,
    { count: number; amount: number; currency: string; firstObligationId: string; participantName: string | null }
  >();
  for (const row of rows) {
    if (row.workspaceStatus !== 'requires_action') continue;
    const issue = row.reason ?? row.nextAction;
    const current = groups.get(issue) ?? {
      count: 0,
      amount: 0,
      currency: row.currency,
      firstObligationId: row.id,
      participantName: row.participantName,
    };
    current.count += 1;
    current.amount += row.amountOwed;
    groups.set(issue, current);
  }
  return [...groups.entries()]
    .map(([issue, value]) => ({ issue, ...value }))
    .sort((a, b) => b.amount - a.amount || b.count - a.count)
    .slice(0, 6);
}

export function summarizeCommercialMovement(input: {
  earnings: AttributionEarningsApiRow[];
  releases: SettlementReleaseRow[];
  obligations: SettlementObligationRow[];
  now?: Date;
}): SettlementCommercialMovement {
  const now = input.now ?? new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodLabel = now.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
  let earned = 0;
  let currency = input.obligations[0]?.currency ?? input.earnings[0]?.currency ?? 'AUD';
  for (const row of input.earnings) {
    currency = row.currency || currency;
    for (const item of row.items) {
      if (!item.createdAt) continue;
      const created = new Date(item.createdAt);
      if (created >= start) earned += item.amount;
    }
  }
  let released = 0;
  for (const row of input.releases) {
    const at = row.submittedAt ?? row.createdAt;
    if (!at) continue;
    if (new Date(at) >= start) released += row.totalAmount;
  }
  const paidToDate = input.earnings.reduce((sum, row) => sum + row.paidAmount, 0);
  return {
    periodLabel,
    currency,
    earned,
    released,
    paidToDate,
    paidPeriodSupported: false,
  };
}

export function moneyLabel(amount: number, currency = 'AUD'): string {
  return formatCurrency(amount, currency, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
