# Test: Referral → Partner Ledger Integration

## Issue
Referral conversions were being created with `status='approved'` but no corresponding entries in `partner_ledger_entries` with `source='referral'`.

## Root Causes Fixed

1. **Silent failures** - Function had early returns without proper errors
2. **Entity type constraint** - `partner_entities` CHECK constraint only allowed `('sponsor', 'hunt', 'stop')`, but code tried to insert `'participant'`
3. **Poor logging** - No visibility into what was failing
4. **No rollback** - Failed ledger creation didn't roll back the conversion

## Changes Made

### 1. `src/lib/referrals/partners-integration.ts`
- ✅ Added `[REFERRAL_LEDGER_START/SUCCESS/FAIL]` logging throughout
- ✅ Replaced silent `return` statements with `throw new Error()` for traceability
- ✅ Explicitly convert UUID to TEXT: `sourceRefText = conversionId.toString()`
- ✅ Removed entity creation (was failing CHECK constraint)
- ✅ Set `entity_id = null` (column is nullable, participant info goes in description)
- ✅ Added detailed logging at each step

### 2. `src/app/api/referrals/submit-lead/route.ts`
- ✅ Added `[REFERRAL_SUBMIT_LEAD]` logging
- ✅ Added rollback logic if ledger creation fails:
  ```typescript
  // Rollback: revert conversion to pending status
  await supabase
    .from('referral_conversions')
    .update({
      status: 'pending',
      approved_at: null,
      approved_by: null,
    })
    .eq('id', conversion.id);
  ```
- ✅ Lead submission still succeeds even if ledger fails (graceful degradation)

## Test Steps

### Prerequisites
```bash
# Ensure migration is applied
# Visit Supabase SQL Editor and run:
SELECT slug FROM referral_programs;
-- Should return: consultant-referral

SELECT referral_code FROM referral_participants ORDER BY referral_code;
-- Should return: DEMO-ADVOCATE, DEMO-CONSULTANT

SELECT * FROM referral_program_rules 
WHERE role = 'CLIENT_ADVOCATE' AND conversion_type = 'lead_submitted';
-- Should return: fixed $20.00 payout rule
```

### Test 1: Submit Lead via Public Page

1. **Visit referral page**:
   ```
   http://localhost:3000/r/DEMO-CONSULTANT
   ```

2. **Fill out form**:
   - Name: Test User
   - Email: test@example.com
   - Phone: (optional)
   - Message: Testing referral ledger integration

3. **Submit form**

4. **Check server logs** for:
   ```
   [REFERRAL_SUBMIT_LEAD] Conversion created, creating ledger entry: <uuid>
   [REFERRAL_LEDGER_START] Creating ledger entry for conversion: <uuid>
   [REFERRAL_LEDGER] Loaded conversion: {...}
   [REFERRAL_LEDGER] Found rule: { payout_type: 'fixed', value: 20, currency: 'USD' }
   [REFERRAL_LEDGER] Calculated earnings: 20
   [REFERRAL_LEDGER] Using existing partner program: <uuid>
   [REFERRAL_LEDGER] Using NULL entity_id (participant info in description)
   [REFERRAL_LEDGER] Inserting ledger entry with source_ref: <uuid as text>
   [REFERRAL_LEDGER_SUCCESS] Partner ledger entry created for conversion: <uuid>
   ```

5. **Verify in database**:
   ```sql
   -- Get the latest conversion
   SELECT id, status, conversion_type, approved_by, created_at 
   FROM referral_conversions 
   ORDER BY created_at DESC 
   LIMIT 1;
   -- Should show: status='approved', approved_by='system_auto'
   
   -- Check ledger entry exists (replace <uuid> with conversion id from above)
   SELECT * FROM partner_ledger_entries 
   WHERE source = 'referral' 
   AND source_ref = '<uuid>';
   -- Should return exactly 1 row with:
   -- - source: 'referral'
   -- - source_ref: '<uuid as text>'
   -- - status: 'pending'
   -- - earnings_amount: 20.00
   -- - currency: 'USD'
   -- - description: contains participant name and 'lead_submitted'
   ```

### Test 2: Check Partners Dashboard

1. **Login as admin**:
   ```
   http://localhost:3000/auth/login
   ```

2. **Visit Partners Ledger**:
   ```
   http://localhost:3000/dashboard/partners/ledger
   ```

3. **Verify**:
   - ✅ Table shows entry with Source = "referral"
   - ✅ Earnings Amount = $20.00
   - ✅ Status = "Pending"
   - ✅ Description includes participant name and "lead_submitted"

4. **Visit Partners Dashboard**:
   ```
   http://localhost:3000/dashboard/partners/dashboard
   ```

5. **Verify**:
   - ✅ "Pending Earnings" card includes the $20.00
   - ✅ Total earnings reflect the new entry

### Test 3: Idempotency

1. **In Supabase SQL Editor**, manually try to create a duplicate:
   ```sql
   -- Get an existing entry's data
   SELECT * FROM partner_ledger_entries 
   WHERE source = 'referral' 
   ORDER BY created_at DESC 
   LIMIT 1;
   
   -- Try to insert duplicate (should fail with unique constraint)
   INSERT INTO partner_ledger_entries (
     program_id, 
     entity_id,
     source, 
     source_ref, 
     status,
     earnings_amount,
     currency,
     description
   ) VALUES (
     '<program_id from above>',
     NULL,
     'referral',
     '<source_ref from above>',  -- Same source_ref = should fail
     'pending',
     20.00,
     'USD',
     'Duplicate test'
   );
   ```

2. **Expected result**:
   ```
   ERROR: duplicate key value violates unique constraint "partner_ledger_entries_source_source_ref_key"
   ```

3. **This is correct** - the unique constraint is working!

### Test 4: Rollback on Failure

To test rollback, we'd need to temporarily break something (e.g., drop partner_programs table), but that's destructive. Instead, verify the code paths:

**Code Review Checklist**:
- ✅ `try...catch` block wraps ledger creation
- ✅ On error, conversion is rolled back to `status='pending'`
- ✅ `approved_at` and `approved_by` are cleared
- ✅ Lead submission still returns success (graceful degradation)

### Test 5: Missing Rule Scenario

1. **Check what happens if rule is missing**:
   ```sql
   -- Temporarily delete the CLIENT_ADVOCATE lead_submitted rule
   DELETE FROM referral_program_rules 
   WHERE role = 'CLIENT_ADVOCATE' 
   AND conversion_type = 'lead_submitted';
   ```

2. **Submit a lead**

3. **Check logs**:
   ```
   [REFERRAL_LEDGER_FAIL] No matching rule found for conversion <uuid>. Role: CLIENT_ADVOCATE, Type: lead_submitted
   [REFERRAL_SUBMIT_LEAD] Failed to create ledger entry, rolling back conversion
   [REFERRAL_SUBMIT_LEAD] Conversion rolled back to pending: <uuid>
   ```

4. **Verify in database**:
   ```sql
   SELECT status, approved_at, approved_by 
   FROM referral_conversions 
   ORDER BY created_at DESC 
   LIMIT 1;
   -- Should show: status='pending', approved_at=NULL, approved_by=NULL
   ```

5. **Restore the rule**:
   ```sql
   INSERT INTO referral_program_rules 
   (program_id, role, conversion_type, payout_type, value, currency, priority) 
   VALUES (
     (SELECT id FROM referral_programs WHERE slug = 'consultant-referral'),
     'CLIENT_ADVOCATE',
     'lead_submitted',
     'fixed',
     20.00,
     'USD',
     10
   );
   ```

## Acceptance Criteria

✅ **All of these must pass:**

1. Submit lead via `/r/DEMO-CONSULTANT` creates:
   - ✅ Row in `referral_leads`
   - ✅ Row in `referral_conversions` with `status='approved'`
   - ✅ Row in `partner_ledger_entries` with `source='referral'`

2. Ledger entry has:
   - ✅ `source = 'referral'`
   - ✅ `source_ref = <conversion.id as TEXT>`
   - ✅ `status = 'pending'`
   - ✅ `earnings_amount = 20.00` (from rule)
   - ✅ `currency = 'USD'`
   - ✅ `description` contains participant name and conversion type
   - ✅ `entity_id = NULL` (not trying to create 'participant' entity)

3. Idempotency:
   - ✅ Running migration multiple times doesn't create duplicates
   - ✅ Trying to create duplicate ledger entry returns 23505 error
   - ✅ Code handles 23505 gracefully (logs success)

4. Error handling:
   - ✅ Missing rule throws error with clear message
   - ✅ Ledger failure triggers rollback of conversion
   - ✅ Lead submission still succeeds (graceful degradation)

5. Logging:
   - ✅ `[REFERRAL_LEDGER_START]` at beginning
   - ✅ `[REFERRAL_LEDGER_SUCCESS]` on success
   - ✅ `[REFERRAL_LEDGER_FAIL]` on error with details
   - ✅ All steps logged with intermediate values

6. Partners UI:
   - ✅ `/dashboard/partners/ledger` shows referral entries
   - ✅ `/dashboard/partners/dashboard` totals include referral earnings

## Quick Verification Query

Run this in Supabase SQL Editor after submitting a test lead:

```sql
-- Complete verification
WITH latest_conversion AS (
  SELECT id, status, conversion_type, approved_by, created_at
  FROM referral_conversions
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT 
  'Conversion' as record_type,
  c.id::text as id,
  c.status,
  c.conversion_type,
  c.approved_by,
  NULL as earnings_amount,
  c.created_at
FROM latest_conversion c

UNION ALL

SELECT
  'Ledger Entry' as record_type,
  le.id::text,
  le.status,
  le.source,
  le.description,
  le.earnings_amount,
  le.created_at
FROM latest_conversion c
JOIN partner_ledger_entries le 
  ON le.source = 'referral' 
  AND le.source_ref = c.id::text;
```

**Expected output**: 2 rows
- Row 1: Conversion with status='approved', approved_by='system_auto'
- Row 2: Ledger Entry with source='referral', earnings_amount=20.00

## Troubleshooting

### "No ledger entry created"

**Check logs for**:
```bash
grep "REFERRAL_LEDGER" <your-log-file>
```

**Common causes**:
1. **Missing rule** - `[REFERRAL_LEDGER_FAIL] No matching rule found`
   - Fix: Verify rule exists for the participant's role + conversion_type
2. **Zero earnings** - `[REFERRAL_LEDGER_FAIL] Calculated earnings is 0`
   - Fix: Check rule value is not 0
3. **Entity creation failing** - Should now be fixed (using NULL entity_id)

### "Conversion status is 'pending' not 'approved'"

This means ledger creation failed and triggered rollback.

**Check logs**:
```bash
grep "REFERRAL_SUBMIT_LEAD.*rolling back" <your-log-file>
```

**Fix**: Look at the `[REFERRAL_LEDGER_FAIL]` message to see what failed.

### "Duplicate key violation"

This is **expected** if trying to create the same ledger entry twice. The code handles this gracefully with:
```
[REFERRAL_LEDGER_SUCCESS] Ledger entry already exists (idempotent)
```

## Files Changed

1. `src/lib/referrals/partners-integration.ts` - Main integration logic
2. `src/app/api/referrals/submit-lead/route.ts` - Lead submission with rollback
3. `TEST_REFERRAL_LEDGER.md` - This test document

## Status: ✅ Ready for Testing

All code changes complete. Run Test 1 to verify the integration works end-to-end.
