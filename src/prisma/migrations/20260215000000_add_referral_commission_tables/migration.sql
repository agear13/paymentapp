-- CreateEnum
CREATE TYPE "ReferralLinkStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CommissionBasis" AS ENUM ('GROSS', 'NET');

-- CreateEnum
CREATE TYPE "CommissionObligationStatus" AS ENUM ('CREATED', 'POSTED', 'FAILED');

-- CreateTable
CREATE TABLE "referral_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "created_by_user_id" VARCHAR(255),
    "code" VARCHAR(50) NOT NULL,
    "status" "ReferralLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "checkout_config" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "referral_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "referral_link_id" UUID NOT NULL,
    "consultant_id" UUID NOT NULL,
    "bd_partner_id" UUID,
    "consultant_pct" DECIMAL(5,4) NOT NULL,
    "bd_partner_pct" DECIMAL(5,4) NOT NULL,
    "basis" "CommissionBasis" NOT NULL DEFAULT 'GROSS',
    "min_cap" DECIMAL(18,2),
    "max_cap" DECIMAL(18,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_obligations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_link_id" UUID NOT NULL,
    "referral_link_id" UUID NOT NULL,
    "stripe_event_id" VARCHAR(255) NOT NULL,
    "consultant_amount" DECIMAL(18,8) NOT NULL,
    "bd_partner_amount" DECIMAL(18,8) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "CommissionObligationStatus" NOT NULL DEFAULT 'CREATED',
    "correlation_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_obligations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referral_links_code_key" ON "referral_links"("code");

-- CreateIndex
CREATE INDEX "referral_links_organization_id_idx" ON "referral_links"("organization_id");

-- CreateIndex
CREATE INDEX "referral_links_code_idx" ON "referral_links"("code");

-- CreateIndex
CREATE INDEX "referral_links_status_idx" ON "referral_links"("status");

-- CreateIndex
CREATE INDEX "referral_rules_referral_link_id_idx" ON "referral_rules"("referral_link_id");

-- CreateIndex
CREATE INDEX "commission_obligations_payment_link_id_idx" ON "commission_obligations"("payment_link_id");

-- CreateIndex
CREATE INDEX "commission_obligations_referral_link_id_idx" ON "commission_obligations"("referral_link_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_obligations_stripe_event_id_unique" ON "commission_obligations"("stripe_event_id");

-- CreateIndex
CREATE INDEX "commission_obligations_stripe_event_id_idx" ON "commission_obligations"("stripe_event_id");

-- CreateIndex
CREATE INDEX "commission_obligations_status_idx" ON "commission_obligations"("status");

-- AddForeignKey
ALTER TABLE "referral_links" ADD CONSTRAINT "referral_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_rules" ADD CONSTRAINT "referral_rules_referral_link_id_fkey" FOREIGN KEY ("referral_link_id") REFERENCES "referral_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_obligations" ADD CONSTRAINT "commission_obligations_payment_link_id_fkey" FOREIGN KEY ("payment_link_id") REFERENCES "payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_obligations" ADD CONSTRAINT "commission_obligations_referral_link_id_fkey" FOREIGN KEY ("referral_link_id") REFERENCES "referral_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
