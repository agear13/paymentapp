-- CreateEnum
CREATE TYPE "TreasuryEventType" AS ENUM ('CUSTOMER_PAYMENT', 'ASSET_RECEIVED', 'WALLET_TRANSFER', 'EXCHANGE_DEPOSIT', 'CONVERSION', 'FIAT_CREDIT', 'BANK_SETTLEMENT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TreasuryEventStatus" AS ENUM ('CONFIRMED', 'INFERRED', 'UNKNOWN', 'EXCEPTION');

-- CreateEnum
CREATE TYPE "TreasuryLinkType" AS ENUM ('PARENT_CHILD', 'CORRELATION', 'MANUAL');

-- CreateTable
CREATE TABLE "treasury_integration_connections" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "encrypted_api_key" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "last_sync_at" TIMESTAMPTZ(6),
    "last_sync_error" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "treasury_integration_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_type" "TreasuryEventType" NOT NULL,
    "status" "TreasuryEventStatus" NOT NULL DEFAULT 'CONFIRMED',
    "provider" VARCHAR(64) NOT NULL,
    "provider_reference" VARCHAR(512) NOT NULL,
    "asset" VARCHAR(32),
    "destination_asset" VARCHAR(32),
    "amount" DECIMAL(18,8),
    "destination_amount" DECIMAL(18,8),
    "exchange_rate" DECIMAL(18,8),
    "fee_amount" DECIMAL(18,8),
    "fee_currency" VARCHAR(32),
    "source_address" VARCHAR(128),
    "destination_address" VARCHAR(128),
    "wallet_network" VARCHAR(64),
    "transaction_hash" VARCHAR(128),
    "payment_link_id" UUID,
    "payment_event_id" UUID,
    "parent_treasury_event_id" UUID,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "metadata" JSONB,
    "raw_provider_payload" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treasury_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_event_links" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "source_event_id" UUID NOT NULL,
    "target_event_id" UUID NOT NULL,
    "link_type" "TreasuryLinkType" NOT NULL,
    "link_status" "TreasuryEventStatus" NOT NULL DEFAULT 'CONFIRMED',
    "created_by_user_id" VARCHAR(255),
    "evidence" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treasury_event_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_manual_reconciliations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "source_event_id" UUID NOT NULL,
    "target_event_id" UUID NOT NULL,
    "linked_by_user_id" VARCHAR(255) NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previous_status" "TreasuryEventStatus" NOT NULL,
    "new_status" "TreasuryEventStatus" NOT NULL,
    "evidence" JSONB NOT NULL,
    "notes" TEXT,

    CONSTRAINT "treasury_manual_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ux_treasury_connections_org_provider" ON "treasury_integration_connections"("organization_id", "provider");

-- CreateIndex
CREATE INDEX "treasury_integration_connections_organization_id_idx" ON "treasury_integration_connections"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_treasury_events_idempotency" ON "treasury_events"("organization_id", "provider", "provider_reference", "event_type");

-- CreateIndex
CREATE INDEX "treasury_events_organization_id_transaction_hash_idx" ON "treasury_events"("organization_id", "transaction_hash");

-- CreateIndex
CREATE INDEX "treasury_events_organization_id_payment_link_id_idx" ON "treasury_events"("organization_id", "payment_link_id");

-- CreateIndex
CREATE INDEX "treasury_events_organization_id_payment_event_id_idx" ON "treasury_events"("organization_id", "payment_event_id");

-- CreateIndex
CREATE INDEX "treasury_events_organization_id_occurred_at_idx" ON "treasury_events"("organization_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "treasury_events_organization_id_event_type_idx" ON "treasury_events"("organization_id", "event_type");

-- CreateIndex
CREATE INDEX "treasury_events_parent_treasury_event_id_idx" ON "treasury_events"("parent_treasury_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_treasury_event_links_pair" ON "treasury_event_links"("source_event_id", "target_event_id", "link_type");

-- CreateIndex
CREATE INDEX "treasury_event_links_organization_id_idx" ON "treasury_event_links"("organization_id");

-- CreateIndex
CREATE INDEX "treasury_event_links_source_event_id_idx" ON "treasury_event_links"("source_event_id");

-- CreateIndex
CREATE INDEX "treasury_event_links_target_event_id_idx" ON "treasury_event_links"("target_event_id");

-- CreateIndex
CREATE INDEX "treasury_manual_reconciliations_organization_id_linked_at_idx" ON "treasury_manual_reconciliations"("organization_id", "linked_at" DESC);

-- CreateIndex
CREATE INDEX "treasury_manual_reconciliations_source_event_id_idx" ON "treasury_manual_reconciliations"("source_event_id");

-- CreateIndex
CREATE INDEX "treasury_manual_reconciliations_target_event_id_idx" ON "treasury_manual_reconciliations"("target_event_id");

-- AddForeignKey
ALTER TABLE "treasury_integration_connections" ADD CONSTRAINT "treasury_integration_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_events" ADD CONSTRAINT "treasury_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_events" ADD CONSTRAINT "treasury_events_payment_link_id_fkey" FOREIGN KEY ("payment_link_id") REFERENCES "payment_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_events" ADD CONSTRAINT "treasury_events_payment_event_id_fkey" FOREIGN KEY ("payment_event_id") REFERENCES "payment_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_events" ADD CONSTRAINT "treasury_events_parent_treasury_event_id_fkey" FOREIGN KEY ("parent_treasury_event_id") REFERENCES "treasury_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_event_links" ADD CONSTRAINT "treasury_event_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_event_links" ADD CONSTRAINT "treasury_event_links_source_event_id_fkey" FOREIGN KEY ("source_event_id") REFERENCES "treasury_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_event_links" ADD CONSTRAINT "treasury_event_links_target_event_id_fkey" FOREIGN KEY ("target_event_id") REFERENCES "treasury_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_manual_reconciliations" ADD CONSTRAINT "treasury_manual_reconciliations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_manual_reconciliations" ADD CONSTRAINT "treasury_manual_reconciliations_source_event_id_fkey" FOREIGN KEY ("source_event_id") REFERENCES "treasury_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_manual_reconciliations" ADD CONSTRAINT "treasury_manual_reconciliations_target_event_id_fkey" FOREIGN KEY ("target_event_id") REFERENCES "treasury_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
