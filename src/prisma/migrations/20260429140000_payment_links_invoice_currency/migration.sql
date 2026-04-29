-- Accounting currency for invoices (decoupled from payment settlement rail).
-- Backfill from legacy `currency` then enforce NOT NULL.

ALTER TABLE "payment_links" ADD COLUMN "invoice_currency" CHAR(3);

UPDATE "payment_links"
SET "invoice_currency" = TRIM(UPPER("currency"))
WHERE "invoice_currency" IS NULL;

ALTER TABLE "payment_links" ALTER COLUMN "invoice_currency" SET NOT NULL;
