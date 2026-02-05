# HuntPay → Partners Ledger Integration

## Overview

This integration allows approved HuntPay conversions to create real ledger entries that appear in the Partners module UI, replacing mock data with event-driven earnings tracking.

## Architecture

### Dedicated Partner Ledger Schema

The partner ledger is **separate** from the main `payment_link` accounting system. It uses its own set of tables:

- `partner_programs` - Program definitions (e.g., "HuntPay")
- `partner_entities` - Attributed entities (sponsors, hunts, stops)
- `partner_ledger_entries` - Earnings records (the core ledger)
- `partner_payout_runs` - Payout batch tracking

This separation ensures that HuntPay conversions (which are not payment-link transactions) don't pollute the accounting ledger.

## Database Schema

### partner_programs

```sql
CREATE TABLE partner_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Purpose**: Defines partner programs (e.g., "HuntPay", "Referral Network")

### partner_entities

```sql
CREATE TABLE partner_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES partner_programs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('sponsor', 'hunt', 'stop')),
  entity_ref_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(program_id, entity_type, entity_ref_id)
);
```

**Purpose**: Tracks attributed entities within a program (e.g., sponsors in HuntPay)

### partner_ledger_entries

```sql
CREATE TABLE partner_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES partner_programs(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES partner_entities(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'huntpay',
  source_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'reversed')),
  gross_amount NUMERIC(12, 2),
  earnings_amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source, source_ref)
);
```

**Purpose**: The main earnings ledger. Each row represents an earnings event.

**Key fields**:
- `source` + `source_ref`: Idempotency key (e.g., `source='huntpay'`, `source_ref=conversion_id`)
- `status`: `pending` (awaiting payout), `paid` (included in payout run), `reversed` (cancelled)
- `earnings_amount`: The partner's share (calculated from sponsor payout rules)

### partner_payout_runs

```sql
CREATE TABLE partner_payout_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES partner_programs(id) ON DELETE CASCADE,
  period_start DATE,
  period_end DATE,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Purpose**: Batches of payouts (not yet implemented in UI)

## How It Works

### Flow: HuntPay Conversion → Partner Ledger Entry

1. **User completes HuntPay challenge**
   - Team submits conversion proof (tx hash, screenshot, etc.)
   - Conversion record created with `status='pending'`

2. **Admin approves conversion**
   - Admin visits `/dashboard/huntpay/admin`
   - Clicks "Approve" on pending conversion
   - API route: `POST /api/huntpay/admin/conversions/[id]/approve`

3. **Ledger entry created**
   - Route calls `createPartnerLedgerEntryForConversion(conversionId)`
   - Function loads conversion + sponsor + challenge data
   - Calculates `earnings_amount` from `sponsors.payout_per_conversion`
   - Upserts `partner_programs` (slug='huntpay')
   - Upserts `partner_entities` (for the sponsor)
   - Inserts `partner_ledger_entries` (idempotent via `UNIQUE(source, source_ref)`)

4. **Entry appears in Partners UI**
   - `/dashboard/partners/ledger` - Shows real rows from `partner_ledger_entries`
   - `/dashboard/partners/dashboard` - Displays real totals (Total Earnings, Pending, Paid Out)

### Idempotency

The `UNIQUE(source, source_ref)` constraint ensures that approving the same conversion multiple times does not create duplicate ledger entries.

If a ledger entry already exists for a conversion, the insert fails gracefully (PostgreSQL error code `23505`), and the function logs and continues.

### Rollback on Failure

If `createPartnerLedgerEntryForConversion` fails, the approval route **reverts** the conversion status back to `pending`, ensuring data consistency.

## Code Structure

### Integration Layer

**File**: `src/lib/huntpay/partners-integration.ts`

**Key function**:

```typescript
export async function createPartnerLedgerEntryForConversion(
  conversionId: string
): Promise<void>
```

**Responsibilities**:
- Load conversion + sponsor data
- Calculate earnings amount
- Upsert program and entity
- Insert ledger entry (idempotent)

**Utility function**:

```typescript
export async function getPartnerLedgerSummary(programSlug: string = 'huntpay')
```

Fetches aggregate data for a program (total/pending/paid earnings, entry list).

### Admin Approval Route

**File**: `src/app/api/huntpay/admin/conversions/[id]/approve/route.ts`

**Key logic**:

```typescript
// Update conversion status
await supabase.from('conversions').update({
  status: 'approved',
  reviewed_at: new Date().toISOString(),
  reviewed_by: user.email,
}).eq('id', conversionId);

// Create ledger entry
try {
  await createPartnerLedgerEntryForConversion(conversionId);
} catch (ledgerError) {
  // Rollback approval on failure
  await supabase.from('conversions').update({ status: 'pending' }).eq('id', conversionId);
  throw new Error('Failed to create partner ledger entry');
}
```

### Partners UI

**Files**:
- `src/app/(dashboard)/dashboard/partners/ledger/page.tsx` (server component)
- `src/app/(dashboard)/dashboard/partners/dashboard/page.tsx` (server component)
- `src/components/partners/dashboard-client.tsx` (client component for interactive parts)
- `src/components/partners/ledger-entry-dialog.tsx` (client component for entry details)

**Data fetching** (server-side):

```typescript
const { data: program } = await supabase
  .from('partner_programs')
  .select('id')
  .eq('slug', 'huntpay')
  .single();

const { data: entries } = await supabase
  .from('partner_ledger_entries')
  .select('*')
  .eq('program_id', program?.id || '')
  .order('created_at', { ascending: false });

const totalEarnings = entries.reduce((sum, e) => sum + parseFloat(e.earnings_amount), 0);
const pendingEarnings = entries.filter(e => e.status === 'pending').reduce(...);
const paidOut = entries.filter(e => e.status === 'paid').reduce(...);
```

## Setup Instructions

### 1. Run Migration

The migration file `supabase/migrations/20260205_huntpay_partner_ledger.sql` creates all necessary tables and indexes.

**Run migration**:

```bash
# If using Supabase CLI
supabase db push

# Or apply migration manually in Supabase SQL Editor
# Copy contents of supabase/migrations/20260205_huntpay_partner_ledger.sql
```

**Verify migration**:

```sql
SELECT * FROM partner_programs WHERE slug = 'huntpay';
-- Should return 1 row: { id: <uuid>, slug: 'huntpay', name: 'HuntPay', created_at: <timestamp> }
```

### 2. Environment Variables

Ensure the following environment variables are set (already required for Supabase):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Test the Integration

**Test flow**:

1. Create a HuntPay hunt, stops, and challenges with sponsors
2. Complete a challenge as a team and submit a conversion proof
3. As admin, approve the conversion at `/dashboard/huntpay/admin`
4. Visit `/dashboard/partners/ledger` - you should see a new ledger entry
5. Visit `/dashboard/partners/dashboard` - totals should reflect the new entry

**Test idempotency**:

Approving the same conversion twice should not create duplicate entries. Check logs for:

```
Ledger entry already exists for conversion: <conversion-id>
```

## Future Enhancements

### Payout Processing

Currently, ledger entries are created with `status='pending'`. To mark them as paid:

1. Create a payout run in `partner_payout_runs`
2. Update `partner_ledger_entries.status` to `'paid'` for included entries
3. Link entries to payout run (add `payout_run_id` column)

### Multi-Program Support

The schema supports multiple programs (not just HuntPay). To add a new program:

```sql
INSERT INTO partner_programs (slug, name)
VALUES ('referral-network', 'Referral Network');
```

Then create integration logic similar to `createPartnerLedgerEntryForConversion` for the new program's events.

### CSV Export

Add a route to export ledger entries as CSV for accounting/reconciliation:

```typescript
// GET /api/partners/ledger/export?program=huntpay&period=2026-01
```

## Troubleshooting

### Ledger entries not appearing in UI

**Check**:
1. Migration ran successfully: `SELECT * FROM partner_programs;`
2. Conversion was approved: `SELECT status FROM conversions WHERE id = '<conversion-id>';`
3. Ledger entry exists: `SELECT * FROM partner_ledger_entries WHERE source_ref = '<conversion-id>';`

### Duplicate entry errors (not idempotent)

**Symptom**: PostgreSQL error `duplicate key value violates unique constraint`

**Cause**: The `UNIQUE(source, source_ref)` constraint is working. The code should catch this as error code `23505` and log it.

**Fix**: Check that `createPartnerLedgerEntryForConversion` has proper error handling:

```typescript
if (insertError) {
  if (insertError.code === '23505') {
    console.log('Ledger entry already exists for conversion:', conversionId);
    return;
  }
  throw insertError;
}
```

### Earnings amount is 0

**Cause**: `sponsors.payout_per_conversion` is `NULL` or `0`.

**Fix**: Update sponsor payout rules:

```sql
UPDATE sponsors
SET payout_per_conversion = 10.00, payout_currency = 'USD'
WHERE id = '<sponsor-id>';
```

## Migration Reference

**File**: `supabase/migrations/20260205_huntpay_partner_ledger.sql`

**Key operations**:
- Creates 4 tables: `partner_programs`, `partner_entities`, `partner_ledger_entries`, `partner_payout_runs`
- Adds indexes for performance on foreign keys and status filters
- Inserts initial 'huntpay' program record

**Safe to re-run**: Yes (uses `ON CONFLICT DO NOTHING` for initial program insert)

## Summary

This integration provides a clean separation between HuntPay's conversion tracking and the Partners module's earnings ledger, while enabling real-time visibility of earnings in the Partners UI as HuntPay conversions are approved.

The system is designed for:
- **Idempotency**: Safe to retry operations
- **Atomicity**: Rollback on failure
- **Scalability**: Separate schema, indexed queries
- **Extensibility**: Multi-program support built-in
