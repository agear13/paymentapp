/**
 * Tests that payment_links.update data never includes paid_at.
 * payment_links has no paid_at column; paid_at is derived from payment_events.
 */

import { assertPaymentLinksUpdateDataValid } from '@/lib/payments/payment-links-update-guard';

describe('payment-links-update-guard', () => {
  describe('assertPaymentLinksUpdateDataValid', () => {
    it('allows valid update data (status, updated_at)', () => {
      expect(() =>
        assertPaymentLinksUpdateDataValid({
          status: 'PAID',
          updated_at: new Date(),
        })
      ).not.toThrow();
    });

    it('allows other valid fields (expires_at, etc)', () => {
      expect(() =>
        assertPaymentLinksUpdateDataValid({
          status: 'EXPIRED',
          updated_at: new Date(),
          expires_at: new Date(),
        })
      ).not.toThrow();
    });

    it('throws when paid_at is present', () => {
      expect(() =>
        assertPaymentLinksUpdateDataValid({
          status: 'PAID',
          updated_at: new Date(),
          paid_at: new Date(),
        })
      ).toThrow(/payment_links\.update must not include "paid_at"/);
    });

    it('throws with helpful message about deriving paid_at from payment_events', () => {
      expect(() =>
        assertPaymentLinksUpdateDataValid({ paid_at: new Date() })
      ).toThrow(/derived from payment_events/);
    });
  });
});
