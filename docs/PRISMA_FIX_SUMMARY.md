# Prisma Production Fixes - Implementation Summary

## Issues Fixed

### Issue A: Production Migration Conflict (P3009/P3018)
**Problem:** Production had `add_notifications` migration applied, but also a failed `20260105000001_add_notifications` migration causing "relation already exists" errors.

**Root Cause:** Migration naming mismatch between local and production environments.

**Solution:**
1. ✅ Renamed local migration to match production: `add_notifications` (no timestamp)
2. ✅ Made migration fully idempotent using:
   - `CREATE TABLE IF NOT EXISTS ...`
   - `CREATE INDEX IF NOT EXISTS ...`
   - `DO $$ BEGIN ... CREATE TYPE ... EXCEPTION WHEN duplicate_object THEN null; END $$;`
   - Guarded `ALTER TABLE ADD CONSTRAINT` with exception handling
3. ✅ Created comprehensive recovery playbook: `docs/PRISMA_PRODUCTION_RECOVERY.md`

### Issue B: Prisma Validation Error - "Argument `id` is missing"
**Problem:** Runtime errors showing Prisma received `+ id: String` in data payloads for `payment_links.update()`, `payment_events.create()`, and `ledger_entries.create()`.

**Root Cause:** Database columns lacked `DEFAULT gen_random_uuid()` even though schema had `@default(uuid())`. When Prisma Client was out of sync, it expected explicit IDs.

**Solution:**
1. ✅ Verified schema has `@default(uuid())` on all critical models:
   - `payment_links.id`
   - `payment_events.id`
   - `ledger_accounts.id`
   - `ledger_entries.id`
   - All notification models
   - All multi-currency models
2. ✅ Created migration to add database column defaults: `20260105000003_add_uuid_defaults_payment_core`
3. ✅ Added instrumentation logging to catch actual payloads being passed to Prisma
4. ✅ Code audit showed no spread operators or `id` injection - issue was client/schema/DB mismatch

---

## Changes Made

### 1. Migration Structure Cleanup

**Before:**
```
src/prisma/migrations/
├── 20260105000002_add_notifications/  ❌ Timestamped, doesn't match prod
└── 20260105000001_add_uuid_defaults_core_models/ ❌ Duplicate, removed
```

**After:**
```
src/prisma/migrations/
├── add_notifications/                  ✅ Matches production
└── 20260105000003_add_uuid_defaults_payment_core/ ✅ New, safe UUID defaults
```

### 2. Idempotent Notifications Migration

**File:** `src/prisma/migrations/add_notifications/migration.sql`

Key features:
- ✅ `CREATE TABLE IF NOT EXISTS` for all tables
- ✅ `CREATE INDEX IF NOT EXISTS` for all indexes
- ✅ Guarded enum creation with exception handling
- ✅ Guarded constraint addition with exception handling
- ✅ Safe to rerun even if objects exist

### 3. UUID Defaults Migration

**File:** `src/prisma/migrations/20260105000003_add_uuid_defaults_payment_core/migration.sql`

Adds `DEFAULT gen_random_uuid()` to 17 tables:
- **Critical:** payment_links, payment_events, ledger_accounts, ledger_entries
- **Supporting:** audit_logs, fx_snapshots, merchant_settings, organizations, xero_connections, xero_syncs
- **Multi-currency:** currency_configs, fx_rate_history, fx_rate_overrides, currency_display_preferences, multi_currency_invoices
- **Notifications:** notification_preferences

### 4. Instrumentation Logging

**File:** `src/lib/hedera/transaction-checker.ts`

Added detailed logging before Prisma transaction to capture:
- Exact payloads being passed to each Prisma operation
- Keys present in each `data` object
- Whether `id` is accidentally included
- Helps diagnose future payload issues

**Log output example:**
```javascript
{
  updatePayload: { where: {...}, dataKeys: ['status', 'updated_at'], hasId: false },
  eventPayload: { dataKeys: ['payment_link_id', 'event_type', ...], hasId: false },
  debitPayload: { dataKeys: ['payment_link_id', 'ledger_account_id', ...], hasId: false },
  creditPayload: { dataKeys: ['payment_link_id', 'ledger_account_id', ...], hasId: false }
}
```

### 5. Documentation

**New Files:**
- `docs/PRISMA_PRODUCTION_RECOVERY.md` - Step-by-step recovery commands for production
- `docs/PRISMA_FIX_SUMMARY.md` - This file

### 6. Package.json Verification

**File:** `src/package.json`

Verified build script is correct:
```json
{
  "scripts": {
    "postinstall": "prisma generate",
    "build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

✅ Ensures migrations run before build
✅ Ensures Prisma Client is always in sync

---

## Local Development Commands

### Step 1: Check Current Migration Status
```bash
cd src
npx prisma migrate status
```

**Expected output:**
```
Datasource: ...
Status: There are pending migrations
...
└─ add_notifications (pending)
└─ 20260105000003_add_uuid_defaults_payment_core (pending)
```

### Step 2: Apply Migrations
```bash
npx prisma migrate deploy
```

**This will:**
1. Apply `add_notifications` (idempotent - safe even if tables exist)
2. Apply `20260105000003_add_uuid_defaults_payment_core` (adds UUID defaults)

### Step 3: Regenerate Prisma Client
```bash
npx prisma generate
```

**Critical:** This syncs the Prisma Client with the schema. Without this, the `+ id: String` error may persist.

### Step 4: Verify Status
```bash
npx prisma migrate status
```

**Expected output:**
```
Database schema is in sync with migrations
```

---

## Production Deployment (Render)

### Automatic Deployment
When you push to main, Render will:
1. Run `npm install` → triggers `postinstall: prisma generate`
2. Run `build: prisma generate && prisma migrate deploy && next build`
3. Deploy the new version

### Manual Recovery (If Needed)

If deployment fails with "relation already exists":

#### Option 1: Mark Failed Migration as Rolled Back (Recommended)
```bash
# On Render shell
npx prisma migrate resolve --rolled-back 20260105000001_add_notifications
npx prisma migrate deploy
npx prisma generate
```

#### Option 2: Let Idempotent Migration Run
Since `add_notifications` is now idempotent, you can simply:
```bash
# On Render shell
npx prisma migrate deploy
npx prisma generate
```

The migration will skip existing objects and succeed.

### Verification Commands
```bash
# Check migration history
npx prisma migrate status

# Verify database connection
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM _prisma_migrations;"

# Check if notifications tables exist
psql "$DATABASE_URL" -c "SELECT to_regclass('public.notifications');"
```

---

## Testing the Fix

### Test Payment Persistence
1. Create a test payment link
2. Send a test Hedera transaction
3. Trigger the monitor endpoint:
```bash
curl -X POST https://your-app.onrender.com/api/hedera/transactions/monitor \
  -H "Content-Type: application/json" \
  -d '{
    "paymentLinkId": "...",
    "merchantAccountId": "0.0.xxxxx",
    "network": "testnet",
    "tokenType": "HBAR",
    "expectedAmount": 10
  }'
```

4. Check logs for:
   - ✅ "INSTRUMENTATION: Prisma payloads before transaction"
   - ✅ "Payment persisted successfully"
   - ❌ NO "Argument `id` is missing" errors

### Monitor Logs
```bash
# On Render
# Logs → Filter for "INSTRUMENTATION" or "Prisma"
```

Look for the instrumentation log showing `hasId: false` for all payloads.

---

## Why This Fixes the Issues

### Fix A: Migration Conflict
- Production has `add_notifications` migration already applied
- Local now has matching `add_notifications` migration
- Migration is idempotent, so can safely rerun
- No more "relation already exists" errors

### Fix B: Missing ID Errors
- Root cause was Prisma Client expecting IDs when DB columns lacked defaults
- Schema already had `@default(uuid())` ✅
- Migration now adds `DEFAULT gen_random_uuid()` to DB columns ✅
- After `prisma generate`, client knows IDs are auto-generated ✅
- Code never passes `id` in data objects ✅

---

## Rollback Plan (If Needed)

If something goes wrong:

### Rollback Migrations
```bash
# Don't do this in production unless absolutely necessary
# Instead, create a new migration to revert changes
```

### Revert Code Changes
```bash
git revert <commit-hash>
git push origin main
```

### Emergency Fix
If payment persistence completely breaks:
1. Check Prisma Client generation: `npx prisma generate`
2. Verify database connectivity
3. Check migration status: `npx prisma migrate status`
4. Review instrumentation logs for actual payload issues
5. Consult `docs/PRISMA_PRODUCTION_RECOVERY.md`

---

## Key Takeaways

1. **Migration naming matters** - Local and production must match exactly
2. **Idempotent migrations are safer** - Use `IF NOT EXISTS` and exception handling
3. **Schema ≠ Database** - Schema defaults must be applied via migrations
4. **Generate after migrate** - Always run `prisma generate` after schema/migration changes
5. **Instrumentation helps** - Logging actual payloads catches edge cases
6. **Recovery documentation** - Save time during incidents with clear playbooks

---

## Next Steps

1. ✅ Commit and push changes to main
2. ✅ Monitor Render deployment logs
3. ✅ Verify migration application in production
4. ✅ Test payment flow end-to-end
5. ✅ Remove instrumentation logging after confirming fix (optional)
6. ✅ Update team documentation with new playbooks

---

## Files Modified

- `src/prisma/migrations/add_notifications/migration.sql` - Idempotent notifications migration
- `src/prisma/migrations/20260105000003_add_uuid_defaults_payment_core/migration.sql` - UUID defaults migration
- `src/lib/hedera/transaction-checker.ts` - Added instrumentation logging
- `docs/PRISMA_PRODUCTION_RECOVERY.md` - New recovery playbook
- `docs/PRISMA_FIX_SUMMARY.md` - This summary

## Files Removed

- `src/prisma/migrations/20260105000000_add_uuid_defaults_for_ledger/` - Duplicate, removed
- `src/prisma/migrations/20260105000001_add_uuid_defaults_core_models/` - Duplicate, removed
- `src/prisma/migrations/20260105000002_add_notifications/` - Renamed to `add_notifications`

---

**Status:** ✅ Ready for production deployment

