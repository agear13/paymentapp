import type { PayoutStatus } from '@prisma/client';
import { getPayoutRail } from '@/lib/payouts/rails/registry';
import type {
  CanonicalPayoutInstruction,
  PayoutQuote,
  PayoutRailAdapter,
  PayoutRailExecutionContext,
  CanonicalPayoutEvent,
  CanonicalPayoutStatus,
  PayoutAdapterSubmitResult,
} from '@/lib/payouts/rails/types';

export function buildManualPaidEvent(input: {
  payoutId: string;
  externalReference: string;
  paidAt?: Date;
}): CanonicalPayoutEvent {
  return {
    payoutId: input.payoutId,
    railId: 'manual',
    providerReference: input.externalReference,
    status: 'PAID',
    occurredAt: input.paidAt,
  };
}

export function buildManualFailedEvent(input: {
  payoutId: string;
  failedReason: string;
}): CanonicalPayoutEvent {
  return {
    payoutId: input.payoutId,
    railId: 'manual',
    providerReference: null,
    status: 'FAILED',
    failedReason: input.failedReason,
  };
}

export const ManualPayoutRailAdapter: PayoutRailAdapter = {
  railId: 'manual',

  getCapabilities() {
    return getPayoutRail('manual');
  },

  async quote(_instruction: CanonicalPayoutInstruction): Promise<PayoutQuote> {
    return {
      railId: 'manual',
      feeAmount: '0',
      feeCurrency: _instruction.currency,
      estimatedSettlementHint: getPayoutRail('manual').typicalSettlementHint,
      raw: null,
    };
  },

  async submit(
    _instruction: CanonicalPayoutInstruction,
    _context?: PayoutRailExecutionContext
  ): Promise<PayoutAdapterSubmitResult> {
    return { providerReference: null, status: 'SUBMITTED' };
  },

  async syncStatus(
    instruction: CanonicalPayoutInstruction,
    _context?: PayoutRailExecutionContext
  ): Promise<CanonicalPayoutStatus> {
    const status: Extract<PayoutStatus, 'SUBMITTED' | 'PROCESSING' | 'PAID' | 'FAILED'> =
      instruction.status === 'PAID' ||
      instruction.status === 'FAILED' ||
      instruction.status === 'PROCESSING' ||
      instruction.status === 'SUBMITTED'
        ? instruction.status
        : 'SUBMITTED';
    return {
      status,
      providerReference: instruction.providerReference,
    };
  },

  normalizeWebhook(_raw: unknown): CanonicalPayoutEvent | null {
    return null;
  },
};
