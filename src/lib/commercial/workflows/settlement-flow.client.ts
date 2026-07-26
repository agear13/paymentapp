'use client';

/**
 * Client orchestration for the existing Deal Network Pilot settlement workflow.
 * Loads obligations, derives settlement state, and executes release batches via
 * existing APIs — no duplicate settlement logic.
 */

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import { fetchPilotSnapshot } from '@/lib/deal-network-demo/pilot-store';
import { createParticipantReleaseBatch } from '@/lib/payouts/create-participant-release-batch';
import { isHackathonJourneyEnabled } from '@/lib/journey/hackathon-journey';
import { executeHackathonWorkflowSettlementRelease } from '@/lib/commercial/workflows/development-settlement-simulator.client';
import {
  deriveSettlementState,
  type SettlementWorkflowResult,
} from '@/lib/commercial/workflows/derive-settlement-state';
import { isParticipantCompensationExempt } from '@/lib/operations/primitives/participant-earnings-primitives';
import type { SettlementWorkflowState } from '@/lib/commercial/workflows/types';

export type WorkflowObligationRow = {
  id: string;
  deal_id: string;
  participant_id: string | null;
  obligation_type: string;
  amount_owed: number;
  currency: string;
  status: string;
  participant: {
    name: string;
    role: string;
  } | null;
};

export type WorkflowFundingSummary = {
  straitProject: boolean;
  fundedTotal: number;
  owedTotal: number;
  projectFundingStatus: string;
  linkedInvoiceCount: number;
};

export type WorkflowAllocationCard = {
  key: string;
  label: string;
  amountLabel: string;
  statusLabel: string;
  tone: 'primary' | 'muted';
};

const WORKFLOW_RELEASE_MIN_THRESHOLD = 0;

function parseAmount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatWorkflowMoney(amount: number, currency: string): string {
  const prefix = currency.toUpperCase() === 'AUD' ? 'A$' : `${currency.toUpperCase()} `;
  return `${prefix}${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function formatWorkflowObligationStatus(status: string): string {
  switch (status.toUpperCase()) {
    case 'PAID':
      return 'Paid';
    case 'AVAILABLE_FOR_PAYOUT':
      return 'Ready to pay';
    case 'APPROVED':
      return 'Approved';
    case 'PENDING_APPROVAL':
      return 'Pending approval';
    case 'PARTIALLY_FUNDED':
      return 'Partially funded';
    case 'UNFUNDED':
      return 'Awaiting funding';
    case 'DRAFT':
      return 'Draft';
    case 'REJECTED':
      return 'Rejected';
    case 'REVERSED':
      return 'Reversed';
    default:
      return status;
  }
}

export function formatWorkflowFundingStatus(status: string): string {
  switch (status.toUpperCase()) {
    case 'FULLY_FUNDED':
      return 'Commercially reconciled';
    case 'PARTIALLY_FUNDED':
      return 'Partially reconciled';
    case 'UNFUNDED':
      return 'Awaiting funding';
    default:
      return status.replace(/_/g, ' ').toLowerCase();
  }
}

export function settlementParticipantsForDeal(
  participants: DemoParticipant[],
  dealId: string,
): DemoParticipant[] {
  return participants.filter(
    (participant) => participant.dealId === dealId && !isParticipantCompensationExempt(participant),
  );
}

/** Matches deriveParticipantSettlementWorkflowState COMPLETE rule. */
export function isWorkflowSettlementComplete(participants: DemoParticipant[], dealId: string): boolean {
  const targets = settlementParticipantsForDeal(participants, dealId);
  if (targets.length === 0) return false;
  return targets.every(
    (participant) => participant.payoutSettlementStatus === 'Paid' || Boolean(participant.payoutPaidAt),
  );
}

export function deriveWorkflowSettlementStates(
  participants: DemoParticipant[],
  dealId: string,
  dealName: string | null | undefined,
): SettlementWorkflowResult[] {
  const scoped = settlementParticipantsForDeal(participants, dealId);
  return deriveSettlementState({
    participants: scoped,
    projectId: dealId,
    projectName: dealName ?? null,
  });
}

export function countWorkflowSettlementsByState(
  states: SettlementWorkflowResult[],
  state: SettlementWorkflowState,
): number {
  return states.filter((entry) => entry.state === state).length;
}

export function buildWorkflowAllocationCards(
  obligations: WorkflowObligationRow[],
  displayCurrency?: string,
): WorkflowAllocationCard[] {
  return obligations
    .filter((row) => row.amount_owed > 0)
    .map((row) => {
      const paid = row.status.toUpperCase() === 'PAID';
      const currency = displayCurrency?.trim() || row.currency;
      return {
        key: row.id,
        label: row.participant?.name ?? row.obligation_type.replace(/_/g, ' '),
        amountLabel: formatWorkflowMoney(row.amount_owed, currency),
        statusLabel: formatWorkflowObligationStatus(row.status),
        tone: paid ? 'muted' : 'primary',
      };
    });
}

export function deriveWorkflowTimelineStep(input: {
  obligationsLoaded: boolean;
  settlementStates: SettlementWorkflowResult[];
  fundingSummary: WorkflowFundingSummary | null;
  settlementComplete: boolean;
}): number {
  if (input.settlementComplete) return 4;
  if (
    input.fundingSummary &&
    (input.fundingSummary.projectFundingStatus === 'FULLY_FUNDED' ||
      input.fundingSummary.projectFundingStatus === 'FUNDED' ||
      input.fundingSummary.fundedTotal >= input.fundingSummary.owedTotal)
  ) {
    return 3;
  }
  if (
    input.settlementStates.some(
      (entry) =>
        entry.state === 'READY' ||
        entry.state === 'INITIATED' ||
        entry.state === 'PROCESSING' ||
        entry.state === 'COMPLETE',
    )
  ) {
    return 2;
  }
  if (input.obligationsLoaded) return 1;
  return 0;
}

export async function refreshWorkflowObligations(dealId: string): Promise<void> {
  const res = await csrfAwareFetch('/api/deal-network-pilot/obligations/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dealId }),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? `Failed to refresh obligations (${res.status})`);
  }
}

export async function fetchWorkflowObligations(dealId: string): Promise<WorkflowObligationRow[]> {
  const res = await fetch(`/api/deal-network-pilot/obligations?dealId=${encodeURIComponent(dealId)}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? `Failed to load obligations (${res.status})`);
  }
  const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
  const rows = Array.isArray(json.data) ? json.data : [];
  return rows
    .filter((row) => row.deal_id === dealId)
    .map((row) => ({
      id: String(row.id),
      deal_id: String(row.deal_id),
      participant_id: typeof row.participant_id === 'string' ? row.participant_id : null,
      obligation_type: String(row.obligation_type ?? 'PARTICIPANT'),
      amount_owed: parseAmount(row.amount_owed),
      currency: typeof row.currency === 'string' ? row.currency : 'AUD',
      status: typeof row.status === 'string' ? row.status : 'DRAFT',
      participant:
        row.participant && typeof row.participant === 'object'
          ? {
              name: String((row.participant as { name?: string }).name ?? 'Participant'),
              role: String((row.participant as { role?: string }).role ?? ''),
            }
          : null,
    }));
}

export async function fetchWorkflowFundingSummary(
  dealId: string,
): Promise<WorkflowFundingSummary | null> {
  const res = await fetch(
    `/api/deal-network-pilot/deals/${encodeURIComponent(dealId)}/funding-summary`,
    { credentials: 'include', cache: 'no-store' },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as WorkflowFundingSummary;
  return json;
}

export async function loadWorkflowSettlementSnapshot(dealId: string): Promise<{
  participants: DemoParticipant[];
  obligations: WorkflowObligationRow[];
  fundingSummary: WorkflowFundingSummary | null;
}> {
  const snapshot = await fetchPilotSnapshot();
  const participants = (snapshot?.participants ?? []).filter((participant) => participant.dealId === dealId);
  const [obligations, fundingSummary] = await Promise.all([
    fetchWorkflowObligations(dealId),
    fetchWorkflowFundingSummary(dealId),
  ]);
  return { participants, obligations, fundingSummary };
}

export async function executeWorkflowSettlementRelease(input: {
  organizationId: string;
  dealId: string;
  currency: string;
  participantIds: string[];
  fundingAmount?: number;
}): Promise<number> {
  if (input.participantIds.length === 0) return 0;

  if (isHackathonJourneyEnabled()) {
    return executeHackathonWorkflowSettlementRelease({
      dealId: input.dealId,
      currency: input.currency,
      participantIds: input.participantIds,
      fundingAmount: input.fundingAmount ?? 0,
    });
  }

  let released = 0;
  for (const participantId of input.participantIds) {
    await createParticipantReleaseBatch({
      organizationId: input.organizationId,
      currency: input.currency,
      participantId,
      minThreshold: WORKFLOW_RELEASE_MIN_THRESHOLD,
    });
    released += 1;
  }
  return released;
}
