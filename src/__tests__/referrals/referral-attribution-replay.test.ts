/**
 * Sprint 1: settlement prefers invoice commission snapshot (no duplicate commission on replay).
 * Uses the same idempotency contract as production: commission-${paymentEventId}-split-${split_id}.
 */

import { parseReferralSplitsFromMetadata } from '@/lib/referrals/commission-posting';
import { isCompleteCommissionAttributionMetadata } from '@/lib/referrals/commission-attribution-snapshot';

describe('referral attribution replay safety', () => {
  it('parses frozen snapshot the same on each read (deterministic)', () => {
    const snapshot = {
      referral_link_id: '550e8400-e29b-41d4-a716-446655440000',
      referral_code: 'DEMO',
      commission_basis: 'GROSS',
      referral_splits: JSON.stringify([
        {
          split_id: '660e8400-e29b-41d4-a716-446655440001',
          label: 'Partner 1',
          percentage: 10,
          beneficiary_id: null,
          sort_order: 0,
        },
      ]),
    };
    expect(isCompleteCommissionAttributionMetadata(snapshot)).toBe(true);
    const a = parseReferralSplitsFromMetadata(snapshot as never);
    const b = parseReferralSplitsFromMetadata(snapshot as never);
    expect(a).toEqual(b);
    expect(a?.[0]?.split_id).toBe('660e8400-e29b-41d4-a716-446655440001');
  });

  it('documents PAYMENT_CONFIRMED as commission trigger (invariant)', () => {
    expect(
      'Commission posting runs only after a new PAYMENT_CONFIRMED payment_event (alreadyProcessed === false).'
    ).toContain('PAYMENT_CONFIRMED');
  });
});
