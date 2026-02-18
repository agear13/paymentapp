-- Add HEDERA to PayoutMethodType enum (canonical destination: Hedera Account ID 0.0.x for HTS transfers)
-- Add HEDERA to enum (run once; re-run may error if value exists)
ALTER TYPE "PayoutMethodType" ADD VALUE 'HEDERA';

-- Add hedera_account_id to payout_methods (canonical format: "0.0.12345" for SDK compatibility)
ALTER TABLE "payout_methods" ADD COLUMN IF NOT EXISTS "hedera_account_id" VARCHAR(50);
