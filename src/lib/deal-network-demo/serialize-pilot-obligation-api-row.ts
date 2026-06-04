import type { Prisma } from '@prisma/client';

/** JSON-safe scalar for Prisma Decimal / numeric strings in API responses. */
export function decimalToJsonNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toNumber' in value &&
    typeof (value as { toNumber: () => number }).toNumber === 'function'
  ) {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(String(value));
  return Number.isFinite(n) ? n : 0;
}

export function dateToJsonIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

type PaymentEventSlice = {
  id: string;
  source_type: string | null;
  payment_link_id: string | null;
  event_type: string;
  gross_amount: unknown;
  amount_received: unknown;
  currency_received: string | null;
  received_at: Date | null;
};

export function serializePilotPaymentEventForApi(
  paymentEvent: PaymentEventSlice | null | undefined
): Record<string, unknown> | null {
  if (!paymentEvent) return null;
  return {
    id: paymentEvent.id,
    source_type: paymentEvent.source_type,
    payment_link_id: paymentEvent.payment_link_id,
    event_type: paymentEvent.event_type,
    gross_amount: decimalToJsonNumber(paymentEvent.gross_amount),
    amount_received: decimalToJsonNumber(paymentEvent.amount_received),
    currency_received: paymentEvent.currency_received,
    received_at: dateToJsonIso(paymentEvent.received_at),
  };
}

type ObligationRowForApi = {
  participant?: unknown;
  payment_event?: PaymentEventSlice | null;
  amount_owed: unknown;
  created_at: Date;
  updated_at: Date;
  due_date: Date | null;
  calculation_snapshot_json: Prisma.JsonValue;
  [key: string]: unknown;
};

/** Strip Prisma Decimal/Date values so NextResponse.json cannot fail at the edge. */
export function serializePilotObligationApiRow(
  row: ObligationRowForApi,
  participantOut: Record<string, unknown> | null
): Record<string, unknown> {
  const { participant: _participant, payment_event, amount_owed, created_at, updated_at, due_date, ...rest } =
    row;
  return {
    ...rest,
    amount_owed: decimalToJsonNumber(amount_owed),
    created_at: dateToJsonIso(created_at),
    updated_at: dateToJsonIso(updated_at),
    due_date: dateToJsonIso(due_date),
    calculation_snapshot_json: row.calculation_snapshot_json,
    payment_event: serializePilotPaymentEventForApi(payment_event),
    participant: participantOut,
  };
}
