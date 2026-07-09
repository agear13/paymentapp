-- Persist Xero Cash Customer contact ID per merchant to avoid duplicate contacts.
ALTER TABLE "merchant_settings"
  ADD COLUMN IF NOT EXISTS "xero_cash_customer_contact_id" VARCHAR(255);
