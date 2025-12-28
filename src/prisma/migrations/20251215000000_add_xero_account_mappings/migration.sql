-- Add Xero Account Mapping Fields to merchant_settings
-- Sprint 12: Xero Integration with Multi-Token Support

-- Add Xero Revenue Account Mapping
ALTER TABLE "merchant_settings" ADD COLUMN IF NOT EXISTS "xero_revenue_account_id" VARCHAR(255);

-- Add Xero Receivable Account Mapping
ALTER TABLE "merchant_settings" ADD COLUMN IF NOT EXISTS "xero_receivable_account_id" VARCHAR(255);

-- Add Xero Stripe Clearing Account Mapping
ALTER TABLE "merchant_settings" ADD COLUMN IF NOT EXISTS "xero_stripe_clearing_account_id" VARCHAR(255);

-- Add Xero HBAR Clearing Account Mapping (Account 1051)
ALTER TABLE "merchant_settings" ADD COLUMN IF NOT EXISTS "xero_hbar_clearing_account_id" VARCHAR(255);

-- Add Xero USDC Clearing Account Mapping (Account 1052)
ALTER TABLE "merchant_settings" ADD COLUMN IF NOT EXISTS "xero_usdc_clearing_account_id" VARCHAR(255);

-- Add Xero USDT Clearing Account Mapping (Account 1053)
ALTER TABLE "merchant_settings" ADD COLUMN IF NOT EXISTS "xero_usdt_clearing_account_id" VARCHAR(255);

-- Add Xero AUDD Clearing Account Mapping (Account 1054) ⭐
ALTER TABLE "merchant_settings" ADD COLUMN IF NOT EXISTS "xero_audd_clearing_account_id" VARCHAR(255);

-- Add Xero Fee Expense Account Mapping
ALTER TABLE "merchant_settings" ADD COLUMN IF NOT EXISTS "xero_fee_expense_account_id" VARCHAR(255);

-- Add updated_at timestamp for tracking mapping changes
ALTER TABLE "merchant_settings" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Add comment explaining the Xero account mappings
COMMENT ON COLUMN "merchant_settings"."xero_revenue_account_id" IS 'Xero account ID for sales revenue from invoices';
COMMENT ON COLUMN "merchant_settings"."xero_receivable_account_id" IS 'Xero account ID for accounts receivable';
COMMENT ON COLUMN "merchant_settings"."xero_stripe_clearing_account_id" IS 'Xero account ID for Stripe payment settlements';
COMMENT ON COLUMN "merchant_settings"."xero_hbar_clearing_account_id" IS 'Xero account ID for HBAR cryptocurrency settlements (typically mapped to account 1051)';
COMMENT ON COLUMN "merchant_settings"."xero_usdc_clearing_account_id" IS 'Xero account ID for USDC stablecoin settlements (typically mapped to account 1052)';
COMMENT ON COLUMN "merchant_settings"."xero_usdt_clearing_account_id" IS 'Xero account ID for USDT stablecoin settlements (typically mapped to account 1053)';
COMMENT ON COLUMN "merchant_settings"."xero_audd_clearing_account_id" IS 'Xero account ID for AUDD (Australian Digital Dollar) stablecoin settlements (typically mapped to account 1054)';
COMMENT ON COLUMN "merchant_settings"."xero_fee_expense_account_id" IS 'Xero account ID for payment processing fee expenses';






