-- Option B: persist referral link on payment_links so non-Stripe rails can resolve revenue share metadata.
ALTER TABLE "payment_links" ADD COLUMN IF NOT EXISTS "referral_link_id" UUID;

CREATE INDEX IF NOT EXISTS "payment_links_referral_link_id_idx" ON "payment_links"("referral_link_id");

ALTER TABLE "payment_links"
  DROP CONSTRAINT IF EXISTS "payment_links_referral_link_id_fkey";

ALTER TABLE "payment_links"
  ADD CONSTRAINT "payment_links_referral_link_id_fkey"
  FOREIGN KEY ("referral_link_id") REFERENCES "referral_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
