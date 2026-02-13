/**
 * Runtime guard for payment_links.update data.
 * payment_links has no paid_at column (Render Postgres); paid_at is derived from
 * the latest PAYMENT_CONFIRMED event in payment_events.
 * This assert prevents accidental writes of unknown fields like paid_at.
 */

const DISALLOWED_FIELDS = ['paid_at'] as const;

/**
 * Asserts that payment_links update data does not include disallowed fields.
 * Throws if data contains paid_at or other unknown fields.
 * Use before passing data to prisma.payment_links.update().
 */
export function assertPaymentLinksUpdateDataValid(
  data: Record<string, unknown>
): void {
  for (const field of DISALLOWED_FIELDS) {
    if (field in data) {
      throw new Error(
        `payment_links.update must not include "${field}"; ` +
          `paid_at is derived from payment_events (latest PAYMENT_CONFIRMED), not stored on payment_links`
      );
    }
  }
}
