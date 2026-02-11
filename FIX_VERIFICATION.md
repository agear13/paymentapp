# Verification: Referral → Partner Program Mapping Fix

## What Was Fixed

**CRITICAL BUG**: Referral ledger entries were being created under the wrong `partner_programs` entry (using HuntPay's ID instead of consultant-referral's ID).

### Root Cause
- `referral_programs` and `partner_programs` are **separate tables with different IDs**
- Mapping must be done by **matching slugs**, not assuming IDs are the same
- Code was querying `partner_programs` but not handling errors properly, causing:
  - Silent failures
  - Fallback to wrong program
  - Using referral_programs.id where partner_programs.id was needed

### The Fix

1. **Explicit slug lookup** with error if not found
2. **Removed auto-creation** - partner_programs must exist via migration
3. **Added detailed logging** to show the mapping process
4. **Migration update** to seed the partner_programs entry
5. **Documentation** explaining the two-table architecture

## Pre-Flight Check

Before testing, ensure the migration is applied with the new partner_programs entry:

```sql
-- Run this in Supabase SQL Editor
SELECT id, slug, name FROM partner_programs ORDER BY slug;
```

**Expected output**:
```
id                                   | slug                 | name
-------------------------------------|----------------------|--------------------------------
b158d0e4-xxxx-xxxx-xxxx-xxxxxxxxxxxx | consultant-referral  | Consultant Referral Program
d590ebef-xxxx-xxxx-xxxx-xxxxxxxxxxxx | huntpay              | HuntPay
```

If `consultant-referral` is missing, run:
```bash
# In Supabase SQL Editor, paste entire contents of:
supabase/migrations/20260207_referral_system.sql
```

## Test Steps

### 1. Submit a Test Lead

Visit:
```
http://localhost:3000/r/DEMO-CONSULTANT
```

Fill out the form:
- **Name**: Test User
- **Email**: test@example.com
- **Message**: Testing program mapping fix

Click **Submit**

### 2. Check Server Logs

You should see these logs (in order):

```
[REFERRAL_SUBMIT_LEAD] Conversion created, creating ledger entry: <uuid>
[REFERRAL_LEDGER_START] Creating ledger entry for conversion: <uuid>
[REFERRAL_LEDGER] Loaded conversion: {
  id: '<uuid>',
  type: 'lead_submitted',
  status: 'approved',
  participant: 'Demo Consultant',
  role: 'CLIENT_ADVOCATE',
  program: 'consultant-referral'
}
[REFERRAL_LEDGER] Found rule: {
  payout_type: 'fixed',
  value: 20,
  currency: 'USD'
}
[REFERRAL_LEDGER] Calculated earnings: 20
[REFERRAL_LEDGER_MAP] Looking up partner_programs by slug: consultant-referral
[REFERRAL_LEDGER_MAP] Mapped successfully: {
  referral_program_slug: 'consultant-referral',
  partner_program_id: 'b158d0e4-...', ← This is the KEY line!
  partner_program_slug: 'consultant-referral',
  partner_program_name: 'Consultant Referral Program'
}
[REFERRAL_LEDGER] Using NULL entity_id (participant info in description)
[REFERRAL_LEDGER_INSERT] Preparing ledger entry: {
  source: 'referral',
  source_ref: '<uuid>',
  program_id: 'b158d0e4-...', ← Should match above!
  earnings_amount: 20,
  currency: 'USD',
  status: 'pending',
  description: 'Consultant Referral Program conversion: Demo Consultant • lead_submitted'
}
[REFERRAL_LEDGER_SUCCESS] Partner ledger entry created for conversion: <uuid>
```

**Key things to verify:**
- ✅ `[REFERRAL_LEDGER_MAP]` shows correct mapping
- ✅ `partner_program_id` is **NOT** the huntpay ID (d590ebef...)
- ✅ `partner_program_id` **IS** the consultant-referral ID (b158d0e4...)
- ✅ `[REFERRAL_LEDGER_SUCCESS]` confirms insertion

### 3. Verify in Database

**Query 1: Get the latest conversion**
```sql
SELECT id, status, conversion_type, approved_by, created_at
FROM referral_conversions
ORDER BY created_at DESC
LIMIT 1;
```

**Expected**:
- `status` = 'approved'
- `approved_by` = 'system_auto'
- `conversion_type` = 'lead_submitted'

Copy the `id` value for next query.

**Query 2: Check ledger entry uses correct program**
```sql
-- Replace <conversion-id> with the id from Query 1
SELECT 
  le.id,
  le.source,
  le.source_ref,
  pp.id as partner_program_id,
  pp.slug as partner_program_slug,
  pp.name as partner_program_name,
  le.earnings_amount,
  le.currency,
  le.status,
  le.description,
  le.created_at
FROM partner_ledger_entries le
JOIN partner_programs pp ON pp.id = le.program_id
WHERE le.source = 'referral'
AND le.source_ref = '<conversion-id>';
```

**Expected output (1 row)**:
```
source: referral
source_ref: <conversion-id>
partner_program_id: b158d0e4-... (NOT d590ebef...)
partner_program_slug: consultant-referral (NOT huntpay)
partner_program_name: Consultant Referral Program
earnings_amount: 20.00
currency: USD
status: pending
description: Consultant Referral Program conversion: Demo Consultant • lead_submitted
```

**🔴 CRITICAL CHECK**: `partner_program_slug` MUST be `'consultant-referral'`, NOT `'huntpay'`

**Query 3: Aggregate check**
```sql
SELECT 
  pp.slug as program,
  pp.name,
  COUNT(*) as entries,
  SUM(le.earnings_amount) as total_earnings
FROM partner_ledger_entries le
JOIN partner_programs pp ON pp.id = le.program_id
WHERE le.source = 'referral'
GROUP BY pp.slug, pp.name
ORDER BY pp.slug;
```

**Expected**:
```
program             | name                           | entries | total_earnings
--------------------|--------------------------------|---------|---------------
consultant-referral | Consultant Referral Program    |    1+   |    20.00+
```

**❌ If you see**: `huntpay | HuntPay | <count>` → BUG NOT FIXED

### 4. Verify in Partners UI

**Visit Partners Ledger**:
```
http://localhost:3000/dashboard/partners/ledger
```

**Expected**:
- ✅ Table shows entry with Source = "referral"
- ✅ Earnings = $20.00
- ✅ Status = "Pending"
- ✅ Description contains "Demo Consultant" and "lead_submitted"

**Visit Partners Dashboard**:
```
http://localhost:3000/dashboard/partners/dashboard
```

**Expected**:
- ✅ "Pending Earnings" includes the $20.00
- ✅ Chart shows the new entry
- ✅ Table lists "Consultant Referral Program" (not HuntPay)

## Success Criteria

✅ All of these must be true:

1. Server logs show `[REFERRAL_LEDGER_MAP]` with correct program_id
2. `partner_ledger_entries.program_id` matches `partner_programs.id` where slug='consultant-referral'
3. Query 3 above shows entries under `consultant-referral`, NOT `huntpay`
4. Partners UI shows the entry correctly
5. No errors in server logs

## If It's Still Wrong

### Symptom: Ledger entries still under 'huntpay'

**Check 1: Migration applied?**
```sql
SELECT id, slug FROM partner_programs WHERE slug = 'consultant-referral';
```
If no rows: Migration not applied. Run the migration.

**Check 2: Code deployed?**
Check file: `src/lib/referrals/partners-integration.ts`
Should contain:
```typescript
console.log('[REFERRAL_LEDGER_MAP] Looking up partner_programs by slug:', referralProgramSlug);
```

If missing: Code not deployed. Restart dev server.

**Check 3: Cached build?**
```bash
cd src
rm -rf .next
npm run build
npm run dev
```

### Symptom: Error "No matching partner_programs entry found"

This is the **CORRECT** error if migration not applied!

**Fix**:
1. Go to Supabase SQL Editor
2. Paste entire contents of `supabase/migrations/20260207_referral_system.sql`
3. Click Run
4. Verify: `SELECT * FROM partner_programs WHERE slug = 'consultant-referral';`

### Symptom: Old entries still under wrong program

If you have existing entries created before the fix, you can correct them:

```sql
-- Get the correct program_id
SELECT id FROM partner_programs WHERE slug = 'consultant-referral';
-- Copy this id (e.g., b158d0e4-...)

-- Get the wrong huntpay id
SELECT id FROM partner_programs WHERE slug = 'huntpay';
-- Copy this id (e.g., d590ebef-...)

-- Fix the wrong entries
UPDATE partner_ledger_entries
SET program_id = '<consultant-referral-id>'
WHERE source = 'referral'
AND program_id = '<huntpay-id>';

-- Verify fix
SELECT pp.slug, COUNT(*) 
FROM partner_ledger_entries le
JOIN partner_programs pp ON pp.id = le.program_id
WHERE le.source = 'referral'
GROUP BY pp.slug;
-- Should show: consultant-referral | <count>
```

## Files Changed

1. `src/lib/referrals/partners-integration.ts` - Fixed slug mapping logic
2. `supabase/migrations/20260207_referral_system.sql` - Added partner_programs seed
3. `REFERRAL_PARTNER_MAPPING.md` - Architecture documentation (NEW)
4. `FIX_VERIFICATION.md` - This file (NEW)

## Commit

```
[main b27f60b] Fix referral→partner program mapping by slug
 3 files changed, 319 insertions(+), 30 deletions(-)
 create mode 100644 REFERRAL_PARTNER_MAPPING.md
```

## Next Steps

1. ✅ Run pre-flight check (verify migration)
2. ✅ Submit test lead
3. ✅ Check logs for `[REFERRAL_LEDGER_MAP]`
4. ✅ Run database verification queries
5. ✅ Check Partners UI
6. ✅ Confirm all entries under `consultant-referral` program

If all checks pass → **BUG FIXED** ✅
