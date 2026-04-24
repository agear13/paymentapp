ALTER TABLE "payment_links"
  ADD COLUMN IF NOT EXISTS "last_sent_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "last_sent_to_email" VARCHAR(512);
