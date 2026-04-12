-- Generic manual crypto payment method + payer confirmation workflow (Payment Links only)

-- Prisma enum: add CRYPTO to PaymentMethod
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CRYPTO';

-- New enum for confirmation rows
CREATE TYPE "CryptoPaymentConfirmationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "payment_links"
  ADD COLUMN IF NOT EXISTS "crypto_network" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "crypto_address" VARCHAR(512),
  ADD COLUMN IF NOT EXISTS "crypto_currency" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "crypto_memo" VARCHAR(512),
  ADD COLUMN IF NOT EXISTS "crypto_instructions" TEXT;

CREATE TABLE "crypto_payment_confirmations" (
    "id" UUID NOT NULL,
    "payment_link_id" UUID NOT NULL,
    "status" "CryptoPaymentConfirmationStatus" NOT NULL DEFAULT 'PENDING',
    "payer_network" VARCHAR(255) NOT NULL,
    "payer_amount_sent" VARCHAR(64) NOT NULL,
    "payer_wallet_address" VARCHAR(512) NOT NULL,
    "payer_tx_hash" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(6),

    CONSTRAINT "crypto_payment_confirmations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crypto_payment_confirmations_payment_link_id_status_idx" ON "crypto_payment_confirmations"("payment_link_id", "status");
CREATE INDEX "crypto_payment_confirmations_status_created_at_idx" ON "crypto_payment_confirmations"("status", "created_at");

ALTER TABLE "crypto_payment_confirmations" ADD CONSTRAINT "crypto_payment_confirmations_payment_link_id_fkey" FOREIGN KEY ("payment_link_id") REFERENCES "payment_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
