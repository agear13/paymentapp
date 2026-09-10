import { payoutRailLabel } from '@/lib/payouts/payout-rail-presentation';
import type { PayoutRailId } from '@/lib/payouts/rails/types';

export type PresentedPayoutStatus = {
  code: string;
  label: string;
  tone: 'draft' | 'submitted' | 'processing' | 'paid' | 'failed';
  explanation: string;
};

export function presentPayoutStatus(input: {
  status?: string | null;
  railId?: string | null;
  failedReason?: string | null;
}): PresentedPayoutStatus {
  const status = (input.status ?? '').toUpperCase();
  const railId = (input.railId ?? '') as PayoutRailId | '';

  if (status === 'DRAFT') {
    return {
      code: 'DRAFT',
      label: 'Draft',
      tone: 'draft',
      explanation: 'This payout is in a draft batch and has not been submitted.',
    };
  }
  if (status === 'SUBMITTED') {
    return {
      code: 'SUBMITTED',
      label: 'Submitted',
      tone: 'submitted',
      explanation: 'The batch is submitted. Provider execution has not started.',
    };
  }
  if (status === 'PROCESSING') {
    if (railId === 'cregis') {
      return {
        code: 'PROCESSING',
        label: 'Processing · awaiting authorization',
        tone: 'processing',
        explanation:
          'The payout is processing. Authorization or signing may still be required before it can be paid.',
      };
    }
    if (railId === 'hedera') {
      return {
        code: 'PROCESSING',
        label: 'Processing · awaiting authorization',
        tone: 'processing',
        explanation: 'Waiting for wallet authorization and on-chain confirmation.',
      };
    }
    return {
      code: 'PROCESSING',
      label: 'Processing',
      tone: 'processing',
      explanation: 'The payout is in progress.',
    };
  }
  if (status === 'PAID') {
    return {
      code: 'PAID',
      label: 'Paid',
      tone: 'paid',
      explanation: 'The payout is complete.',
    };
  }
  if (status === 'FAILED') {
    return {
      code: 'FAILED',
      label: 'Failed',
      tone: 'failed',
      explanation: publicFailedReason(input.failedReason) || 'The payout could not be completed.',
    };
  }
  return {
    code: status || 'UNKNOWN',
    label: status || 'Unknown',
    tone: 'draft',
    explanation: 'Status is not recognized.',
  };
}

export function publicFailedReason(reason?: string | null): string | null {
  if (!reason?.trim()) return null;
  const trimmed = reason.trim();
  if (/api[_-]?key|sign|secret|private[_-]?key|password|credential/i.test(trimmed)) {
    return 'The payout failed. See the operator activity log for details.';
  }
  return trimmed.slice(0, 280);
}

export type PayoutTimelineStep = {
  id: string;
  label: string;
  state: 'complete' | 'current' | 'upcoming';
  detail?: string | null;
};

export function buildPayoutTimeline(input: {
  status?: string | null;
  railId?: string | null;
  createdAt?: string | null;
  paidAt?: string | null;
  failedReason?: string | null;
}): PayoutTimelineStep[] {
  const presented = presentPayoutStatus(input);
  const order = ['created', 'rail', 'submitted', 'processing', 'terminal'] as const;
  const currentIndex =
    presented.code === 'DRAFT'
      ? input.railId
        ? 2
        : 1
      : presented.code === 'SUBMITTED'
        ? 2
        : presented.code === 'PROCESSING'
          ? 3
          : 4;

  return order.map((id, index) => {
    const state =
      index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming';
    if (id === 'created') {
      return { id, label: 'Payout created', state, detail: input.createdAt ?? null };
    }
    if (id === 'rail') {
      return {
        id,
        label: 'Rail selected',
        state: input.railId ? (index <= currentIndex ? 'complete' : 'current') : state,
        detail: input.railId ? payoutRailLabel(input.railId) : 'Pending batch creation',
      };
    }
    if (id === 'submitted') {
      return { id, label: 'Submitted', state };
    }
    if (id === 'processing') {
      return {
        id,
        label:
          presented.code === 'PROCESSING'
            ? presented.label
            : 'Processing / awaiting authorization',
        state,
      };
    }
    return {
      id,
      label: presented.code === 'FAILED' ? 'Failed' : 'Paid',
      state: presented.code === 'PAID' || presented.code === 'FAILED' ? 'current' : 'upcoming',
      detail: presented.code === 'FAILED' ? presented.explanation : input.paidAt ?? null,
    };
  });
}
