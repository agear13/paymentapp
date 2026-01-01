-- Add missing PaymentToken enum and token_type column to fx_snapshots
-- This fixes production bug where Prisma expects token_type but the column doesn't exist

-- Step 1: Create PaymentToken enum if it doesn't exist
-- Note: CREATE TYPE does not support IF NOT EXISTS, so we check differently
DO $$ BEGIN
    CREATE TYPE "PaymentToken" AS ENUM ('HBAR', 'USDC', 'USDT', 'AUDD');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 2: Add token_type column to fx_snapshots (safe for production)
ALTER TABLE "fx_snapshots" 
ADD COLUMN IF NOT EXISTS "token_type" "PaymentToken";

-- Step 3: Optional backfill for existing rows (if needed by application logic)
-- UPDATE "fx_snapshots" SET "token_type" = 'HBAR' WHERE "token_type" IS NULL AND "base_currency" = 'HBAR';
-- UPDATE "fx_snapshots" SET "token_type" = 'USDC' WHERE "token_type" IS NULL AND "base_currency" = 'USDC';
-- UPDATE "fx_snapshots" SET "token_type" = 'USDT' WHERE "token_type" IS NULL AND "base_currency" = 'USDT';
-- UPDATE "fx_snapshots" SET "token_type" = 'AUDD' WHERE "token_type" IS NULL AND "base_currency" = 'AUDD';

-- Note: Column is left as nullable (no NOT NULL constraint) as per Prisma schema definition
-- which shows: token_type      PaymentToken?

