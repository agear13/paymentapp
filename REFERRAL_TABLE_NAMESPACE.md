# Referral System Table Namespacing

## Why `referral_` Prefix?

The referral/consultant program system uses **namespaced tables** with the `referral_` prefix to avoid collision with the existing HuntPay scavenger hunt system.

## Background

This codebase contains TWO separate systems that both track conversions and programs:

1. **HuntPay System** (Web3 Scavenger Hunt):
   - Tables: `hunts`, `stops`, `teams`, `conversions`, `sponsors`, `attributions`, `nfts`
   - Purpose: Track teams completing venue + web3 challenges
   - Conversions: Proof-based (tx hash, screenshots) submitted by teams

2. **Referral System** (Consultant/Advocate Programs):
   - Tables: `referral_programs`, `referral_conversions`, `referral_participants`, etc.
   - Purpose: Track consultant/advocate referrals and calculate payouts
   - Conversions: Lead submissions, bookings, and payment events

## Table Mapping

| Referral System | HuntPay System | Notes |
|----------------|----------------|-------|
| `referral_programs` | `hunts` | Different purpose |
| `referral_participants` | `teams` | Different entity types |
| `referral_conversions` | `conversions` | **Would conflict without prefix** |
| `referral_attributions` | `attributions` | **Would conflict without prefix** |
| `referral_leads` | N/A | Referral-specific |
| `referral_reviews` | N/A | Referral-specific |
| `referral_review_tokens` | N/A | Referral-specific |
| `referral_program_rules` | N/A | Referral-specific |

## Critical: Do NOT Mix These Systems

### ❌ Wrong - Using HuntPay tables for referrals
```typescript
// BAD: This queries HuntPay conversions, not referral conversions!
const { data } = await supabase
  .from('conversions')  // ❌ HuntPay table
  .select('*');
```

### ✅ Correct - Using referral tables
```typescript
// GOOD: This queries referral conversions
const { data } = await supabase
  .from('referral_conversions')  // ✅ Referral table
  .select('*');
```

## File Organization

### HuntPay Files (Use unprefixed tables)
- `src/lib/huntpay/*`
- `src/app/huntpay/*`
- `src/app/(dashboard)/dashboard/huntpay/*`
- These use: `conversions`, `hunts`, `stops`, `teams`, etc.

### Referral Files (Use `referral_` prefixed tables)
- `src/lib/referrals/*`
- `src/app/api/referrals/*`
- `src/app/r/[code]/*`
- `src/app/review/[token]/*`
- `src/app/(dashboard)/dashboard/programs/*`
- These use: `referral_conversions`, `referral_programs`, `referral_participants`, etc.

## Partner Ledger Integration

Both systems write to the **same partner ledger** but use different source identifiers:

```typescript
// HuntPay ledger entries
{
  source: 'huntpay',
  source_ref: '<huntpay_conversion_id>',
  // ...
}

// Referral ledger entries
{
  source: 'referral',
  source_ref: '<referral_conversion_id>',
  // ...
}
```

The partner ledger (`partner_programs`, `partner_entities`, `partner_ledger_entries`) is shared infrastructure that aggregates earnings from BOTH systems.

## Migration Files

- `supabase/migrations/20260205_huntpay_partner_ledger.sql` - HuntPay tables
- `supabase/migrations/20260207_referral_system.sql` - Referral tables (NEW)

## Common Mistakes to Avoid

### 1. Using wrong table in referral code
```typescript
// ❌ Wrong - fetching from HuntPay conversions
const { data } = await adminClient
  .from('conversions')
  .select('*')
  .eq('id', referralConversionId);

// ✅ Correct - fetching from referral conversions
const { data } = await adminClient
  .from('referral_conversions')
  .select('*')
  .eq('id', referralConversionId);
```

### 2. Mixing foreign key relationships
```typescript
// ❌ Wrong - joining referral data with HuntPay tables
const { data } = await supabase
  .from('referral_participants')
  .select(`
    *,
    programs (name)  // ❌ Would try to join hunts, not referral_programs!
  `);

// ✅ Correct - using explicit foreign key name
const { data } = await supabase
  .from('referral_participants')
  .select(`
    *,
    referral_programs!referral_participants_program_id_fkey (name)
  `);
```

### 3. Approving wrong conversion type
```typescript
// Make sure your approve route targets the right table
// File: src/app/api/referrals/conversions/[id]/approve/route.ts
// ✅ Uses referral_conversions

// File: src/app/api/huntpay/admin/conversions/[id]/approve/route.ts  
// ✅ Uses conversions (HuntPay)
```

## Testing Your Code

When testing, use the correct demo codes:

### Referral System
- Referral code: `DEMO-CONSULTANT` or `DEMO-ADVOCATE`
- URL: `http://localhost:3000/r/DEMO-CONSULTANT`
- Review token: `DEMO-REVIEW-TOKEN`
- URL: `http://localhost:3000/review/DEMO-REVIEW-TOKEN`

### HuntPay System
- Team-based, different flow entirely
- URL: `http://localhost:3000/huntpay/join`

## Database Diagram (Simplified)

```
HuntPay System              Referral System
──────────────              ───────────────
hunts                       referral_programs
├── stops                   ├── referral_program_rules
│   └── challenges          ├── referral_participants
├── teams                   │   └── referral_attributions
│   ├── conversions         ├── referral_conversions
│   └── attributions        ├── referral_leads
└── sponsors                └── referral_reviews
                                └── referral_review_tokens

            ↓                           ↓
       Both systems write to Partner Ledger
       ──────────────────────────────────────
       partner_programs
       ├── partner_entities
       └── partner_ledger_entries
           (with source: 'huntpay' or 'referral')
```

## Related Documentation

- `SUPABASE_DUAL_CLIENTS.md` - User vs Admin client architecture
- `IMPLEMENTATION_SUMMARY.md` - What was changed in dual client refactor
- `supabase/migrations/20260207_referral_system.sql` - Referral table schema

## When Adding New Features

If adding a new field or table:

1. **Determine which system** it belongs to (HuntPay or Referral)
2. **Use appropriate naming**:
   - HuntPay: unprefixed (e.g., `new_huntpay_feature`)
   - Referral: `referral_` prefix (e.g., `referral_new_feature`)
3. **Update code** in the corresponding directories
4. **Test** with the appropriate demo data

## Summary

- ✅ Referral system uses `referral_*` tables
- ✅ HuntPay system uses unprefixed tables (`conversions`, `hunts`, etc.)
- ✅ Both write to shared `partner_ledger_entries`
- ❌ Never mix table names between systems
- ❌ Never rename existing HuntPay tables
