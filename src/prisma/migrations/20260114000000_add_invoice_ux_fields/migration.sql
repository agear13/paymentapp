-- AlterTable: Add new invoice UX fields to payment_links
ALTER TABLE "payment_links" 
  ADD COLUMN "customer_name" VARCHAR(255),
  ADD COLUMN "due_date" TIMESTAMPTZ(6),
  ADD COLUMN "xero_invoice_number" VARCHAR(255);

-- AlterTable: Add organization logo to merchant_settings
ALTER TABLE "merchant_settings" 
  ADD COLUMN "organization_logo_url" VARCHAR(1024);

-- CreateIndex: Add indexes for date filtering
CREATE INDEX "payment_links_due_date_idx" ON "payment_links"("due_date");
CREATE INDEX "payment_links_expires_at_idx" ON "payment_links"("expires_at");

