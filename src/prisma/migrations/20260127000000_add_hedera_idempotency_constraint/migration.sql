-- ============================================================================
-- Migration: add_hedera_idempotency_constraint
-- ============================================================================
--
-- PURPOSE:
-- Enforce idempotency for Hedera payments by creating a PARTIAL UNIQUE INDEX
-- on (payment_link_id, correlation_id) WHERE correlation_id IS NOT NULL.
--
-- WHY A PARTIAL UNIQUE INDEX?
-- - We only want uniqueness enforced when correlation_id has a value.
-- - Historical records with NULL correlation_id should remain valid.
-- - A partial index allows multiple NULL values (standard unique would not).
--
-- WHY NOT @@unique IN PRISMA SCHEMA?
-- - Prisma does not support partial unique indexes (WHERE clause).
-- - Declaring @@unique([payment_link_id, correlation_id]) would create a
--   standard unique constraint, causing schema drift and blocking NULLs.
-- - Instead, we manage this index directly in SQL and use @@index in Prisma
--   for query performance only.
--
-- ============================================================================

-- Step 1: Add the correlation_id column if it doesn't exist
ALTER TABLE "payment_events"
ADD COLUMN IF NOT EXISTS "correlation_id" VARCHAR(255);

-- Step 2: Create the partial unique index for idempotency
-- Only enforces uniqueness when correlation_id IS NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS "payment_events_payment_link_correlation_unique"
ON "payment_events"("payment_link_id", "correlation_id")
WHERE "correlation_id" IS NOT NULL;

-- Step 3: Add documentation comment on the index
COMMENT ON INDEX "payment_events_payment_link_correlation_unique"
IS 'Ensures idempotency for Hedera payments using correlation_id';

