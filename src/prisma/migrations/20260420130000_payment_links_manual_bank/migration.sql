ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'MANUAL_BANK';

ALTER TABLE "payment_links"
ADD COLUMN "manual_bank_recipient_name" VARCHAR(255),
ADD COLUMN "manual_bank_currency" VARCHAR(16),
ADD COLUMN "manual_bank_destination_type" VARCHAR(64),
ADD COLUMN "manual_bank_bank_name" VARCHAR(255),
ADD COLUMN "manual_bank_account_number" VARCHAR(128),
ADD COLUMN "manual_bank_iban" VARCHAR(128),
ADD COLUMN "manual_bank_swift_bic" VARCHAR(64),
ADD COLUMN "manual_bank_routing_sort_code" VARCHAR(64),
ADD COLUMN "manual_bank_wise_reference" VARCHAR(255),
ADD COLUMN "manual_bank_revolut_handle" VARCHAR(255),
ADD COLUMN "manual_bank_instructions" TEXT;

CREATE TABLE "manual_bank_payment_confirmations" (
  "id" UUID NOT NULL,
  "payment_link_id" UUID NOT NULL,
  "status" "CryptoPaymentConfirmationStatus" NOT NULL DEFAULT 'PENDING',
  "payer_amount_sent" VARCHAR(64) NOT NULL,
  "payer_currency" VARCHAR(16),
  "payer_destination" VARCHAR(255),
  "payer_payment_method_used" VARCHAR(128),
  "payer_reference" VARCHAR(255),
  "payer_proof_details" TEXT,
  "payer_note" TEXT,
  "verification_status" "CryptoVerificationStatus",
  "match_confidence" "MatchConfidence",
  "verification_issues" JSONB NOT NULL DEFAULT '[]',
  "merchant_acknowledged_at" TIMESTAMPTZ(6),
  "merchant_investigation_flag" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMPTZ(6),
  CONSTRAINT "manual_bank_payment_confirmations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "manual_bank_payment_confirmations"
ADD CONSTRAINT "manual_bank_payment_confirmations_payment_link_id_fkey"
FOREIGN KEY ("payment_link_id") REFERENCES "payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "manual_bank_payment_confirmations_payment_link_id_status_idx"
ON "manual_bank_payment_confirmations"("payment_link_id", "status");

CREATE INDEX "manual_bank_payment_confirmations_status_created_at_idx"
ON "manual_bank_payment_confirmations"("status", "created_at");
