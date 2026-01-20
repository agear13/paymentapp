-- Add missing columns to payment_events table
-- This fixes the webhook "Unknown argument stripe_event_id" error

ALTER TABLE payment_events 
ADD COLUMN IF NOT EXISTS stripe_event_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(255);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS payment_events_stripe_event_id_idx ON payment_events(stripe_event_id);

-- Comment on columns
COMMENT ON COLUMN payment_events.stripe_event_id IS 'Stripe event ID for idempotency checking';
COMMENT ON COLUMN payment_events.correlation_id IS 'Correlation ID for distributed tracing';

