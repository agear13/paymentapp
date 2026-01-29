# Xero Syncs Hardening: One-Row-Per-Link-Per-Type Model

## 📋 Executive Summary

**Problem:** The `xero_syncs` table was accumulating multiple duplicate rows for the same `(payment_link_id, sync_type)`, causing:
- Data bloat (7+ INVOICE rows for one payment link)
- Confusion about which sync record is canonical
- Potential race conditions during retries

**Solution:** Enforced database-level uniqueness with `@@unique([payment_link_id, sync_type])` and converted all `create()` operations to idempotent `upsert()` operations.

**Result:** Exactly ONE row per `(payment_link_id, sync_type)` combination. Retries update the existing row instead of creating duplicates.

---

## 📍 All Write Locations Found

| # | File | Function | Trigger | Operation | Status |
|---|------|----------|---------|-----------|--------|
| 1 | `src/lib/services/payment-confirmation.ts` L262 | `confirmPayment()` | Payment confirmed | `create()` → **`upsert()`** | ✅ Fixed |
| 2 | `src/lib/xero/queue-service.ts` L92 | `queueSyncJob()` | Manual queue/retry | `create()` → **`upsert()`** | ✅ Fixed |
| 3 | `src/lib/xero/sync-orchestration.ts` L216 | `syncPaymentToXero()` success | Sync completes | `create()` → **`upsert()`** | ✅ Fixed |
| 4 | `src/lib/xero/sync-orchestration.ts` L272 | `syncPaymentToXero()` failure | Sync fails | `create()` → **`upsert()`** | ✅ Fixed |
| 5 | `src/lib/xero/multi-currency-sync.ts` L271 | `syncInvoiceWithMultipleCurrencies()` | TODO/simulation | `create()` → **`upsert()`** | ✅ Fixed |
| 6 | `src/lib/xero/multi-currency-sync.ts` L331 | `syncInvoiceSimple()` | TODO/simulation | `create()` → **`upsert()`** | ✅ Fixed |
| 7 | `src/lib/xero/multi-currency-sync.ts` L408 | `syncPayment()` | TODO/simulation | `create()` → **`upsert()`** | ✅ Fixed |
| 8 | `src/lib/xero/queue-service.ts` L160 | `markSyncInProgress()` | Sync starts | `update()` | ✅ Already OK |
| 9 | `src/lib/xero/queue-service.ts` L184 | `markSyncSuccess()` | Sync succeeds | `update()` | ✅ Already OK |
| 10 | `src/lib/xero/queue-service.ts` L238 | `markSyncFailed()` | Sync fails | `update()` | ✅ Already OK |
| 11 | `src/app/api/xero/sync/replay/route.ts` L96 | `POST()` | Manual retry API | `update()` | ✅ Already OK |

---

## 🔧 Changes Made

### 1. **Prisma Schema Change**

**File:** `src/prisma/schema.prisma`

**Diff:**
```diff
 model xero_syncs {
   id               String         @id @default(uuid()) @db.Uuid
   payment_link_id  String         @db.Uuid
   sync_type        XeroSyncType
   status           XeroSyncStatus
   xero_invoice_id  String?        @db.VarChar(255)
   xero_payment_id  String?        @db.VarChar(255)
   request_payload  Json
   response_payload Json?
   error_message    String?
   retry_count      Int            @default(0)
   next_retry_at    DateTime?      @db.Timestamptz(6)
   created_at       DateTime       @default(now()) @db.Timestamptz(6)
   updated_at       DateTime       @db.Timestamptz(6)
   payment_links    payment_links  @relation(fields: [payment_link_id], references: [id], onDelete: Cascade)

+  @@unique([payment_link_id, sync_type], name: "xero_syncs_payment_link_sync_type_unique")
   @@index([status, next_retry_at])
 }
```

### 2. **Code Changes: create() → upsert()**

#### **Pattern Used:**
```typescript
// BEFORE: Creates duplicate on retry
await prisma.xero_syncs.create({
  data: {
    id: crypto.randomUUID(),
    payment_link_id: paymentLinkId,
    sync_type: 'INVOICE',
    status: 'PENDING',
    // ... other fields
  },
});

// AFTER: Idempotent upsert
await prisma.xero_syncs.upsert({
  where: {
    xero_syncs_payment_link_sync_type_unique: {
      payment_link_id: paymentLinkId,
      sync_type: 'INVOICE',
    },
  },
  update: {
    // Update existing row (e.g., requeue, mark success/failure)
    status: 'PENDING',
    next_retry_at: new Date(),
    updated_at: new Date(),
  },
  create: {
    // Create new row if doesn't exist (first time)
    id: crypto.randomUUID(),
    payment_link_id: paymentLinkId,
    sync_type: 'INVOICE',
    status: 'PENDING',
    retry_count: 0,
    created_at: new Date(),
    updated_at: new Date(),
    // ... other fields
  },
});
```

#### **Modified Files:**

1. **`src/lib/services/payment-confirmation.ts`** (L262-280)
   - **Trigger:** Payment confirmed (Stripe/Hedera)
   - **Change:** Queue initial INVOICE sync as upsert
   - **Behavior:** If sync already exists (e.g., from retry), resets to PENDING

2. **`src/lib/xero/queue-service.ts`** (L61-115)
   - **Trigger:** Manual queue or retry
   - **Change:** Removed redundant duplicate check, use upsert
   - **Behavior:** Idempotent queueing - safe to call multiple times

3. **`src/lib/xero/sync-orchestration.ts`** (L216-263)
   - **Trigger:** Sync completes successfully
   - **Change:** Update existing sync record to SUCCESS (not create new)
   - **Behavior:** Marks existing PENDING/RETRYING row as SUCCESS

4. **`src/lib/xero/sync-orchestration.ts`** (L272-313)
   - **Trigger:** Sync fails
   - **Change:** Update existing sync record to FAILED (not create new)
   - **Behavior:** Marks existing row as FAILED with error_message

5. **`src/lib/xero/multi-currency-sync.ts`** (L271, L331, L408)
   - **Trigger:** TODO/simulation code for multi-currency support
   - **Change:** All creates converted to upserts for consistency
   - **Behavior:** Future-proofed for when this code is activated

---

## 🗄️ Migration Details

**Migration Name:** `20260129000000_xero_syncs_unique_constraint`

**Migration File:** `src/prisma/migrations/20260129000000_xero_syncs_unique_constraint/migration.sql`

**Key Steps:**
1. **Audit duplicates:** Counts how many `payment_link_id`s have duplicate syncs
2. **Smart cleanup:** Keeps the BEST row per `(payment_link_id, sync_type)`:
   - Priority: `SUCCESS` > `PENDING/RETRYING` > `FAILED`
   - Within same status: keeps newest (by `created_at DESC`)
   - Deletes all other duplicates
3. **Add constraint:** `ALTER TABLE xero_syncs ADD CONSTRAINT xero_syncs_payment_link_sync_type_unique UNIQUE (payment_link_id, sync_type);`
4. **Verify:** Confirms constraint was successfully added

**Cleanup SQL Logic:**
```sql
WITH ranked_syncs AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY payment_link_id, sync_type 
      ORDER BY 
        -- Priority: SUCCESS=1, PENDING/RETRYING=2, FAILED=3
        CASE status 
          WHEN 'SUCCESS' THEN 1 
          WHEN 'PENDING' THEN 2 
          WHEN 'RETRYING' THEN 2 
          WHEN 'FAILED' THEN 3 
        END,
        created_at DESC -- Newest first
    ) as row_rank
  FROM xero_syncs
)
DELETE FROM xero_syncs 
WHERE id IN (SELECT id FROM ranked_syncs WHERE row_rank > 1);
```

---

## 🚀 How to Apply

### **Step 1: Run Migration**

```bash
# Ensure dev environment is running
npm run dev  # In separate terminal

# Apply migration to database
npx prisma migrate deploy

# OR for development:
npx prisma migrate dev --name xero_syncs_unique_constraint
```

### **Step 2: Regenerate Prisma Client**

```bash
# This generates TypeScript types for the new unique constraint
npx prisma generate
```

### **Step 3: Verify Migration**

```sql
-- Check constraint exists
SELECT conname, contype, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'xero_syncs_payment_link_sync_type_unique';

-- Check for remaining duplicates (should be 0)
SELECT payment_link_id, sync_type, COUNT(*) as cnt
FROM xero_syncs
GROUP BY payment_link_id, sync_type
HAVING COUNT(*) > 1;
```

### **Step 4: Restart Application**

```bash
# Stop and restart dev server to load new Prisma client
# Ctrl+C, then:
npm run dev
```

---

## 🎯 How The New Model Works

### **Before (Duplicates Possible):**
```
payment_links.id = "abc123"
xero_syncs:
  - id: 1, payment_link_id: "abc123", sync_type: INVOICE, status: PENDING   ← Initial
  - id: 2, payment_link_id: "abc123", sync_type: INVOICE, status: PENDING   ← Retry duplicate!
  - id: 3, payment_link_id: "abc123", sync_type: INVOICE, status: FAILED    ← Failure duplicate!
  - id: 4, payment_link_id: "abc123", sync_type: INVOICE, status: PENDING   ← Another duplicate!
  - id: 5, payment_link_id: "abc123", sync_type: INVOICE, status: SUCCESS   ← Success duplicate!
```

### **After (One Row Per Link Per Type):**
```
payment_links.id = "abc123"
xero_syncs:
  - id: 1, payment_link_id: "abc123", sync_type: INVOICE, status: SUCCESS   ← Only ONE row!
    (Status evolves: PENDING → RETRYING → SUCCESS/FAILED, but same row)
```

### **Lifecycle of a Sync Record:**

1. **Payment Confirmed**
   - `confirmPayment()` calls upsert with `status=PENDING`
   - Creates new row if first time, or resets existing row

2. **Queue Processor Picks Up Job**
   - `markSyncInProgress()` updates `status=RETRYING`
   - Same row, just status change

3. **Sync Succeeds**
   - `syncPaymentToXero()` upserts with `status=SUCCESS`
   - Sets `xero_invoice_id`, `xero_payment_id`, `response_payload`
   - `next_retry_at = null` (no more retries needed)

4. **OR Sync Fails**
   - `syncPaymentToXero()` upserts with `status=FAILED`
   - Sets `error_message`
   - `markSyncFailed()` increments `retry_count`, schedules `next_retry_at`

5. **Retry**
   - Queue processor picks up again (same row)
   - Updates to `status=RETRYING` again
   - Cycle continues until SUCCESS or max retries

**Key Point:** The `id` field never changes - it's the same row evolving through states.

---

## 🛡️ Idempotency Guarantees

### **Safe to Call Multiple Times:**

✅ **Scenario 1:** Payment confirmed twice (e.g., webhook retry)
```typescript
// First call: Creates PENDING sync
await confirmPayment({ ... });

// Second call: Resets same sync to PENDING (idempotent)
await confirmPayment({ ... });

// Result: Still ONE sync record
```

✅ **Scenario 2:** Manual queue while already queued
```typescript
// First call: Creates PENDING sync
await queueSyncJob({ paymentLinkId });

// Second call: Updates same sync (still PENDING or resets if FAILED)
await queueSyncJob({ paymentLinkId });

// Result: Still ONE sync record
```

✅ **Scenario 3:** Sync fails, then succeeds on retry
```typescript
// Attempt 1: Updates to FAILED
await syncPaymentToXero({ ... }); // throws error

// Retry: Updates same record to SUCCESS
await syncPaymentToXero({ ... }); // succeeds

// Result: Same row, now SUCCESS
```

### **No Xero Connection Handling:**

The code now has a safety check for missing Xero connections:

```typescript
// In sync-orchestration.ts
const connection = await getActiveXeroConnection(organizationId);
if (!connection) {
  // Mark sync as FAILED with error, don't retry infinitely
  await prisma.xero_syncs.upsert({
    where: { ... },
    update: {
      status: 'FAILED',
      error_message: 'No active Xero connection for organization',
      next_retry_at: null, // Don't retry until connection exists
    },
    // ...
  });
  throw new Error('No active Xero connection');
}
```

This prevents infinite retries when Xero is not connected.

---

## 📊 Expected Outcomes

### **Before Migration:**
```sql
-- Example: 7 duplicate syncs for one payment link
SELECT payment_link_id, sync_type, COUNT(*) 
FROM xero_syncs 
WHERE payment_link_id = 'abc123'
GROUP BY payment_link_id, sync_type;

payment_link_id | sync_type | count
----------------|-----------|------
abc123          | INVOICE   | 7      ← Problem!
```

### **After Migration:**
```sql
-- Only ONE sync per (payment_link_id, sync_type)
SELECT payment_link_id, sync_type, COUNT(*) 
FROM xero_syncs 
GROUP BY payment_link_id, sync_type;

payment_link_id | sync_type | count
----------------|-----------|------
abc123          | INVOICE   | 1      ← Fixed!
xyz456          | INVOICE   | 1
xyz456          | PAYMENT   | 1
```

### **Constraint Enforcement:**
```sql
-- Trying to insert duplicate will fail:
INSERT INTO xero_syncs (id, payment_link_id, sync_type, ...) 
VALUES (uuid_generate_v4(), 'abc123', 'INVOICE', ...);

-- ERROR: duplicate key value violates unique constraint 
-- "xero_syncs_payment_link_sync_type_unique"
```

---

## ✅ Testing Checklist

- [ ] Run migration successfully
- [ ] Verify constraint exists in database
- [ ] Confirm no duplicates remain
- [ ] Test payment confirmation creates ONE sync
- [ ] Test retry updates SAME sync (not create new)
- [ ] Test failure updates SAME sync
- [ ] Test success updates SAME sync
- [ ] Test manual queue is idempotent
- [ ] Verify no code tries to create duplicates
- [ ] Check logs for "Xero sync queued (idempotent)"

---

## 🐛 Troubleshooting

### **Issue: Migration fails with "unique constraint violation"**

**Cause:** Duplicates still exist after cleanup logic runs.

**Fix:**
```sql
-- Manually inspect duplicates
SELECT payment_link_id, sync_type, COUNT(*), 
       array_agg(id ORDER BY created_at DESC) as ids
FROM xero_syncs
GROUP BY payment_link_id, sync_type
HAVING COUNT(*) > 1;

-- Manually delete specific duplicates (keep first ID in array)
-- Example: DELETE FROM xero_syncs WHERE id = 'old-id-to-remove';
```

### **Issue: TypeScript error "xero_syncs_payment_link_sync_type_unique does not exist"**

**Cause:** Prisma client not regenerated after schema change.

**Fix:**
```bash
npx prisma generate
# Restart TypeScript server in IDE (Cmd+Shift+P → "Restart TS Server")
```

### **Issue: Sync still creating duplicates**

**Cause:** Code using `create()` instead of `upsert()`, or old Prisma client cached.

**Fix:**
```bash
# Check for any remaining create() calls
grep -r "xero_syncs.create" src/

# Regenerate Prisma client
npx prisma generate

# Clear node_modules Prisma cache
rm -rf node_modules/.prisma
npm install
```

---

## 📝 Summary

**What Changed:**
- ✅ Added `@@unique([payment_link_id, sync_type])` to Prisma schema
- ✅ Converted 7 `create()` calls to `upsert()` calls
- ✅ Generated migration with smart duplicate cleanup
- ✅ Ensured idempotency for all sync operations

**What This Prevents:**
- ❌ Duplicate sync records for same payment link
- ❌ Confusion about which sync is canonical
- ❌ Database bloat from retry duplicates
- ❌ Race conditions during concurrent syncs

**What This Enables:**
- ✅ Exactly ONE row per `(payment_link_id, sync_type)`
- ✅ Safe retry behavior (updates same row)
- ✅ Clear sync lifecycle tracking
- ✅ Database-enforced data integrity

**Next Steps:**
1. Run migration: `npx prisma migrate deploy`
2. Regenerate client: `npx prisma generate`
3. Restart app: `npm run dev`
4. Test payment flow end-to-end
5. Monitor logs for idempotency confirmations

---

**Questions?** Check troubleshooting section or review the code changes in the modified files.

