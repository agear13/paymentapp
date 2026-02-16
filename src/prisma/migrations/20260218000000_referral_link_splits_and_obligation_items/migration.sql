-- Generic multi-level revenue share: referral_link_splits + commission_obligation_items
-- Backfill splits from existing referral_rules (Partner 1 = BD, Partner 2 = Consultant)

-- CreateEnum for obligation item status
CREATE TYPE "CommissionObligationItemStatus" AS ENUM ('POSTED', 'PENDING_BENEFICIARY', 'PAID');

-- referral_link_splits: 1-15 partners per link (label, percentage, optional beneficiary_id)
CREATE TABLE "referral_link_splits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "referral_link_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "percentage" DECIMAL(10,4) NOT NULL,
    "beneficiary_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_link_splits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "referral_link_splits_referral_link_id_idx" ON "referral_link_splits"("referral_link_id");

ALTER TABLE "referral_link_splits" ADD CONSTRAINT "referral_link_splits_referral_link_id_fkey"
    FOREIGN KEY ("referral_link_id") REFERENCES "referral_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- commission_obligation_items: one per split at checkout (replaces hard-coded consultant/bd amounts in logic)
CREATE TABLE "commission_obligation_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "commission_obligation_id" UUID NOT NULL,
    "split_id" UUID NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "CommissionObligationItemStatus" NOT NULL DEFAULT 'POSTED',
    "payout_id" UUID,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_obligation_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "commission_obligation_items_commission_obligation_id_idx" ON "commission_obligation_items"("commission_obligation_id");
CREATE INDEX "commission_obligation_items_split_id_idx" ON "commission_obligation_items"("split_id");
CREATE INDEX "commission_obligation_items_payout_id_idx" ON "commission_obligation_items"("payout_id");

ALTER TABLE "commission_obligation_items" ADD CONSTRAINT "commission_obligation_items_commission_obligation_id_fkey"
    FOREIGN KEY ("commission_obligation_id") REFERENCES "commission_obligations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commission_obligation_items" ADD CONSTRAINT "commission_obligation_items_split_id_fkey"
    FOREIGN KEY ("split_id") REFERENCES "referral_link_splits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commission_obligation_items" ADD CONSTRAINT "commission_obligation_items_payout_id_fkey"
    FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill referral_link_splits from referral_rules (Partner 1 = BD, Partner 2 = Consultant)
INSERT INTO "referral_link_splits" ("id", "referral_link_id", "label", "percentage", "beneficiary_id", "sort_order", "created_at")
SELECT
    gen_random_uuid(),
    rr.referral_link_id,
    'Partner 1',
    rr.bd_partner_pct * 100,
    rr.bd_partner_id,
    1,
    rr.created_at
FROM "referral_rules" rr
WHERE rr.bd_partner_pct > 0;

INSERT INTO "referral_link_splits" ("id", "referral_link_id", "label", "percentage", "beneficiary_id", "sort_order", "created_at")
SELECT
    gen_random_uuid(),
    rr.referral_link_id,
    'Partner 2',
    rr.consultant_pct * 100,
    rr.consultant_id,
    2,
    rr.created_at
FROM "referral_rules" rr
WHERE rr.consultant_pct > 0;
