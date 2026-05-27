import type { HydratedObligation } from '@/lib/operations/contracts/obligation-contract';
import { OBLIGATION_CONTRACT_VERSION } from '@/lib/operations/contracts/obligation-contract';
import { obligationStateFromReadiness } from '@/lib/operations/lifecycle/obligation-lifecycle';
import type { ObligationOperationalReadiness } from '@/lib/projects/funding-sources/types';

export type RawObligationInput = {
  id?: string;
  amount?: number;
  amountFunded?: number;
  currency?: string;
  participantId?: string | null;
  /** Persisted allocation status enum (e.g. PENDING_APPROVAL, APPROVED). */
  allocationStatus?: string;
  readiness?: ObligationOperationalReadiness;
};

/** Pure obligation operational state — no UI logic. */
export function deriveObligationState(input: RawObligationInput): HydratedObligation {
  const amount = Number.isFinite(input.amount) ? (input.amount as number) : 0;
  const amountFunded = Number.isFinite(input.amountFunded) ? (input.amountFunded as number) : 0;
  const readiness = input.readiness ?? 'awaiting_funding';
  const lifecycle = obligationStateFromReadiness(readiness, amountFunded);

  return {
    id: input.id ?? `obligation-${Date.now()}`,
    lifecycle,
    readiness,
    allocationStatus: input.allocationStatus,
    amount,
    amountFunded,
    currency: input.currency ?? 'AUD',
    participantId: input.participantId ?? null,
    operational: {
      releaseReady: readiness === 'ready' && amountFunded + 0.005 >= amount,
      needsFunding: readiness === 'awaiting_funding' || readiness === 'partially_funded',
    },
    metadata: {
      contractVersion: OBLIGATION_CONTRACT_VERSION,
      source: input.id ? 'hydrated' : 'draft',
    },
  };
}
