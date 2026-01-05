-- AlterTable
ALTER TABLE "ledger_accounts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "ledger_entries" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

