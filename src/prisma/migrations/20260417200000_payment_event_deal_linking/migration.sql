-- Payment event ↔ Deal Network pilot linkage (additive only).
-- Does not drop or truncate tables. Does not modify payment_links rows.
-- payment_link_id becomes nullable so manual / CSV-sourced events can exist without a link.

CREATE TYPE "PaymentEventSourceType" AS ENUM (
  'PAYMENT_LINK',
  'STRIPE',
  'CRYPTO',
  'WISE',
  'MANUAL',
  'CSV_IMPORT'
);

CREATE TYPE "PaymentEventRecordStatus" AS ENUM (
  'RECORDED',
  'PENDING_REVIEW',
  'VOIDED'
);

ALTER TABLE "payment_events" ADD COLUMN IF NOT EXISTS "organization_id" UUID;
ALTER TABLE "payment_events" ADD COLUMN IF NOT EXISTS "pilot_deal_id" VARCHAR(255);
ALTER TABLE "payment_events" ADD COLUMN IF NOT EXISTS "source_type" "PaymentEventSourceType";
ALTER TABLE "payment_events" ADD COLUMN IF NOT EXISTS "source_reference" VARCHAR(512);
ALTER TABLE "payment_events" ADD COLUMN IF NOT EXISTS "gross_amount" DECIMAL(18,8);
ALTER TABLE "payment_events" ADD COLUMN IF NOT EXISTS "net_amount" DECIMAL(18,8);
ALTER TABLE "payment_events" ADD COLUMN IF NOT EXISTS "received_at" TIMESTAMPTZ(6);
ALTER TABLE "payment_events" ADD COLUMN IF NOT EXISTS "record_status" "PaymentEventRecordStatus";
ALTER TABLE "payment_events" ADD COLUMN IF NOT EXISTS "raw_payload_json" JSONB;
ALTER TABLE "payment_events" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6);

UPDATE "payment_events" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;

ALTER TABLE "payment_events" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "payment_events" ALTER COLUMN "updated_at" SET NOT NULL;

ALTER TABLE "payment_events" ALTER COLUMN "payment_link_id" DROP NOT NULL;

UPDATE "payment_events" pe
SET "organization_id" = pl."organization_id"
FROM "payment_links" pl
WHERE pe."payment_link_id" = pl."id"
  AND pe."organization_id" IS NULL;

UPDATE "payment_events"
SET "source_type" = CASE
  WHEN "stripe_event_id" IS NOT NULL THEN 'STRIPE'::"PaymentEventSourceType"
  WHEN "hedera_transaction_id" IS NOT NULL THEN 'CRYPTO'::"PaymentEventSourceType"
  WHEN "wise_transfer_id" IS NOT NULL THEN 'WISE'::"PaymentEventSourceType"
  WHEN "payment_link_id" IS NOT NULL THEN 'PAYMENT_LINK'::"PaymentEventSourceType"
  ELSE NULL
END
WHERE "source_type" IS NULL;

UPDATE "payment_events"
SET "received_at" = "created_at"
WHERE "event_type" = 'PAYMENT_CONFIRMED' AND "received_at" IS NULL;

UPDATE "payment_events"
SET "gross_amount" = "amount_received"
WHERE "gross_amount" IS NULL AND "amount_received" IS NOT NULL;

UPDATE "payment_events"
SET "record_status" = 'RECORDED'::"PaymentEventRecordStatus"
WHERE "record_status" IS NULL AND "event_type" = 'PAYMENT_CONFIRMED';

ALTER TABLE "payment_events"
  ADD CONSTRAINT "payment_events_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_events"
  ADD CONSTRAINT "payment_events_pilot_deal_id_fkey"
  FOREIGN KEY ("pilot_deal_id") REFERENCES "deal_network_pilot_deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "payment_events_pilot_deal_id_idx" ON "payment_events"("pilot_deal_id");
CREATE INDEX IF NOT EXISTS "payment_events_organization_id_idx" ON "payment_events"("organization_id");
CREATE INDEX IF NOT EXISTS "payment_events_source_type_idx" ON "payment_events"("source_type");

ALTER TABLE "deal_network_pilot_obligations"
  ADD CONSTRAINT "deal_network_pilot_obligations_payment_event_id_fkey"
  FOREIGN KEY ("payment_event_id") REFERENCES "payment_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TYPE "DealNetworkPilotObligationStatus" ADD VALUE 'UNFUNDED';
