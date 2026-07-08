-- Commercial / Settlement / Accounting layer separation (additive)

ALTER TABLE "payment_links"
  ADD COLUMN IF NOT EXISTS "commercial_currency" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "commercial_amount" DECIMAL(18, 8),
  ADD COLUMN IF NOT EXISTS "accounting_currency" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "accounting_amount" DECIMAL(18, 8),
  ADD COLUMN IF NOT EXISTS "settlement_currency" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "settlement_amount" DECIMAL(18, 8);

UPDATE "payment_links"
SET
  "commercial_currency" = COALESCE("invoice_currency", "currency"),
  "commercial_amount" = "amount",
  "accounting_currency" = COALESCE("base_currency", "invoice_currency", "currency"),
  "accounting_amount" = COALESCE("base_amount", "amount")
WHERE "commercial_currency" IS NULL;

ALTER TYPE "FxSnapshotType" ADD VALUE IF NOT EXISTS 'ACCOUNTING';

ALTER TABLE "fx_snapshots"
  ADD COLUMN IF NOT EXISTS "commercial_currency" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "commercial_amount" DECIMAL(18, 8),
  ADD COLUMN IF NOT EXISTS "accounting_currency" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "accounting_amount" DECIMAL(18, 8),
  ADD COLUMN IF NOT EXISTS "settlement_currency" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "settlement_amount" DECIMAL(18, 8),
  ADD COLUMN IF NOT EXISTS "valuation_method" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "payment_event_id" UUID;

CREATE INDEX IF NOT EXISTS "fx_snapshots_payment_event_id_idx"
  ON "fx_snapshots"("payment_event_id");

ALTER TABLE "fx_snapshots"
  ADD CONSTRAINT "fx_snapshots_payment_event_id_fkey"
  FOREIGN KEY ("payment_event_id") REFERENCES "payment_events"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_settlements"
  ADD COLUMN IF NOT EXISTS "commercial_currency" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "commercial_amount" DECIMAL(18, 8),
  ADD COLUMN IF NOT EXISTS "accounting_currency" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "accounting_amount" DECIMAL(18, 8),
  ADD COLUMN IF NOT EXISTS "fx_rate_applied" DECIMAL(18, 8),
  ADD COLUMN IF NOT EXISTS "fx_snapshot_id" UUID;

ALTER TABLE "payment_events"
  ADD COLUMN IF NOT EXISTS "layer_metadata" JSONB;
