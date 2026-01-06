-- Add UUID defaults for ledger tables
-- Ensures IDs auto-generate when not explicitly provided

ALTER TABLE "ledger_accounts"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "ledger_entries"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
