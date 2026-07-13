/**
 * Payment allocation — full, partial, multiple, and overpayment support.
 */

import type {
  CommercialPaymentEvent,
  PaymentAllocation,
  PaymentAllocationType,
} from '@/lib/commercial-reconciliation/types';

const MONEY_TOLERANCE = 0.001;

export type PaymentAllocationResult = {
  allocations: PaymentAllocation[];
  totalAllocated: number;
  remainingAmount: number;
  isFullyAllocated: boolean;
  isPartiallyAllocated: boolean;
  isOverpaid: boolean;
};

function allocationType(
  allocatedSoFar: number,
  eventAmount: number,
  invoiceAmount: number
): PaymentAllocationType {
  if (allocatedSoFar + eventAmount > invoiceAmount + MONEY_TOLERANCE) {
    return 'overpayment';
  }
  if (Math.abs(allocatedSoFar + eventAmount - invoiceAmount) <= MONEY_TOLERANCE) {
    return 'full';
  }
  return 'partial';
}

/**
 * Allocate confirmed payment events to an invoice amount.
 * Events are processed in receivedAt order (commercial identity already known).
 */
export function derivePaymentAllocation(
  invoiceAmount: number,
  events: CommercialPaymentEvent[]
): PaymentAllocationResult {
  const sorted = [...events].sort(
    (a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()
  );

  const totalReceived = sorted.reduce((sum, event) => sum + Math.max(0, event.amount), 0);

  const allocations: PaymentAllocation[] = [];
  let totalAllocated = 0;

  for (const event of sorted) {
    if (event.amount <= 0) continue;

    const type = allocationType(totalAllocated, event.amount, invoiceAmount);
    const allocAmount =
      type === 'overpayment'
        ? Math.max(0, invoiceAmount - totalAllocated)
        : event.amount;

    if (allocAmount > 0) {
      allocations.push({
        paymentEventId: event.paymentEventId,
        amount: allocAmount,
        currency: event.currency,
        allocatedAt: event.receivedAt,
        allocationType: type === 'overpayment' && totalAllocated >= invoiceAmount - MONEY_TOLERANCE
          ? 'overpayment'
          : type,
        paymentRail: event.paymentRail,
      });
      totalAllocated += allocAmount;
    } else if (type === 'overpayment') {
      allocations.push({
        paymentEventId: event.paymentEventId,
        amount: event.amount,
        currency: event.currency,
        allocatedAt: event.receivedAt,
        allocationType: 'overpayment',
        paymentRail: event.paymentRail,
      });
      totalAllocated += event.amount;
    }
  }

  const remainingAmount = Math.max(0, invoiceAmount - Math.min(totalAllocated, invoiceAmount));
  const isFullyAllocated = totalAllocated >= invoiceAmount - MONEY_TOLERANCE;
  const isPartiallyAllocated = totalAllocated > MONEY_TOLERANCE && !isFullyAllocated;
  const isOverpaid = totalReceived > invoiceAmount + MONEY_TOLERANCE;

  return {
    allocations,
    totalAllocated,
    remainingAmount,
    isFullyAllocated,
    isPartiallyAllocated,
    isOverpaid,
  };
}

/** Sum allocated amount from allocation result. */
export function matchedAmountFromAllocations(allocations: PaymentAllocation[]): number {
  return allocations
    .filter((a) => a.allocationType !== 'overpayment' || a.amount > 0)
    .reduce((sum, a) => {
      if (a.allocationType === 'overpayment') {
        return sum;
      }
      return sum + a.amount;
    }, 0);
}
