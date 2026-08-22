-- First-party Professional Trial clock. Additive only. No backfill.
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMPTZ(6);
