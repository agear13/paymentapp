-- Settlement FX Snapshot Hardening: de-duplicate then add UNIQUE constraint.
-- 1) Delete duplicate rows per (payment_link_id, snapshot_type, base_currency, quote_currency), keeping latest by captured_at.
-- 2) Add unique constraint ux_fx_snapshots_link_type_pair.

-- Step 1: Remove duplicates; keep one row per key with the latest captured_at.
DELETE FROM fx_snapshots a
USING fx_snapshots b
WHERE a.payment_link_id = b.payment_link_id
  AND a.snapshot_type = b.snapshot_type
  AND a.base_currency = b.base_currency
  AND a.quote_currency = b.quote_currency
  AND a.captured_at < b.captured_at;

-- Step 2: Add unique constraint (creates unique index).
CREATE UNIQUE INDEX IF NOT EXISTS "ux_fx_snapshots_link_type_pair"
ON "fx_snapshots" ("payment_link_id", "snapshot_type", "base_currency", "quote_currency");
