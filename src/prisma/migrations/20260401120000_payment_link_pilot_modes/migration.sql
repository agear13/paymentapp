-- Pilot: invoice-only public pages and manual Hedera checkout instructions
ALTER TABLE "payment_links" ADD COLUMN "invoice_only_mode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payment_links" ADD COLUMN "hedera_checkout_mode" VARCHAR(32);
