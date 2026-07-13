-- Commercial Timing: optional JSON column on payment_links for document-level timing.
-- Backwards compatible — existing rows remain null.

ALTER TABLE "payment_links" ADD COLUMN IF NOT EXISTS "commercial_timing" JSONB;
