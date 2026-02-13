-- Referral Conversion Idempotency: external_ref uniqueness
-- Enables idempotent auto-creation from payment events (webhook retries)

-- 1. Add external_ref column to referral_conversions
ALTER TABLE referral_conversions
  ADD COLUMN IF NOT EXISTS external_ref TEXT;

-- 2. Unique partial index: only one row per non-null external_ref
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_conversions_external_ref_unique
  ON referral_conversions(external_ref)
  WHERE external_ref IS NOT NULL;

COMMENT ON COLUMN referral_conversions.external_ref IS 'Idempotency key e.g. payment_event:evt_xxx or payment_event:pi_xxx';

-- 3. Payment link referral attribution (links payment to consultant/advocate)
-- Populated when user visits pay page with ?ref=CODE or when checkout includes referral metadata
CREATE TABLE IF NOT EXISTS payment_link_referral_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_link_id UUID NOT NULL,
  program_id UUID NOT NULL REFERENCES referral_programs(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES referral_participants(id) ON DELETE CASCADE,
  advocate_referral_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(payment_link_id)
);

CREATE INDEX IF NOT EXISTS idx_pl_attributions_payment_link ON payment_link_referral_attributions(payment_link_id);
COMMENT ON TABLE payment_link_referral_attributions IS 'Stores referral attribution for payment links; used by auto conversion on payment confirm';
