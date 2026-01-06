-- Add UUID defaults to payment core tables
-- Fixes "Argument `id` is missing" errors by ensuring auto-generation

-- Critical: payment_links (primary table for all payments)
ALTER TABLE "payment_links" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- Critical: payment_events (tracks all payment state changes)
ALTER TABLE "payment_events" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- Critical: ledger_accounts and ledger_entries (financial records)
ALTER TABLE "ledger_accounts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "ledger_entries" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- Supporting tables that may be created without explicit IDs
ALTER TABLE "audit_logs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "fx_snapshots" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "merchant_settings" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "organizations" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "xero_connections" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "xero_syncs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "currency_configs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "fx_rate_history" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "fx_rate_overrides" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "currency_display_preferences" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "multi_currency_invoices" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "notification_preferences" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

