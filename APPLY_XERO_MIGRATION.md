# Quick Guide: Apply Xero Syncs Hardening

## ⚡ Quick Start

```bash
# 1. Apply migration to database
npx prisma migrate deploy

# 2. Regenerate Prisma client (gets new TypeScript types)
npx prisma generate

# 3. Restart dev server
# Press Ctrl+C to stop, then:
npm run dev
```

---

## 🔍 Verification Commands

### Check if migration applied:
```sql
-- Connect to your database and run:
SELECT conname, contype, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'xero_syncs_payment_link_sync_type_unique';
```

Expected result:
```
conname                                    | contype | pg_get_constraintdef
-------------------------------------------|---------|----------------------
xero_syncs_payment_link_sync_type_unique  | u       | UNIQUE (payment_link_id, sync_type)
```

### Check for duplicates (should return 0 rows):
```sql
SELECT payment_link_id, sync_type, COUNT(*) as count
FROM xero_syncs
GROUP BY payment_link_id, sync_type
HAVING COUNT(*) > 1;
```

### Count cleaned up records:
```sql
-- Before migration: Check total count
SELECT COUNT(*) FROM xero_syncs;

-- After migration: Should be fewer (duplicates removed)
SELECT COUNT(*) FROM xero_syncs;
```

---

## 📋 What Changed

### Files Modified:
1. ✅ `src/prisma/schema.prisma` - Added unique constraint
2. ✅ `src/lib/services/payment-confirmation.ts` - create() → upsert()
3. ✅ `src/lib/xero/queue-service.ts` - create() → upsert()
4. ✅ `src/lib/xero/sync-orchestration.ts` - create() → upsert() (2 places)
5. ✅ `src/lib/xero/multi-currency-sync.ts` - create() → upsert() (3 places)

### Migration Created:
- `src/prisma/migrations/20260129000000_xero_syncs_unique_constraint/migration.sql`
  - Cleans up existing duplicates
  - Adds unique constraint
  - Validates constraint

---

## 🧪 Test After Applying

1. **Create a payment link and pay it:**
   ```bash
   # The payment should queue ONE Xero sync
   # Check logs for: "Xero sync queued (idempotent)"
   ```

2. **Try to trigger sync multiple times:**
   ```bash
   # Call the queue endpoint multiple times
   # Should update the SAME xero_syncs row, not create duplicates
   ```

3. **Check database:**
   ```sql
   SELECT id, payment_link_id, sync_type, status, retry_count, created_at, updated_at
   FROM xero_syncs
   ORDER BY created_at DESC
   LIMIT 10;
   ```
   - Should see `updated_at` changing on retries
   - Should NOT see duplicate rows for same (payment_link_id, sync_type)

---

## 🐛 If Migration Fails

### Error: "duplicate key value violates unique constraint"

**Cause:** Migration's cleanup logic didn't remove all duplicates.

**Fix:**
```bash
# Rollback migration
npx prisma migrate resolve --rolled-back 20260129000000_xero_syncs_unique_constraint

# Manually clean duplicates:
psql $DATABASE_URL

-- Find duplicates:
SELECT payment_link_id, sync_type, COUNT(*), array_agg(id ORDER BY created_at DESC) as ids
FROM xero_syncs
GROUP BY payment_link_id, sync_type
HAVING COUNT(*) > 1;

-- For each duplicate set, delete all but the first ID
-- (First ID in array is newest/best)
DELETE FROM xero_syncs WHERE id = 'id-to-delete';

-- Exit psql and retry migration:
\q
npx prisma migrate deploy
```

---

## 📊 Expected Before/After

### BEFORE (Example Data):
```
payment_link_id | sync_type | status   | created_at
----------------|-----------|----------|-----------
abc-123         | INVOICE   | PENDING  | 2026-01-25
abc-123         | INVOICE   | FAILED   | 2026-01-26  ← Duplicate!
abc-123         | INVOICE   | PENDING  | 2026-01-27  ← Duplicate!
abc-123         | INVOICE   | SUCCESS  | 2026-01-28  ← Duplicate!
```

### AFTER:
```
payment_link_id | sync_type | status   | created_at | updated_at
----------------|-----------|----------|------------|------------
abc-123         | INVOICE   | SUCCESS  | 2026-01-28 | 2026-01-28  ← Only ONE row!
```

---

## ✅ Success Indicators

- ✅ Migration runs without errors
- ✅ `npx prisma generate` completes successfully
- ✅ TypeScript compilation has no new errors
- ✅ Logs show "Xero sync queued (idempotent)"
- ✅ Database query shows no duplicates
- ✅ Constraint exists in pg_constraint table
- ✅ Retries update same row (check `updated_at`)

---

## 🚨 Rollback Plan (If Needed)

If something goes wrong and you need to rollback:

```bash
# 1. Mark migration as rolled back
npx prisma migrate resolve --rolled-back 20260129000000_xero_syncs_unique_constraint

# 2. Remove constraint from database manually
psql $DATABASE_URL -c "ALTER TABLE xero_syncs DROP CONSTRAINT IF EXISTS xero_syncs_payment_link_sync_type_unique;"

# 3. Revert Prisma schema change
# Edit src/prisma/schema.prisma and remove:
# @@unique([payment_link_id, sync_type], name: "xero_syncs_payment_link_sync_type_unique")

# 4. Regenerate client
npx prisma generate

# 5. Revert code changes (git)
git checkout HEAD -- src/lib/services/payment-confirmation.ts
git checkout HEAD -- src/lib/xero/queue-service.ts
git checkout HEAD -- src/lib/xero/sync-orchestration.ts
git checkout HEAD -- src/lib/xero/multi-currency-sync.ts
```

---

**For detailed explanation, see:** `XERO_SYNCS_HARDENING_SUMMARY.md`

