-- CreateEnum
CREATE TYPE "WebhookProvider" AS ENUM ('STRIPE');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'DUPLICATE', 'IGNORED', 'ERROR');

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" "WebhookProvider" NOT NULL,
    "provider_event_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(128) NOT NULL,
    "livemode" BOOLEAN NOT NULL DEFAULT false,
    "api_version" VARCHAR(32),
    "request_id" VARCHAR(255),
    "signature_present" BOOLEAN NOT NULL DEFAULT false,
    "signature_header" VARCHAR(512),
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "last_error_at" TIMESTAMPTZ(6),
    "duration_ms" INTEGER,
    "raw_body" TEXT NOT NULL,
    "headers" JSONB,
    "parsed_event" JSONB,
    "correlation_id" VARCHAR(255),
    "organization_id" UUID,
    "payment_link_id" UUID,
    "stripe_payment_intent_id" VARCHAR(255),
    "stripe_charge_id" VARCHAR(255),
    "stripe_refund_id" VARCHAR(255),

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ux_webhook_events_provider_event_id" ON "webhook_events"("provider", "provider_event_id");

-- CreateIndex
CREATE INDEX "webhook_events_provider_status_received_at_idx" ON "webhook_events"("provider", "status", "received_at" DESC);

-- CreateIndex
CREATE INDEX "webhook_events_payment_link_id_received_at_idx" ON "webhook_events"("payment_link_id", "received_at" DESC);

-- CreateIndex
CREATE INDEX "webhook_events_organization_id_received_at_idx" ON "webhook_events"("organization_id", "received_at" DESC);

-- CreateIndex
CREATE INDEX "webhook_events_stripe_payment_intent_id_idx" ON "webhook_events"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "webhook_events_stripe_refund_id_idx" ON "webhook_events"("stripe_refund_id");
