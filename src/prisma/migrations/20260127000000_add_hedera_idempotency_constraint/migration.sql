-- Add unique constraint on (payment_link_id, correlation_id) for idempotency
-- This prevents duplicate payment_events for the same payment link and correlation

-- Create unique partial index (only where correlation_id IS NOT NULL)
-- This allows historical records with NULL correlation_id to remain
CREATE UNIQUE INDEX IF NOT EXISTS "payment_events_payment_link_correlation_unique" 
ON "payment_events"("payment_link_id", "correlation_id") 
WHERE "correlation_id" IS NOT NULL;

-- Add comment for documentation
COMMENT ON INDEX "payment_events_payment_link_correlation_unique" IS 'Ensures idempotency for Hedera payments using correlation_id';

