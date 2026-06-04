import { Prisma } from '@prisma/client';
import {
  decimalToJsonNumber,
  serializePilotObligationApiRow,
} from '@/lib/deal-network-demo/serialize-pilot-obligation-api-row';

describe('serializePilotObligationApiRow', () => {
  it('converts Prisma Decimal and Date fields to JSON-safe values', () => {
    const row = {
      id: 'obl-1',
      deal_id: 'deal-1',
      participant_id: 'p-1',
      amount_owed: new Prisma.Decimal('12000.00'),
      created_at: new Date('2026-01-15T00:00:00.000Z'),
      updated_at: new Date('2026-01-16T00:00:00.000Z'),
      due_date: null,
      calculation_snapshot_json: { total: 12000 },
      payment_event: {
        id: 'pe-1',
        source_type: 'stripe',
        payment_link_id: 'pl-1',
        event_type: 'PAYMENT_CONFIRMED',
        gross_amount: new Prisma.Decimal('1.00'),
        amount_received: new Prisma.Decimal('1.00'),
        currency_received: 'USD',
        received_at: new Date('2026-01-15T01:00:00.000Z'),
      },
      participant: null,
      status: 'POSTED',
    };

    const serialized = serializePilotObligationApiRow(row, null);
    expect(serialized.amount_owed).toBe(12000);
    expect(serialized.created_at).toBe('2026-01-15T00:00:00.000Z');
    expect((serialized.payment_event as { gross_amount: number }).gross_amount).toBe(1);
    expect(() => JSON.stringify(serialized)).not.toThrow();
  });

  it('decimalToJsonNumber handles plain numbers', () => {
    expect(decimalToJsonNumber(0.1)).toBe(0.1);
  });
});
