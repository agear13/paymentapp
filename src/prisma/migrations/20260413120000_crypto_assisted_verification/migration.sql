-- Payment Links: PAID_UNVERIFIED / REQUIRES_REVIEW + assisted crypto verification

-- PaymentLinkStatus
ALTER TYPE "PaymentLinkStatus" ADD VALUE IF NOT EXISTS 'PAID_UNVERIFIED';
ALTER TYPE "PaymentLinkStatus" ADD VALUE IF NOT EXISTS 'REQUIRES_REVIEW';

-- PaymentEventType
ALTER TYPE "PaymentEventType" ADD VALUE IF NOT EXISTS 'CRYPTO_PAYMENT_SUBMITTED';

-- CryptoPaymentConfirmationStatus
ALTER TYPE "CryptoPaymentConfirmationStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';

-- New enums
CREATE TYPE "CryptoVerificationStatus" AS ENUM ('VERIFIED', 'FLAGGED');
CREATE TYPE "MatchConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

ALTER TABLE "crypto_payment_confirmations"
  ADD COLUMN IF NOT EXISTS "payer_currency" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "verification_status" "CryptoVerificationStatus",
  ADD COLUMN IF NOT EXISTS "match_confidence" "MatchConfidence",
  ADD COLUMN IF NOT EXISTS "verification_issues" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "merchant_acknowledged_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "merchant_investigation_flag" BOOLEAN NOT NULL DEFAULT false;
