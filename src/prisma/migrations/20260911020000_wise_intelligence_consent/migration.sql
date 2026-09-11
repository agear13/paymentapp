-- Explicit Wise payment-intelligence consent.
-- Distinct from wise_enabled (collection/execution). Default denied.

ALTER TABLE "merchant_settings"
ADD COLUMN IF NOT EXISTS "wise_intelligence_consent" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "merchant_settings"
ADD COLUMN IF NOT EXISTS "wise_intelligence_consented_at" TIMESTAMPTZ(6);

ALTER TABLE "merchant_settings"
ADD COLUMN IF NOT EXISTS "wise_intelligence_revoked_at" TIMESTAMPTZ(6);
