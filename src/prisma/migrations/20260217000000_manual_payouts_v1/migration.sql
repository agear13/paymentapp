-- CreateEnum
CREATE TYPE "PayoutMethodType" AS ENUM ('PAYPAL', 'WISE', 'BANK_TRANSFER', 'CRYPTO', 'MANUAL_NOTE');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutBatchStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CommissionObligationLineStatus" AS ENUM ('POSTED', 'PAID');

-- CreateTable
CREATE TABLE "commission_obligation_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "obligation_id" UUID NOT NULL,
    "payee_user_id" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(18,8) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "CommissionObligationLineStatus" NOT NULL DEFAULT 'POSTED',
    "payout_id" UUID,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_obligation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_methods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "method_type" "PayoutMethodType" NOT NULL,
    "handle" VARCHAR(255),
    "notes" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payout_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_batches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "PayoutBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "payout_count" INTEGER NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "created_by" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "payout_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "payout_method_id" UUID,
    "currency" CHAR(3) NOT NULL,
    "gross_amount" DECIMAL(18,8) NOT NULL,
    "fee_amount" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(18,8) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'DRAFT',
    "external_reference" VARCHAR(255),
    "paid_at" TIMESTAMPTZ(6),
    "failed_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commission_obligation_lines_obligation_id_idx" ON "commission_obligation_lines"("obligation_id");

-- CreateIndex
CREATE INDEX "commission_obligation_lines_payee_user_id_status_idx" ON "commission_obligation_lines"("payee_user_id", "status");

-- CreateIndex
CREATE INDEX "commission_obligation_lines_payout_id_idx" ON "commission_obligation_lines"("payout_id");

-- CreateIndex
CREATE INDEX "payout_methods_organization_id_user_id_idx" ON "payout_methods"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "payout_batches_organization_id_status_idx" ON "payout_batches"("organization_id", "status");

-- CreateIndex
CREATE INDEX "payouts_organization_id_user_id_status_idx" ON "payouts"("organization_id", "user_id", "status");

-- CreateIndex
CREATE INDEX "payouts_batch_id_idx" ON "payouts"("batch_id");

-- AddForeignKey
ALTER TABLE "commission_obligation_lines" ADD CONSTRAINT "commission_obligation_lines_obligation_id_fkey" FOREIGN KEY ("obligation_id") REFERENCES "commission_obligations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_methods" ADD CONSTRAINT "payout_methods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_batches" ADD CONSTRAINT "payout_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "payout_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_payout_method_id_fkey" FOREIGN KEY ("payout_method_id") REFERENCES "payout_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (deferred - add after payouts exists)
ALTER TABLE "commission_obligation_lines" ADD CONSTRAINT "commission_obligation_lines_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill commission_obligation_lines from existing commission_obligations
-- Consultant lines (consultant_amount > 0, get consultant_id from referral_rules)
INSERT INTO "commission_obligation_lines" ("id", "obligation_id", "payee_user_id", "role", "amount", "currency", "status", "created_at")
SELECT
    gen_random_uuid(),
    co.id,
    rr.consultant_id,
    'CONSULTANT',
    co.consultant_amount,
    co.currency,
    'POSTED',
    co.created_at
FROM "commission_obligations" co
JOIN "referral_links" rl ON rl.id = co.referral_link_id
JOIN LATERAL (
    SELECT consultant_id FROM "referral_rules" WHERE referral_link_id = rl.id ORDER BY created_at DESC LIMIT 1
) rr ON rr.consultant_id IS NOT NULL
WHERE co.consultant_amount > 0;

-- BD partner lines (bd_partner_amount > 0, get bd_partner_id from referral_rules)
INSERT INTO "commission_obligation_lines" ("id", "obligation_id", "payee_user_id", "role", "amount", "currency", "status", "created_at")
SELECT
    gen_random_uuid(),
    co.id,
    rr.bd_partner_id,
    'BD_PARTNER',
    co.bd_partner_amount,
    co.currency,
    'POSTED',
    co.created_at
FROM "commission_obligations" co
JOIN "referral_links" rl ON rl.id = co.referral_link_id
JOIN LATERAL (
    SELECT bd_partner_id FROM "referral_rules" WHERE referral_link_id = rl.id ORDER BY created_at DESC LIMIT 1
) rr ON rr.bd_partner_id IS NOT NULL
WHERE co.bd_partner_amount > 0;
