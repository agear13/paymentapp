-- Project-scoped funding sources (operational treasury coordination; rail-agnostic)

CREATE TYPE "ProjectFundingSourceType" AS ENUM (
  'invoice',
  'payment_link',
  'sponsorship',
  'ticketing',
  'table_booking',
  'manual_forecast',
  'bank_transfer',
  'cash',
  'accounting_sync',
  'other'
);

CREATE TYPE "ProjectFundingSourceStatus" AS ENUM (
  'forecast',
  'pending',
  'confirmed',
  'cleared',
  'reconciled'
);

CREATE TYPE "ProjectFundingConfidenceLevel" AS ENUM (
  'low',
  'medium',
  'high'
);

CREATE TABLE "project_funding_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" VARCHAR(255) NOT NULL,
    "organization_id" UUID,
    "user_id" VARCHAR(255) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source_type" "ProjectFundingSourceType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "status" "ProjectFundingSourceStatus" NOT NULL DEFAULT 'forecast',
    "confidence_level" "ProjectFundingConfidenceLevel" NOT NULL DEFAULT 'medium',
    "expected_settlement_date" TIMESTAMPTZ(6),
    "actual_settlement_date" TIMESTAMPTZ(6),
    "linked_invoice_id" UUID,
    "linked_payment_id" UUID,
    "notes" TEXT,
    "created_by" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_funding_sources_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_funding_sources_project_id_idx" ON "project_funding_sources"("project_id");
CREATE INDEX "project_funding_sources_user_id_project_id_idx" ON "project_funding_sources"("user_id", "project_id");
CREATE INDEX "project_funding_sources_organization_id_project_id_idx" ON "project_funding_sources"("organization_id", "project_id");

ALTER TABLE "project_funding_sources" ADD CONSTRAINT "project_funding_sources_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "deal_network_pilot_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
