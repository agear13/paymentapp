-- Canonical outbound payout-rail fields. Does not change inbound collection rails.

ALTER TYPE "PayoutStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';

ALTER TYPE "WebhookProvider" ADD VALUE IF NOT EXISTS 'HEDERA';
ALTER TYPE "WebhookProvider" ADD VALUE IF NOT EXISTS 'MANUAL';
ALTER TYPE "WebhookProvider" ADD VALUE IF NOT EXISTS 'CREGIS';
ALTER TYPE "WebhookProvider" ADD VALUE IF NOT EXISTS 'STRIPE_TREASURY';

CREATE TYPE "PayoutDestinationKind" AS ENUM ('BANK_ACCOUNT', 'WALLET', 'PLATFORM_HANDLE');

ALTER TABLE "payout_methods" ADD COLUMN IF NOT EXISTS "details" JSONB;

ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "rail_id" VARCHAR(64) NOT NULL DEFAULT 'manual';
ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "destination_kind" "PayoutDestinationKind";
ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(255);
ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "provider_payload" JSONB;

UPDATE "payouts"
SET "idempotency_key" = 'payout:' || "organization_id" || ':' || "id"
WHERE "idempotency_key" IS NULL;

ALTER TABLE "payouts" ALTER COLUMN "idempotency_key" SET NOT NULL;

UPDATE "payouts" AS p
SET
  "rail_id" = 'hedera',
  "destination_kind" = 'WALLET'
FROM "payout_methods" AS m
WHERE p."payout_method_id" = m."id"
  AND m."method_type" = 'HEDERA';

UPDATE "payouts" AS p
SET "destination_kind" = CASE m."method_type"
  WHEN 'BANK_TRANSFER' THEN 'BANK_ACCOUNT'::"PayoutDestinationKind"
  WHEN 'WISE' THEN 'BANK_ACCOUNT'::"PayoutDestinationKind"
  WHEN 'CRYPTO' THEN 'WALLET'::"PayoutDestinationKind"
  WHEN 'HEDERA' THEN 'WALLET'::"PayoutDestinationKind"
  WHEN 'PAYPAL' THEN 'PLATFORM_HANDLE'::"PayoutDestinationKind"
  WHEN 'MANUAL_NOTE' THEN 'PLATFORM_HANDLE'::"PayoutDestinationKind"
  ELSE p."destination_kind"
END
FROM "payout_methods" AS m
WHERE p."payout_method_id" = m."id"
  AND p."destination_kind" IS NULL;

ALTER TABLE "webhook_events" ADD COLUMN IF NOT EXISTS "payout_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "payouts_idempotency_key_key" ON "payouts"("idempotency_key");
CREATE INDEX IF NOT EXISTS "payouts_rail_id_status_idx" ON "payouts"("rail_id", "status");
CREATE INDEX IF NOT EXISTS "webhook_events_payout_id_received_at_idx" ON "webhook_events"("payout_id", "received_at" DESC);

ALTER TABLE "webhook_events"
  DROP CONSTRAINT IF EXISTS "webhook_events_payout_id_fkey";

ALTER TABLE "webhook_events"
  ADD CONSTRAINT "webhook_events_payout_id_fkey"
  FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
