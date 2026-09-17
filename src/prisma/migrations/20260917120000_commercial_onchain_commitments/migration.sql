-- Isolated X Layer on-chain commitment records. Does not alter extraction or off-chain lifecycle.

CREATE TABLE "commercial_onchain_commitments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "source_agreement_id" UUID NOT NULL,
    "pilot_deal_id" VARCHAR(255),
    "display_commitment_id" VARCHAR(16) NOT NULL,
    "onchain_commitment_id" VARCHAR(66) NOT NULL,
    "buyer_label" VARCHAR(120) NOT NULL,
    "supplier_label" VARCHAR(120) NOT NULL,
    "amount_minor_units" BIGINT NOT NULL,
    "source_currency" VARCHAR(8) NOT NULL,
    "settlement_currency" VARCHAR(8) NOT NULL,
    "due_date" TIMESTAMPTZ(6),
    "purpose" VARCHAR(120) NOT NULL,
    "terms_hash" VARCHAR(66) NOT NULL,
    "offchain_lifecycle_stage" VARCHAR(64),
    "onchain_status" VARCHAR(32),
    "verification_status" VARCHAR(32) NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "contract_address" VARCHAR(42) NOT NULL,
    "wallet_address" VARCHAR(42),
    "transaction_hash" VARCHAR(66),
    "block_number" BIGINT,
    "explorer_url" VARCHAR(512),
    "original_due_label" VARCHAR(120),
    "incentive_snapshot" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" VARCHAR(255) NOT NULL,

    CONSTRAINT "commercial_onchain_commitments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ux_onchain_commitments_org_agreement_chain"
  ON "commercial_onchain_commitments"("organization_id", "source_agreement_id", "chain_id");

CREATE UNIQUE INDEX "commercial_onchain_commitments_transaction_hash_key"
  ON "commercial_onchain_commitments"("transaction_hash");

CREATE INDEX "commercial_onchain_commitments_organization_id_idx"
  ON "commercial_onchain_commitments"("organization_id");

CREATE INDEX "commercial_onchain_commitments_source_agreement_id_idx"
  ON "commercial_onchain_commitments"("source_agreement_id");

CREATE INDEX "commercial_onchain_commitments_verification_status_idx"
  ON "commercial_onchain_commitments"("verification_status");

ALTER TABLE "commercial_onchain_commitments"
  ADD CONSTRAINT "commercial_onchain_commitments_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "commercial_onchain_commitments"
  ADD CONSTRAINT "commercial_onchain_commitments_source_agreement_id_fkey"
  FOREIGN KEY ("source_agreement_id") REFERENCES "organization_workflow_agreements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
