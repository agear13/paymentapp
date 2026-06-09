-- Single active Stripe Checkout session per payment link (prevents duplicate charges).

ALTER TABLE "payment_links"
  ADD COLUMN IF NOT EXISTS "active_stripe_checkout_session_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "active_stripe_checkout_expires_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "payment_links_active_stripe_checkout_session_id_idx"
  ON "payment_links" ("active_stripe_checkout_session_id")
  WHERE "active_stripe_checkout_session_id" IS NOT NULL;
