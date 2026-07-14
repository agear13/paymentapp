import fs from 'fs';
import path from 'path';
import { PaymentEventType } from '@prisma/client';

const PILOT_READINESS_SOURCE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'lib', 'pilot', 'pilot-readiness.server.ts'),
  'utf8'
);

const PILOT_STATUS_ROUTE_SOURCE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'app', 'api', 'pilot', 'status', 'route.ts'),
  'utf8'
);

const VALID_PAYMENT_EVENT_TYPES = new Set(Object.values(PaymentEventType));

function extractQuotedEnumLiterals(source: string, field: string): string[] {
  const literals: string[] = [];
  const fieldPattern = new RegExp(`${field}:\\s*'([A-Z_]+)'`, 'g');
  for (const match of source.matchAll(fieldPattern)) {
    literals.push(match[1]);
  }
  const inPattern = new RegExp(`${field}:\\s*\\{[^}]*in:\\s*\\[([^\\]]+)\\]`, 'g');
  for (const block of source.matchAll(inPattern)) {
    for (const item of block[1].matchAll(/'([A-Z_]+)'/g)) {
      literals.push(item[1]);
    }
  }
  return literals;
}

describe('pilot status PaymentEventType contract', () => {
  it('pilot-readiness does not reference removed PAYMENT_RECEIVED', () => {
    expect(PILOT_READINESS_SOURCE).not.toContain('PAYMENT_RECEIVED');
    expect(PILOT_STATUS_ROUTE_SOURCE).not.toContain('PAYMENT_RECEIVED');
  });

  it('pilot-readiness uses generated PaymentEventType enum for Prisma filters', () => {
    expect(PILOT_READINESS_SOURCE).toContain("from '@prisma/client'");
    expect(PILOT_READINESS_SOURCE).toContain('PaymentEventType.PAYMENT_CONFIRMED');
    expect(PILOT_READINESS_SOURCE).toContain('PaymentEventSourceType.STRIPE');
  });

  it('every payment_events.event_type literal in pilot-readiness is a valid PaymentEventType', () => {
    const literals = extractQuotedEnumLiterals(PILOT_READINESS_SOURCE, 'event_type');
    expect(literals.length).toBe(0);
  });

  it('STRIPE_PAYMENT_EVENT_TYPES only contains valid PaymentEventType values', () => {
    const block = PILOT_READINESS_SOURCE.match(
      /const STRIPE_PAYMENT_EVENT_TYPES:[\s\S]*?];/
    )?.[0];
    expect(block).toBeTruthy();
    const members = [...(block ?? '').matchAll(/PaymentEventType\.([A-Z_]+)/g)].map(
      (match) => match[1]
    );
    expect(members).toEqual(
      expect.arrayContaining(['PAYMENT_INITIATED', 'PAYMENT_CONFIRMED'])
    );
    for (const member of members) {
      expect(VALID_PAYMENT_EVENT_TYPES.has(member as PaymentEventType)).toBe(true);
    }
  });
});
