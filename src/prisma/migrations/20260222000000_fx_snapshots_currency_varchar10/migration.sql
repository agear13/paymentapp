-- fx_snapshots: base_currency and quote_currency from CHAR(3) to VARCHAR(10)
-- Enables real token codes (HBAR, USDC, USDT, AUDD) and invoice currencies (USD, AUD).
-- Existing indexes remain valid (VARCHAR(10) compatible).

ALTER TABLE "fx_snapshots"
  ALTER COLUMN "base_currency" TYPE VARCHAR(10) USING "base_currency"::VARCHAR(10),
  ALTER COLUMN "quote_currency" TYPE VARCHAR(10) USING "quote_currency"::VARCHAR(10);
