-- Add WISE to PaymentMethod enum
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'WISE';

-- payment_links: payment_method + Wise fields
ALTER TABLE "payment_links" ADD COLUMN IF NOT EXISTS "payment_method" "PaymentMethod";
ALTER TABLE "payment_links" ADD COLUMN IF NOT EXISTS "wise_quote_id" VARCHAR(255);
ALTER TABLE "payment_links" ADD COLUMN IF NOT EXISTS "wise_transfer_id" VARCHAR(255);
ALTER TABLE "payment_links" ADD COLUMN IF NOT EXISTS "wise_status" VARCHAR(50);
ALTER TABLE "payment_links" ADD COLUMN IF NOT EXISTS "wise_received_amount" DECIMAL(18,8);
ALTER TABLE "payment_links" ADD COLUMN IF NOT EXISTS "wise_received_currency" CHAR(3);
CREATE INDEX IF NOT EXISTS "payment_links_payment_method_idx" ON "payment_links"("payment_method");

-- payment_events: wise_transfer_id for idempotency
ALTER TABLE "payment_events" ADD COLUMN IF NOT EXISTS "wise_transfer_id" VARCHAR(255);
CREATE INDEX IF NOT EXISTS "payment_events_wise_transfer_id_idx" ON "payment_events"("wise_transfer_id");

-- merchant_settings: Wise and Xero Wise clearing
ALTER TABLE "merchant_settings" ADD COLUMN IF NOT EXISTS "xero_wise_clearing_account_id" VARCHAR(255);
ALTER TABLE "merchant_settings" ADD COLUMN IF NOT EXISTS "wise_profile_id" VARCHAR(255);
