-- AlterTable: Add UUID defaults to core models
-- These changes ensure all UUID primary keys auto-generate when not explicitly provided

-- Core models
ALTER TABLE "audit_logs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "fx_snapshots" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "merchant_settings" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "organizations" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "payment_links" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "xero_connections" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "xero_syncs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- Notification models
ALTER TABLE "notifications" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "email_logs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "notification_preferences" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- Multi-currency models
ALTER TABLE "currency_configs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "fx_rate_history" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "fx_rate_overrides" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "currency_display_preferences" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "multi_currency_invoices" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

