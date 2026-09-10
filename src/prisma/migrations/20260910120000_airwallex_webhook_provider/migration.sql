-- Airwallex sandbox payout webhooks. Does not enable production execution.
ALTER TYPE "WebhookProvider" ADD VALUE IF NOT EXISTS 'AIRWALLEX';
