# Referral Table Namespacing - Implementation Summary

## ✅ Task Complete

Successfully implemented namespaced `referral_*` tables to avoid collision with existing HuntPay `conversions` and related tables.

## What Was Done

### A. Created New Migration File
**File**: `supabase/migrations/20260207_referral_system.sql`

**Tables Created**:
1. ✅ `referral_programs` - Referral program definitions
2. ✅ `referral_program_rules` - Payout rules by role and conversion type
3. ✅ `referral_participants` - Consultants and advocates with referral codes
4. ✅ `referral_attributions` - Referral link click tracking
5. ✅ `referral_leads` - Lead form submissions
6. ✅ `referral_conversions` - Conversion events eligible for payout
7. ✅ `referral_reviews` - Client testimonials
8. ✅ `referral_review_tokens` - One-time review submission links

**Indexes Added**:
- Slug, referral_code, status, token lookups
- Foreign key indexes for joins
- Performance indexes for common queries

**Seed Data Included**:
- ✅ Program: `consultant-referral` (slug)
- ✅ Participant: `DEMO-CONSULTANT` (referral code)
- ✅ Participant: `DEMO-ADVOCATE` (referral code)
- ✅ Review token: `DEMO-REVIEW-TOKEN` (expires in 30 days)
- ✅ Rules:
  - Consultant: $50 for `booking_confirmed`, $100 for `payment_completed`
  - Advocate: $20 for `lead_submitted`, $30 for `booking_confirmed`

### B. Updated Public Pages

**Files Modified**:
1. ✅ `src/app/r/[code]/page.tsx`
   - Now queries `referral_participants` and `referral_programs`
   - Shows published `referral_reviews`
   - Improved error handling (config errors vs 404s)

2. ✅ `src/app/review/[token]/page.tsx`
   - Now queries `referral_review_tokens` and `referral_programs`
   - Improved error handling

**Result**: `/r/DEMO-CONSULTANT` and `/review/DEMO-REVIEW-TOKEN` will work after migration

### C. Updated API Routes

**Files Modified**:
1. ✅ `src/app/api/referrals/track-attribution/route.ts`
   - Uses `referral_participants` and `referral_attributions`

2. ✅ `src/app/api/referrals/submit-lead/route.ts`
   - Uses `referral_participants`, `referral_leads`, `referral_conversions`
   - Auto-creates approved conversion for `lead_submitted` type
   - Triggers partner ledger entry creation

3. ✅ `src/app/api/referrals/submit-review/route.ts`
   - Uses `referral_review_tokens`, `referral_reviews`, `referral_participants`
   - Marks token as used after submission

4. ✅ `src/app/api/referrals/conversions/[id]/approve/route.ts`
   - Reads/writes `referral_conversions` (NOT huntpay conversions)
   - Uses admin client for DB operations
   - Creates partner ledger entry on approval
   - Rollback to pending if ledger creation fails

5. ✅ `src/app/api/referrals/conversions/[id]/reject/route.ts`
   - Reads/writes `referral_conversions`
   - Uses admin client for DB operations

### D. Updated Admin Dashboard Pages

**Files Modified**:
1. ✅ `src/app/(dashboard)/dashboard/programs/manage/page.tsx`
   - Queries `referral_programs`, `referral_participants`, `referral_conversions`, `referral_reviews`

2. ✅ `src/app/(dashboard)/dashboard/programs/participants/page.tsx`
   - Queries `referral_participants` with `referral_programs` relation

3. ✅ `src/app/(dashboard)/dashboard/programs/conversions/page.tsx`
   - Queries `referral_conversions` with relations
   - Shows pending/approved/rejected stats

4. ✅ `src/app/(dashboard)/dashboard/programs/reviews/page.tsx`
   - Queries `referral_reviews` with relations

### E. Updated Partner Ledger Integration

**File**: `src/lib/referrals/partners-integration.ts`

**Changes**:
- ✅ Reads from `referral_conversions` (not huntpay conversions)
- ✅ Joins `referral_programs` and `referral_participants`
- ✅ Fetches payout rules from `referral_program_rules`
- ✅ Creates entries in shared `partner_ledger_entries` with `source: 'referral'`
- ✅ Uses `createAdminClient()` for all DB operations
- ✅ Maintains idempotency via unique constraint on `(source, source_ref)`

**Result**: When admin approves a referral conversion, it creates a ledger entry visible in the Partners dashboard.

### F. Documentation Created

**Files Created**:
1. ✅ `REFERRAL_TABLE_NAMESPACE.md`
   - Explains why `referral_` prefix is used
   - Table mapping between HuntPay and Referral systems
   - Common mistakes to avoid
   - Testing guide with demo codes
   - Database diagram

2. ✅ `SUPABASE_DUAL_CLIENTS.md` (already existed, still relevant)
   - User vs Admin client architecture
   - When to use each client
   - Security best practices

3. ✅ `SUPABASE_MIGRATION_GUIDE.md` (already existed, still relevant)
   - Quick reference patterns
   - Migration checklist

4. ✅ `IMPLEMENTATION_SUMMARY.md` (already existed)
   - Dual client implementation details

5. ✅ `REFERRAL_NAMESPACING_SUMMARY.md` (this file)
   - Complete overview of namespacing changes

## HuntPay System - Untouched ✅

**Verified unchanged**:
- ✅ `src/lib/huntpay/core.ts` - Still uses `conversions`, `hunts`, `stops`, `teams`
- ✅ `src/lib/huntpay/partners-integration.ts` - Still uses HuntPay `conversions`
- ✅ `src/app/huntpay/*` - All HuntPay pages unchanged
- ✅ `src/app/(dashboard)/dashboard/huntpay/*` - Admin pages unchanged
- ✅ HuntPay tables not renamed or modified

**Both systems write to**:
- `partner_ledger_entries` (shared)
  - HuntPay entries: `source: 'huntpay'`
  - Referral entries: `source: 'referral'`

## Build Verification

✅ **Build successful** (exit code 0)
- Compilation time: 2.1 minutes
- All 104 pages generated
- Zero TypeScript errors
- Zero import errors

## Security Verification

✅ **No admin client in client components**

Files importing `createAdminClient` (all server-side):
- `src/lib/supabase/admin.ts` (definition)
- `src/lib/referrals/partners-integration.ts` (lib file)
- `src/lib/huntpay/partners-integration.ts` (lib file)
- `src/lib/huntpay/core.ts` (lib file)
- `src/app/api/referrals/conversions/[id]/approve/route.ts` (API route)
- `src/app/api/referrals/conversions/[id]/reject/route.ts` (API route)

**Zero** client component imports found ✅

## Testing Checklist

After running the migration, test these flows:

### 1. Referral Landing Page
```bash
# Visit: http://localhost:3000/r/DEMO-CONSULTANT
# Should see: Landing page with program info and CTA
# Submit: Lead form
# Expected: Lead created in referral_leads
# Expected: Conversion created in referral_conversions (auto-approved)
# Expected: Ledger entry in partner_ledger_entries with source='referral'
```

### 2. Review Submission
```bash
# Visit: http://localhost:3000/review/DEMO-REVIEW-TOKEN
# Submit: 5-star review with testimonial
# Expected: Review in referral_reviews table
# Expected: Token marked as used
# Expected: Referral code returned for sharing (if rating >= 4)
```

### 3. Admin Approval
```bash
# Login as admin (email in ADMIN_EMAILS)
# Visit: /dashboard/programs/conversions
# Click "Approve" on a pending conversion
# Expected: Status changed to 'approved' in referral_conversions
# Expected: Ledger entry created in partner_ledger_entries
# Visit: /dashboard/partners/ledger
# Expected: New entry visible with source='referral'
```

### 4. Partner Dashboard
```bash
# Visit: /dashboard/partners/dashboard
# Expected: Totals reflect referral_conversions ledger entries
# Expected: Chart shows earnings trend
# Visit: /dashboard/partners/ledger
# Expected: Table shows entries from both 'huntpay' and 'referral' sources
```

## Migration Steps for Production

1. **Backup Database**
   ```bash
   # Create snapshot in Supabase dashboard
   ```

2. **Run Migration**
   ```bash
   # Via Supabase CLI
   supabase db push
   
   # Or via SQL Editor in Supabase dashboard
   # Copy/paste contents of supabase/migrations/20260207_referral_system.sql
   ```

3. **Verify Seed Data**
   ```sql
   SELECT * FROM referral_programs WHERE slug = 'consultant-referral';
   SELECT * FROM referral_participants WHERE referral_code IN ('DEMO-CONSULTANT', 'DEMO-ADVOCATE');
   SELECT * FROM referral_review_tokens WHERE token = 'DEMO-REVIEW-TOKEN';
   SELECT * FROM referral_program_rules;
   ```

4. **Test Public Pages**
   - Visit `/r/DEMO-CONSULTANT`
   - Visit `/review/DEMO-REVIEW-TOKEN`
   - Submit test lead

5. **Test Admin Flow**
   - View conversions in `/dashboard/programs/conversions`
   - Approve a conversion
   - Check partner ledger shows new entry

## Key Differences: HuntPay vs Referral

| Feature | HuntPay | Referral System |
|---------|---------|-----------------|
| **Purpose** | Scavenger hunt teams | Consultant/advocate referrals |
| **Table Prefix** | None | `referral_` |
| **Conversions Table** | `conversions` | `referral_conversions` |
| **Primary Entity** | Teams | Participants |
| **Attribution** | `attributions` | `referral_attributions` |
| **Approval Flow** | Admin panel at `/dashboard/huntpay/admin` | Admin panel at `/dashboard/programs/*` |
| **Public Pages** | `/huntpay/*` | `/r/*` and `/review/*` |
| **Ledger Source** | `'huntpay'` | `'referral'` |

## Files Summary

### New Files (2)
- `supabase/migrations/20260207_referral_system.sql`
- `REFERRAL_TABLE_NAMESPACE.md`

### Modified Files (12)
1. `src/app/r/[code]/page.tsx`
2. `src/app/review/[token]/page.tsx`
3. `src/app/api/referrals/track-attribution/route.ts`
4. `src/app/api/referrals/submit-lead/route.ts`
5. `src/app/api/referrals/submit-review/route.ts`
6. `src/app/api/referrals/conversions/[id]/approve/route.ts`
7. `src/app/api/referrals/conversions/[id]/reject/route.ts`
8. `src/lib/referrals/partners-integration.ts`
9. `src/app/(dashboard)/dashboard/programs/manage/page.tsx`
10. `src/app/(dashboard)/dashboard/programs/participants/page.tsx`
11. `src/app/(dashboard)/dashboard/programs/conversions/page.tsx`
12. `src/app/(dashboard)/dashboard/programs/reviews/page.tsx`

### Unchanged (As Required) ✅
- All HuntPay files (`src/lib/huntpay/*`, `src/app/huntpay/*`)
- All Prisma files and payment link functionality
- All existing HuntPay tables
- `package.json` dependencies (no new packages)

## Environment Variables Required

```bash
# Supabase (unchanged)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Admin access (unchanged)
ADMIN_EMAILS=admin1@example.com,admin2@example.com

# Prisma (untouched)
DATABASE_URL=postgresql://...
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Next.js Application                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  HuntPay System              Referral System            │
│  ───────────────             ────────────────           │
│  • hunts                     • referral_programs        │
│  • stops                     • referral_participants    │
│  • teams                     • referral_conversions     │
│  • conversions               • referral_leads           │
│  • sponsors                  • referral_reviews         │
│  • attributions              • referral_attributions    │
│  • nfts                      • referral_review_tokens   │
│                              • referral_program_rules   │
│                                                         │
│           ↓                            ↓                │
│  ┌─────────────────────────────────────────────┐       │
│  │      Shared Partner Ledger                  │       │
│  │  • partner_programs                         │       │
│  │  • partner_entities                         │       │
│  │  • partner_ledger_entries                   │       │
│  │    - source: 'huntpay'  ←─── HuntPay        │       │
│  │    - source: 'referral' ←─── Referral       │       │
│  └─────────────────────────────────────────────┘       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## URL Structure

### HuntPay URLs (Unchanged)
- `/huntpay/join` - Team creation
- `/huntpay/hunt/[slug]` - Hunt overview
- `/huntpay/stop/[id]` - Stop challenges
- `/dashboard/huntpay/admin` - HuntPay admin

### Referral URLs (Now Working)
- `/r/DEMO-CONSULTANT` - Public referral landing
- `/review/DEMO-REVIEW-TOKEN` - Review submission
- `/dashboard/programs/manage` - Programs admin
- `/dashboard/programs/participants` - View participants
- `/dashboard/programs/conversions` - Approve conversions
- `/dashboard/programs/reviews` - Moderate reviews

### Shared URLs
- `/dashboard/partners/dashboard` - Aggregated earnings (both systems)
- `/dashboard/partners/ledger` - All ledger entries (both systems)

## Test Flow After Migration

### 1. Public Referral Flow
```
User visits /r/DEMO-CONSULTANT
  → referral_attributions created
  → User submits lead form
  → referral_leads created
  → referral_conversions created (status: 'approved', type: 'lead_submitted')
  → partner_ledger_entries created (source: 'referral', earnings: $20)
  → Visible in /dashboard/partners/ledger
```

### 2. Review Flow
```
User visits /review/DEMO-REVIEW-TOKEN
  → referral_review_tokens validated
  → User submits 5-star review
  → referral_reviews created (status: 'pending')
  → Token marked as used
  → Referral code returned for sharing
```

### 3. Admin Approval Flow
```
Admin visits /dashboard/programs/conversions
  → Lists referral_conversions (status: 'pending')
  → Admin clicks Approve
  → API validates admin auth (ADMIN_EMAILS)
  → Admin client updates referral_conversions (status: 'approved')
  → createPartnerLedgerEntryForReferralConversion() called
  → Reads referral_program_rules to calculate earnings
  → Inserts partner_ledger_entries (source: 'referral')
  → If insert fails → rollback conversion to 'pending'
  → Success → ledger entry visible in Partners module
```

## Data Flow Diagram

```
Referral Landing (/r/[code])
    ↓
referral_attributions (click tracking)
    ↓
Lead Form Submission
    ↓
referral_leads
    ↓
referral_conversions (auto-approved for lead_submitted)
    ↓
createPartnerLedgerEntryForReferralConversion()
    ↓
referral_program_rules (lookup payout amount)
    ↓
partner_ledger_entries (source: 'referral')
    ↓
Visible in /dashboard/partners/ledger
```

## Rollback Mechanism

If partner ledger creation fails during approval:

```typescript
// In approve route:
try {
  await createPartnerLedgerEntryForReferralConversion(conversionId);
} catch (ledgerError) {
  // Rollback to pending
  await adminClient
    .from('referral_conversions')  // ✅ Correct table
    .update({ 
      status: 'pending',
      approved_at: null,
      approved_by: null,
    })
    .eq('id', conversionId);
    
  return 500 error
}
```

## Idempotency

Duplicate approvals are prevented by:

1. **Status check**: If conversion already approved → return 400
2. **Unique constraint**: `partner_ledger_entries(source, source_ref)` prevents duplicate inserts
3. **Error code check**: If insert returns 23505 → log and continue (already exists)

## SQL to Verify After Migration

```sql
-- Check seed data exists
SELECT * FROM referral_programs WHERE slug = 'consultant-referral';
SELECT * FROM referral_participants ORDER BY created_at;
SELECT * FROM referral_program_rules ORDER BY priority DESC;
SELECT * FROM referral_review_tokens WHERE token = 'DEMO-REVIEW-TOKEN';

-- Check constraints
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public' 
  AND tc.table_name LIKE 'referral_%'
  AND tc.constraint_type = 'UNIQUE';

-- Should see:
-- referral_programs(slug)
-- referral_participants(referral_code)
-- referral_review_tokens(token)
-- referral_program_rules(program_id, role, conversion_type, priority)
```

## Common Post-Migration Issues

### Issue: "Table referral_programs does not exist"
**Fix**: Run the migration file in Supabase

### Issue: "Foreign key violation"
**Fix**: Check that referral_programs has seed data

### Issue: "Conversion not found" when approving
**Fix**: Verify you're testing with referral_conversions, not huntpay conversions

### Issue: Public pages return 404
**Fix**: Check middleware matcher is `/dashboard/:path*` only (should not block `/r/*` or `/review/*`)

## Next Steps

1. **Run Migration**:
   ```bash
   # Apply to Supabase
   supabase db push
   
   # Or run SQL directly in Supabase dashboard
   ```

2. **Verify Seed Data**:
   ```bash
   # Check DEMO codes exist
   curl http://localhost:3000/r/DEMO-CONSULTANT
   curl http://localhost:3000/review/DEMO-REVIEW-TOKEN
   ```

3. **Test Full Flow**:
   - Submit lead via public page
   - Check `/dashboard/programs/conversions`
   - Approve conversion
   - Check `/dashboard/partners/ledger`

4. **Deploy**:
   - Push to production
   - Verify env vars set (SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS)
   - Run migration on production Supabase

## Success Criteria ✅

- ✅ Migration file created with all referral tables
- ✅ Seed data included (DEMO codes and rules)
- ✅ All referral code updated to use namespaced tables
- ✅ HuntPay system completely untouched
- ✅ Admin client used for all approval/ledger operations
- ✅ Rollback mechanism in place
- ✅ Idempotency maintained
- ✅ Public pages have proper error handling
- ✅ Build successful (exit code 0)
- ✅ No admin client imports in client components
- ✅ Documentation complete

## Status: ✅ READY FOR MIGRATION

All code changes are complete and verified. Run the migration file to activate the referral system.
