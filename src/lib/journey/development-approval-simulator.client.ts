'use client';

/**
 * Development/demo-only helper that simulates external participant approvals
 * by calling the same Participant Portal approve API used in production.
 */

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { isDevelopmentApprovalSimulatorEnabled } from '@/lib/journey/hackathon-journey';
import { canParticipantApproveAgreement } from '@/lib/operations/contracts/canonical-agreement-lifecycle';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';

export { isDevelopmentApprovalSimulatorEnabled };

const DEFAULT_MIN_DELAY_MS = 3000;
const DEFAULT_MAX_DELAY_MS = 5000;
const SIMULATED_APPROVAL_NOTE = 'Simulated approval (development demo)';

export type SimulatedApprovalResult = {
  attempted: number;
  approved: number;
  skipped: number;
  errors: string[];
};

function randomDelayMs(minMs: number, maxMs: number): number {
  return minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function listParticipantsAwaitingExternalApproval(
  participants: DemoParticipant[],
): DemoParticipant[] {
  return participants.filter(
    (participant) =>
      canParticipantApproveAgreement(participant) && Boolean(participant.inviteToken?.trim()),
  );
}

async function approveParticipantViaInviteToken(token: string): Promise<void> {
  const res = await csrfAwareFetch(
    `/api/deal-network-pilot/invites/${encodeURIComponent(token)}/approve`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ note: SIMULATED_APPROVAL_NOTE }),
    },
  );

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `Approval failed (${res.status})`);
  }
}

/**
 * Waits briefly, then approves every participant that is pending via the
 * production invite-token approval route (same path as Participant Portal).
 */
export async function simulateExternalParticipantApprovals(
  participants: DemoParticipant[],
  options?: { minDelayMs?: number; maxDelayMs?: number },
): Promise<SimulatedApprovalResult> {
  if (!isDevelopmentApprovalSimulatorEnabled()) {
    return { attempted: 0, approved: 0, skipped: participants.length, errors: [] };
  }

  const pending = listParticipantsAwaitingExternalApproval(participants);
  if (pending.length === 0) {
    return {
      attempted: 0,
      approved: 0,
      skipped: participants.length,
      errors: [],
    };
  }

  const minDelayMs = options?.minDelayMs ?? DEFAULT_MIN_DELAY_MS;
  const maxDelayMs = options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  await sleep(randomDelayMs(minDelayMs, maxDelayMs));

  const errors: string[] = [];
  let approved = 0;

  for (const participant of pending) {
    const token = participant.inviteToken?.trim();
    if (!token) continue;

    try {
      await approveParticipantViaInviteToken(token);
      approved += 1;
    } catch (error) {
      errors.push(
        `${participant.name}: ${error instanceof Error ? error.message : 'Approval failed'}`,
      );
    }
  }

  return {
    attempted: pending.length,
    approved,
    skipped: participants.length - pending.length,
    errors,
  };
}
