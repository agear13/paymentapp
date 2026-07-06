ALTER TABLE "merchant_settings" ADD COLUMN IF NOT EXISTS "evm_wallet_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "merchant_settings" ADD COLUMN IF NOT EXISTS "evm_supported_networks" TEXT[] NOT NULL DEFAULT ARRAY['base', 'ethereum', 'polygon'];
ALTER TABLE "merchant_settings" ADD COLUMN IF NOT EXISTS "evm_supported_tokens" TEXT[] NOT NULL DEFAULT ARRAY['USDC', 'USDT'];

UPDATE "merchant_settings"
SET "evm_wallet_enabled" = true
WHERE "evm_wallet_address" IS NOT NULL
  AND trim("evm_wallet_address") <> '';
