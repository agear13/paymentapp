-- Payment Lifecycle & Settlement Engine (additive)

CREATE TYPE "PaymentLifecycleStage" AS ENUM (
  'INVOICE_CREATED',
  'CUSTOMER_OPENED_LINK',
  'PAYMENT_REQUESTED',
  'PAYMENT_DETECTED',
  'PAYMENT_CONFIRMED',
  'BLOCKCHAIN_CONFIRMED',
  'FX_SNAPSHOT_LOCKED',
  'LEDGER_UPDATED',
  'ACCOUNTING_SYNC_STARTED',
  'ACCOUNTING_SYNC_COMPLETED',
  'ACCOUNTING_SYNC_FAILED',
  'SETTLEMENT_PENDING',
  'SETTLEMENT_IN_PROGRESS',
  'SETTLEMENT_COMPLETED',
  'RECONCILED',
  'COMPLETED'
);

CREATE TYPE "PaymentSettlementStatus" AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'SETTLED',
  'FAILED',
  'RECONCILED'
);

CREATE TABLE "payment_lifecycle_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payment_link_id" UUID NOT NULL,
  "payment_event_id" UUID,
  "organization_id" UUID NOT NULL,
  "stage" "PaymentLifecycleStage" NOT NULL,
  "actor" VARCHAR(255),
  "provider" VARCHAR(64),
  "idempotency_key" VARCHAR(512) NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payment_lifecycle_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_lifecycle_events_link_idempotency_key"
  ON "payment_lifecycle_events"("payment_link_id", "idempotency_key");

CREATE INDEX "payment_lifecycle_events_link_created_idx"
  ON "payment_lifecycle_events"("payment_link_id", "created_at");

CREATE INDEX "payment_lifecycle_events_payment_event_idx"
  ON "payment_lifecycle_events"("payment_event_id");

CREATE INDEX "payment_lifecycle_events_organization_idx"
  ON "payment_lifecycle_events"("organization_id");

ALTER TABLE "payment_lifecycle_events"
  ADD CONSTRAINT "payment_lifecycle_events_payment_link_id_fkey"
  FOREIGN KEY ("payment_link_id") REFERENCES "payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_lifecycle_events"
  ADD CONSTRAINT "payment_lifecycle_events_payment_event_id_fkey"
  FOREIGN KEY ("payment_event_id") REFERENCES "payment_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_lifecycle_events"
  ADD CONSTRAINT "payment_lifecycle_events_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payment_settlements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payment_link_id" UUID NOT NULL,
  "payment_event_id" UUID,
  "organization_id" UUID NOT NULL,
  "status" "PaymentSettlementStatus" NOT NULL DEFAULT 'PENDING',
  "currency" VARCHAR(10) NOT NULL,
  "amount" DECIMAL(18,8) NOT NULL,
  "destination" VARCHAR(512),
  "settled_at" TIMESTAMPTZ(6),
  "reference" VARCHAR(512),
  "provider" VARCHAR(64),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payment_settlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_settlements_payment_event_id_key"
  ON "payment_settlements"("payment_event_id")
  WHERE "payment_event_id" IS NOT NULL;

CREATE INDEX "payment_settlements_link_status_idx"
  ON "payment_settlements"("payment_link_id", "status");

ALTER TABLE "payment_settlements"
  ADD CONSTRAINT "payment_settlements_payment_link_id_fkey"
  FOREIGN KEY ("payment_link_id") REFERENCES "payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_settlements"
  ADD CONSTRAINT "payment_settlements_payment_event_id_fkey"
  FOREIGN KEY ("payment_event_id") REFERENCES "payment_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_settlements"
  ADD CONSTRAINT "payment_settlements_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
