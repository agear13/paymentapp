-- Migration: Add idempotency constraints for payment processing
-- Ensures duplicate payment events cannot be created

-- Add columns for tracking payment provider references
ALTER TABLE payment_events 
ADD COLUMN IF NOT EXISTS stripe_event_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS hedera_tx_id VARCHAR(255);

-- Create unique indexes to prevent duplicate processing
CREATE UNIQUE INDEX IF NOT EXISTS payment_events_stripe_event_id_key 
ON payment_events(stripe_event_id) 
WHERE stripe_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payment_events_hedera_tx_id_key 
ON payment_events(hedera_tx_id) 
WHERE hedera_tx_id IS NOT NULL;

-- Composite unique constraint: one PAID event per payment_link
CREATE UNIQUE INDEX IF NOT EXISTS payment_events_payment_link_paid_unique
ON payment_events(payment_link_id, event_type)
WHERE event_type = 'PAYMENT_CONFIRMED';

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS payment_events_stripe_payment_intent_idx 
ON payment_events(stripe_payment_intent_id) 
WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_events_stripe_checkout_session_idx 
ON payment_events(stripe_checkout_session_id) 
WHERE stripe_checkout_session_id IS NOT NULL;

-- Add correlation_id for distributed tracing
ALTER TABLE payment_events 
ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS payment_events_correlation_id_idx 
ON payment_events(correlation_id) 
WHERE correlation_id IS NOT NULL;

-- Add similar tracking for ledger entries
ALTER TABLE ledger_entries 
ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS ledger_entries_correlation_id_idx 
ON ledger_entries(correlation_id) 
WHERE correlation_id IS NOT NULL;

-- Add tracking for xero syncs
ALTER TABLE xero_syncs 
ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS xero_syncs_correlation_id_idx 
ON xero_syncs(correlation_id) 
WHERE correlation_id IS NOT NULL;

-- Ensure only one successful ledger entry set per payment_link
-- (Double-entry should be created atomically)
CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_payment_link_reference_unique
ON ledger_entries(payment_link_id, reference_type, reference_id)
WHERE reference_type = 'PAYMENT';

COMMENT ON COLUMN payment_events.stripe_event_id IS 'Stripe webhook event ID for idempotency';
COMMENT ON COLUMN payment_events.stripe_payment_intent_id IS 'Stripe PaymentIntent ID';
COMMENT ON COLUMN payment_events.stripe_checkout_session_id IS 'Stripe Checkout Session ID';
COMMENT ON COLUMN payment_events.hedera_tx_id IS 'Hedera transaction ID';
COMMENT ON COLUMN payment_events.correlation_id IS 'Correlation ID for distributed tracing';

