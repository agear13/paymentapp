import type { OperationalSyncResponse } from '@/lib/operations/orchestration/operational-sync-client';

export type CreateParticipantReleaseBatchInput = {
  organizationId: string;
  currency: string;
  participantId: string;
  minThreshold?: number;
};

export type CreateParticipantReleaseBatchResult = {
  batchId: string;
  totalAmount: number;
  currency: string;
  releasedParticipantName?: string;
  operationalSync?: OperationalSyncResponse['operationalSync'];
};

const DEFAULT_RELEASE_MIN_THRESHOLD = 50;

export async function createParticipantReleaseBatch(
  input: CreateParticipantReleaseBatchInput
): Promise<CreateParticipantReleaseBatchResult> {
  const res = await fetch('/api/payout-batches/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      organizationId: input.organizationId,
      currency: input.currency,
      minThreshold: input.minThreshold ?? DEFAULT_RELEASE_MIN_THRESHOLD,
      participantIds: [input.participantId],
    }),
  });

  const json = (await res.json()) as {
    error?: string;
    message?: string;
    data?: {
      id: string;
      totalAmount: number;
      currency: string;
      releasedParticipantName?: string;
    };
    operationalSync?: OperationalSyncResponse['operationalSync'];
  };

  if (!res.ok) {
    throw new Error(json.message || json.error || 'Failed to release participant');
  }

  if (!json.data?.id) {
    throw new Error('Release batch created but response was incomplete');
  }

  return {
    batchId: json.data.id,
    totalAmount: json.data.totalAmount,
    currency: json.data.currency,
    releasedParticipantName: json.data.releasedParticipantName,
    operationalSync: json.operationalSync,
  };
}
