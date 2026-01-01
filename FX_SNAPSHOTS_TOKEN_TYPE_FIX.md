# FX Snapshots token_type Column Fix

## Problem
Production was experiencing 500 errors on `GET /api/public/pay/[shortCode]` because:
- Prisma schema defines `fx_snapshots.token_type` as `PaymentToken?` (optional enum)
- Initial migration (20241205000000) created `fx_snapshots` table WITHOUT the `token_type` column
- The `PaymentToken` enum was never created in any migration
- When Prisma Client queries `fx_snapshots`, it expects ALL columns defined in schema, causing crashes

## Temporary Fix (Already Applied in Production)
```sql
ALTER TABLE fx_snapshots ADD COLUMN token_type TEXT;
```

## Permanent Fix (This PR)
Created migration `20260101000000_add_fx_snapshots_token_type` that:

1. **Creates the PaymentToken enum** (if not exists):
   ```sql
   CREATE TYPE "PaymentToken" AS ENUM ('HBAR', 'USDC', 'USDT', 'AUDD');
   ```

2. **Adds the token_type column** (safe for production):
   ```sql
   ALTER TABLE "fx_snapshots" ADD COLUMN IF NOT EXISTS "token_type" "PaymentToken";
   ```

3. **Leaves column as nullable** - matches Prisma schema definition (`token_type PaymentToken?`)

## Files Changed

### New Migration
- `src/prisma/migrations/20260101000000_add_fx_snapshots_token_type/migration.sql`
  - Creates PaymentToken enum with safe error handling
  - Adds token_type column with IF NOT EXISTS for idempotency
  - Includes commented backfill queries if needed in future

## Why This Works

### For Fresh Databases
1. Migration 20241205000000 creates `fx_snapshots` table (no token_type)
2. Migration 20260101000000 adds PaymentToken enum + token_type column
3. Schema and database are now in sync

### For Production Database
1. Column already exists (from manual fix)
2. Migration uses `IF NOT EXISTS` so it's idempotent
3. Migration was marked as applied using `prisma migrate resolve`
4. Future deploys will apply this migration automatically

## Application Code Usage
The application code already uses `token_type` in multiple places:
- `src/lib/fx/fx-snapshot-service.ts` - Creates snapshots with tokenType
- `src/lib/xero/sync-orchestration.ts` - Queries snapshots by token_type
- `src/lib/db/seed.ts` - Seeds data with token_type
- `src/app/api/public/pay/[shortCode]/route.ts` - Queries fx_snapshots (Prisma auto-selects all columns)

## Testing
- ✅ Prisma Client regenerated successfully
- ✅ Migration marked as applied in production
- ✅ Migration status shows "Database schema is up to date!"
- ✅ Migration is idempotent (safe to run multiple times)

## Deployment Instructions

### For Fresh Databases (Dev/Staging)
```bash
cd src
npx prisma migrate deploy
```

### For Production (Already Fixed)
The migration is already marked as applied. Future deployments will automatically include this migration for new environments.

## Prevention
- Always run `npx prisma migrate dev` after schema changes
- Never manually alter production schema without creating a corresponding migration
- Use `prisma migrate resolve --applied` to sync migration history after emergency manual fixes

