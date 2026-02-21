-- Add Wise merchant settings columns
-- wise_enabled: boolean flag to enable Wise payments for this merchant
-- wise_currency: optional default currency for Wise (falls back to default_currency)

ALTER TABLE "merchant_settings"
ADD COLUMN IF NOT EXISTS "wise_enabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "merchant_settings"
ADD COLUMN IF NOT EXISTS "wise_currency" CHAR(3);

-- Add PAYMENT_PENDING to PaymentEventType enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PAYMENT_PENDING' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'PaymentEventType')) THEN
    ALTER TYPE "PaymentEventType" ADD VALUE 'PAYMENT_PENDING';
  END IF;
END$$;
