# Referral → Partner Ledger Program Mapping

## Critical: Two Separate Program Tables

This application has **two separate program tables** with **different IDs**:

### 1. `referral_programs` (Referral System)
- Purpose: Define referral programs with participants, rules, and review tokens
- Example row:
  ```sql
  id: aa20cc50-1234-5678-9abc-def012345678
  slug: 'consultant-referral'
  name: 'Consultant Referral Program'
  ```

### 2. `partner_programs` (Partner Ledger System)
- Purpose: Group ledger entries from multiple sources (HuntPay, Referrals, etc.)
- Example rows:
  ```sql
  id: d590ebef-aaaa-bbbb-cccc-dddddddddddd
  slug: 'huntpay'
  name: 'HuntPay'
  
  id: b158d0e4-1111-2222-3333-444444444444
  slug: 'consultant-referral'
  name: 'Consultant Referral Program'
  ```

## Mapping Strategy

**Mapping is done by matching slugs:**

```
referral_programs.slug = 'consultant-referral'
         ↓
partner_programs.slug = 'consultant-referral'
         ↓
partner_ledger_entries.program_id = <partner_programs.id>
```

## Why Two Tables?

1. **Separation of concerns**: Referral programs need participant tracking, while partner ledger is a generic earnings aggregator
2. **Multiple sources**: Partner ledger aggregates from HuntPay, Referrals, and potentially other future sources
3. **Different lifecycles**: Referral programs can be created/modified independently from ledger tracking

## Code Implementation

### In `src/lib/referrals/partners-integration.ts`

```typescript
// 1. Get referral program slug from conversion
const referralProgramSlug = conversion.referral_programs.slug;

// 2. Find matching partner_programs entry by slug
const { data: partnerProgram } = await adminClient
  .from('partner_programs')
  .select('id, slug, name')
  .eq('slug', referralProgramSlug)
  .single();

// 3. MUST find a match - throw error if not found
if (!partnerProgram) {
  throw new Error(
    `No matching partner_programs entry for slug="${referralProgramSlug}"`
  );
}

// 4. Use the partner_programs.id for ledger entry
const partnerProgramId = partnerProgram.id;

// 5. Insert ledger entry with correct program_id
await adminClient.from('partner_ledger_entries').insert({
  program_id: partnerProgramId, // ← This MUST be partner_programs.id
  source: 'referral',
  source_ref: conversionId.toString(),
  // ...
});
```

## Migration Setup

Both programs must be seeded in migrations:

### `supabase/migrations/20260207_referral_system.sql`
```sql
-- Create referral program
INSERT INTO referral_programs (slug, name, description, status) 
VALUES ('consultant-referral', 'Consultant Referral Program', '...', 'active')
ON CONFLICT (slug) DO NOTHING;

-- Create matching partner program for ledger integration
INSERT INTO partner_programs (slug, name)
VALUES ('consultant-referral', 'Consultant Referral Program')
ON CONFLICT (slug) DO NOTHING;
```

### `supabase/migrations/20260205_huntpay_partner_ledger.sql`
```sql
-- Create HuntPay partner program
INSERT INTO partner_programs (slug, name)
VALUES ('huntpay', 'HuntPay')
ON CONFLICT (slug) DO NOTHING;
```

## Verification Queries

### Check program mapping
```sql
SELECT 
  'referral_programs' as table_name,
  id,
  slug,
  name
FROM referral_programs
WHERE slug = 'consultant-referral'

UNION ALL

SELECT 
  'partner_programs' as table_name,
  id::text,
  slug,
  name
FROM partner_programs
WHERE slug = 'consultant-referral';
```

**Expected output**: 2 rows with **different IDs** but **same slug**

### Verify ledger entries use correct program_id
```sql
SELECT 
  le.id,
  le.source,
  le.source_ref,
  pp.slug as partner_program_slug,
  pp.name as partner_program_name,
  le.earnings_amount,
  le.created_at
FROM partner_ledger_entries le
JOIN partner_programs pp ON pp.id = le.program_id
WHERE le.source = 'referral'
ORDER BY le.created_at DESC
LIMIT 10;
```

**Expected**: All referral entries should have `partner_program_slug = 'consultant-referral'`

## Common Bugs

### ❌ Bug: Using referral_programs.id as program_id
```typescript
// WRONG - This will cause foreign key violation
const programId = conversion.program_id; // ← This is referral_programs.id!

await adminClient.from('partner_ledger_entries').insert({
  program_id: programId, // ❌ FK violation or wrong program
});
```

### ✅ Fix: Map slug to partner_programs.id
```typescript
// CORRECT - Look up partner_programs by slug
const { data: partnerProgram } = await adminClient
  .from('partner_programs')
  .select('id')
  .eq('slug', conversion.referral_programs.slug)
  .single();

await adminClient.from('partner_ledger_entries').insert({
  program_id: partnerProgram.id, // ✅ Correct FK to partner_programs
});
```

### ❌ Bug: Falling back to first/random program
```typescript
// WRONG - Don't fall back to huntpay or first row
const { data: programs } = await adminClient
  .from('partner_programs')
  .select('id')
  .limit(1);

const programId = programs[0].id; // ❌ Might be huntpay!
```

### ✅ Fix: Require exact match
```typescript
// CORRECT - Throw explicit error if not found
if (!partnerProgram) {
  throw new Error(
    `Partner program with slug="${referralSlug}" must be created via migration`
  );
}
```

## Logging

Look for these log markers to debug program mapping:

```
[REFERRAL_LEDGER_MAP] Looking up partner_programs by slug: consultant-referral
[REFERRAL_LEDGER_MAP] Mapped successfully: {
  referral_program_slug: 'consultant-referral',
  partner_program_id: 'b158d0e4-...',
  partner_program_slug: 'consultant-referral',
  partner_program_name: 'Consultant Referral Program'
}
[REFERRAL_LEDGER_INSERT] Preparing ledger entry: {
  program_id: 'b158d0e4-...',
  source: 'referral',
  earnings_amount: 20.00,
  ...
}
```

## Troubleshooting

### Issue: Ledger entries created under wrong program

**Symptom**:
```sql
SELECT pp.slug, COUNT(*) 
FROM partner_ledger_entries le
JOIN partner_programs pp ON pp.id = le.program_id
WHERE le.source = 'referral'
GROUP BY pp.slug;

-- Returns: huntpay | 5  (❌ WRONG!)
```

**Diagnosis**:
1. Check if partner_programs entry exists:
   ```sql
   SELECT * FROM partner_programs WHERE slug = 'consultant-referral';
   ```
2. Check logs for `[REFERRAL_LEDGER_MAP]` - does it find the right program?
3. Check code - is it using the mapped `partnerProgramId`?

**Fix**:
1. Run migration to create partner_programs entry
2. Update code to use mapped program_id
3. (Optional) Correct existing wrong entries:
   ```sql
   -- Get correct program_id
   SELECT id FROM partner_programs WHERE slug = 'consultant-referral';
   
   -- Update wrong entries
   UPDATE partner_ledger_entries
   SET program_id = '<correct-id>'
   WHERE source = 'referral'
   AND program_id = '<wrong-huntpay-id>';
   ```

### Issue: Migration fails with "partner_programs does not exist"

**Cause**: Running referral_system migration before huntpay_partner_ledger migration

**Fix**: Migrations must run in order:
1. `20260205_huntpay_partner_ledger.sql` (creates partner_programs table)
2. `20260207_referral_system.sql` (inserts consultant-referral program)

Or add `CREATE TABLE IF NOT EXISTS` check in referral_system migration.

## Summary

✅ **DO**:
- Map by slug: `referral_programs.slug → partner_programs.slug`
- Throw explicit errors if mapping fails
- Log the mapping for debugging
- Create both programs in migrations

❌ **DON'T**:
- Use `referral_programs.id` as `partner_ledger_entries.program_id`
- Fall back to first/random program if slug not found
- Assume the IDs are the same between tables
- Create partner_programs entries dynamically at runtime
