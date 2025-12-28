-- CreateEnum
CREATE TYPE "PaymentLinkStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'EXPIRED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentEventType" AS ENUM ('CREATED', 'OPENED', 'PAYMENT_INITIATED', 'PAYMENT_CONFIRMED', 'PAYMENT_FAILED', 'EXPIRED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('STRIPE', 'HEDERA');

-- CreateEnum
CREATE TYPE "FxSnapshotType" AS ENUM ('CREATION', 'SETTLEMENT');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "XeroSyncType" AS ENUM ('INVOICE', 'PAYMENT');

-- CreateEnum
CREATE TYPE "XeroSyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'RETRYING');

-- CreateTable: organizations
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clerk_org_id" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: merchant_settings
CREATE TABLE "merchant_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "default_currency" CHAR(3) NOT NULL,
    "stripe_account_id" VARCHAR(255),
    "hedera_account_id" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: payment_links
CREATE TABLE "payment_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "short_code" VARCHAR(8) NOT NULL,
    "status" "PaymentLinkStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "description" TEXT NOT NULL,
    "invoice_reference" VARCHAR(255),
    "customer_email" VARCHAR(255),
    "customer_phone" VARCHAR(50),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable: payment_events
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_link_id" UUID NOT NULL,
    "event_type" "PaymentEventType" NOT NULL,
    "payment_method" "PaymentMethod",
    "stripe_payment_intent_id" VARCHAR(255),
    "hedera_transaction_id" VARCHAR(255),
    "amount_received" DECIMAL(18,8),
    "currency_received" CHAR(3),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable: fx_snapshots
CREATE TABLE "fx_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_link_id" UUID NOT NULL,
    "snapshot_type" "FxSnapshotType" NOT NULL,
    "base_currency" CHAR(3) NOT NULL,
    "quote_currency" CHAR(3) NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "provider" VARCHAR(100) NOT NULL,
    "captured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fx_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ledger_accounts
CREATE TABLE "ledger_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "account_type" "LedgerAccountType" NOT NULL,
    "xero_account_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ledger_entries
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_link_id" UUID NOT NULL,
    "ledger_account_id" UUID NOT NULL,
    "entry_type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(18,8) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "description" TEXT NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable: xero_connections
CREATE TABLE "xero_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "tenant_id" VARCHAR(255) NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "connected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xero_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable: xero_syncs
CREATE TABLE "xero_syncs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_link_id" UUID NOT NULL,
    "sync_type" "XeroSyncType" NOT NULL,
    "status" "XeroSyncStatus" NOT NULL,
    "xero_invoice_id" VARCHAR(255),
    "xero_payment_id" VARCHAR(255),
    "request_payload" JSONB NOT NULL,
    "response_payload" JSONB,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xero_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraints
CREATE UNIQUE INDEX "organizations_clerk_org_id_key" ON "organizations"("clerk_org_id");
CREATE UNIQUE INDEX "payment_links_short_code_key" ON "payment_links"("short_code");
CREATE UNIQUE INDEX "ledger_entries_idempotency_key_key" ON "ledger_entries"("idempotency_key");
CREATE UNIQUE INDEX "xero_connections_organization_id_key" ON "xero_connections"("organization_id");
CREATE UNIQUE INDEX "ledger_accounts_organization_id_code_key" ON "ledger_accounts"("organization_id", "code");

-- CreateIndex: Performance indexes
CREATE INDEX "payment_links_organization_id_status_idx" ON "payment_links"("organization_id", "status");
CREATE INDEX "payment_events_payment_link_id_created_at_idx" ON "payment_events"("payment_link_id", "created_at");
CREATE INDEX "xero_syncs_status_next_retry_at_idx" ON "xero_syncs"("status", "next_retry_at");

-- AddForeignKey: merchant_settings
ALTER TABLE "merchant_settings" ADD CONSTRAINT "merchant_settings_organization_id_fkey" 
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: payment_links
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_organization_id_fkey" 
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: payment_events
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_link_id_fkey" 
    FOREIGN KEY ("payment_link_id") REFERENCES "payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: fx_snapshots
ALTER TABLE "fx_snapshots" ADD CONSTRAINT "fx_snapshots_payment_link_id_fkey" 
    FOREIGN KEY ("payment_link_id") REFERENCES "payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ledger_accounts
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_organization_id_fkey" 
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ledger_entries (payment_link)
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_payment_link_id_fkey" 
    FOREIGN KEY ("payment_link_id") REFERENCES "payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ledger_entries (ledger_account)
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_ledger_account_id_fkey" 
    FOREIGN KEY ("ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: xero_connections
ALTER TABLE "xero_connections" ADD CONSTRAINT "xero_connections_organization_id_fkey" 
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: xero_syncs
ALTER TABLE "xero_syncs" ADD CONSTRAINT "xero_syncs_payment_link_id_fkey" 
    FOREIGN KEY ("payment_link_id") REFERENCES "payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;













