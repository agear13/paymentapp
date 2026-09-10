import type { PayoutStatus } from '@prisma/client';

const PAYOUT_STATUS_TRANSITIONS: Record<PayoutStatus, readonly PayoutStatus[]> = {
  DRAFT: ['SUBMITTED', 'PROCESSING', 'PAID', 'FAILED'],
  SUBMITTED: ['PROCESSING', 'PAID', 'FAILED'],
  PROCESSING: ['PAID', 'FAILED'],
  PAID: [],
  FAILED: [],
};

export function canTransitionPayoutStatus(
  current: PayoutStatus,
  target: PayoutStatus
): boolean {
  if (current === target) return true;
  return PAYOUT_STATUS_TRANSITIONS[current].includes(target);
}

export function assertCanTransitionPayoutStatus(
  current: PayoutStatus,
  target: PayoutStatus
): void {
  if (canTransitionPayoutStatus(current, target)) return;
  throw new PayoutReleaseError(
    'INVALID_PAYOUT_TRANSITION',
    `Cannot transition payout from ${current} to ${target}`,
    409
  );
}

export class PayoutReleaseError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 400,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PayoutReleaseError';
  }
}
