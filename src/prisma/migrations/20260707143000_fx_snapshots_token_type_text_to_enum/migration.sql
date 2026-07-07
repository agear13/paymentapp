-- Fix production drift: fx_snapshots.token_type was manually added as TEXT
-- (see FX_SNAPSHOTS_TOKEN_TYPE_FIX.md) while Prisma expects PaymentToken enum.
-- Migration 20260101000000 used ADD COLUMN IF NOT EXISTS, which skipped conversion
-- when the TEXT column already existed → "operator does not exist: text = PaymentToken".

DO $$ BEGIN
    CREATE TYPE "PaymentToken" AS ENUM ('HBAR', 'USDC', 'USDT', 'AUDD');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
DECLARE
  col_udt text;
BEGIN
  SELECT c.udt_name
  INTO col_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'fx_snapshots'
    AND c.column_name = 'token_type';

  IF col_udt IS NULL THEN
    ALTER TABLE "fx_snapshots"
      ADD COLUMN "token_type" "PaymentToken";
  ELSIF col_udt IN ('text', 'varchar', 'bpchar') THEN
    UPDATE "fx_snapshots"
    SET "token_type" = NULL
    WHERE "token_type" IS NOT NULL
      AND btrim("token_type"::text) NOT IN ('HBAR', 'USDC', 'USDT', 'AUDD');

    ALTER TABLE "fx_snapshots"
      ALTER COLUMN "token_type" TYPE "PaymentToken"
      USING (
        CASE
          WHEN "token_type" IS NULL OR btrim("token_type"::text) = '' THEN NULL
          ELSE btrim("token_type"::text)::"PaymentToken"
        END
      );
  END IF;
END $$;
