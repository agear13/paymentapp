# Supabase Dual Client Architecture

This application uses **two separate Supabase clients** for the referral/affiliate module to ensure security and reliability while keeping the main payment link functionality (Prisma + DATABASE_URL) completely independent.

## Overview

- **User/Session Client**: For user-facing operations with cookie-based authentication (subject to RLS)
- **Admin/Service Client**: For admin operations requiring deterministic writes that bypass RLS

## Required Environment Variables

### Supabase Configuration (Referral/Affiliate Module Only)

```bash
# Public variables (exposed to browser)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Server-only variables (NEVER expose to browser)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Admin authorization
ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

### Payment Link App (Unchanged)

```bash
# Prisma/Postgres connection - NOT affected by Supabase changes
DATABASE_URL=postgresql://...
```

> **Important**: The Supabase integration is ONLY for the referral/affiliate features. All payment link functionality continues to use Prisma + DATABASE_URL as before.

## Client Usage Guide

### 1. User/Session Client (`createUserClient`)

**File**: `src/lib/supabase/server.ts`

**Use for**:
- Authentication checks (`supabase.auth.getUser()`)
- User-facing data reads
- Any operation that should respect Row Level Security (RLS)
- Public pages (`/r/[code]`, `/review/[token]`)

**Example**:
```typescript
import { createUserClient } from '@/lib/supabase/server';

export async function checkAuth() {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
```

### 2. Admin/Service Client (`createAdminClient`)

**File**: `src/lib/supabase/admin.ts`

**⚠️ SERVER ONLY** - Never import into client components!

**Use for**:
- Admin approval/rejection routes
- Partner ledger entry creation
- Any write operation that MUST succeed regardless of RLS
- Operations requiring deterministic, reliable writes

**Example**:
```typescript
import { createAdminClient } from '@/lib/supabase/admin';

export async function approveConversion(id: string) {
  // Use admin client to bypass RLS
  const adminClient = createAdminClient();
  
  const { error } = await adminClient
    .from('conversions')
    .update({ status: 'approved' })
    .eq('id', id);
    
  if (error) throw error;
}
```

## Architecture Decisions

### Why Two Clients?

1. **Security**: Admin operations need to bypass RLS to ensure critical writes (like ledger entries) cannot be blocked
2. **Reliability**: Service role key ensures admin operations are deterministic
3. **Separation of Concerns**: User operations vs. admin operations have different security requirements
4. **Audit Trail**: Clear separation makes it easier to track which operations use elevated privileges

### Admin Routes Pattern

All admin routes follow this pattern:

```typescript
import { createAdminClient } from '@/lib/supabase/admin';
import { checkAdminAuth } from '@/lib/auth/admin';

export async function POST(request: NextRequest) {
  // 1. Check admin authorization (uses user client internally)
  const { isAdmin, user, error: authError } = await checkAdminAuth();
  
  if (!isAdmin || !user) {
    return NextResponse.json(
      { error: authError || 'Forbidden' },
      { status: 403 }
    );
  }

  // 2. Use admin client for DB operations
  const adminClient = createAdminClient();
  
  // 3. Perform operations...
  const { data, error } = await adminClient
    .from('conversions')
    .update({ status: 'approved' })
    .eq('id', conversionId);
    
  // 4. Handle errors and rollback if needed
  if (error) {
    await adminClient
      .from('conversions')
      .update({ status: 'pending' })
      .eq('id', conversionId);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

## Files Updated

### Core Client Files
- `src/lib/supabase/server.ts` - User/session client (renamed `createClient()` to `createUserClient()`)
- `src/lib/supabase/admin.ts` - Admin/service client (NEW)

### Admin Routes
- `src/app/api/referrals/conversions/[id]/approve/route.ts`
- `src/app/api/referrals/conversions/[id]/reject/route.ts`
- `src/app/api/huntpay/admin/conversions/[id]/approve/route.ts`
- `src/app/api/huntpay/admin/conversions/[id]/reject/route.ts`

### Integration Helpers
- `src/lib/referrals/partners-integration.ts` - Uses admin client for ledger writes
- `src/lib/huntpay/partners-integration.ts` - Uses admin client for ledger writes
- `src/lib/huntpay/core.ts` - Uses admin client for approve/reject functions
- `src/lib/auth/admin.ts` - Uses user client for auth checks

### Public Pages (Improved Error Handling)
- `src/app/r/[code]/page.tsx`
- `src/app/review/[token]/page.tsx`

## Error Handling

### Missing Environment Variables

If required env vars are missing, the clients will throw a clear error:

```
Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY.
This is required for admin operations. See SUPABASE_DUAL_CLIENTS.md for setup.
```

Public pages will show a user-friendly error instead of 404:

```jsx
<div className="text-center">
  <h1>Configuration Error</h1>
  <p>Referral system is not properly configured. Please contact support.</p>
</div>
```

### Database Errors

- If a record truly doesn't exist → `notFound()` (404)
- If Supabase is misconfigured → Show configuration error (500)
- If RLS blocks an operation → Admin client bypasses this
- All errors are logged to console with context

## Common Patterns

### Idempotent Ledger Entries

```typescript
const { error } = await adminClient
  .from('partner_ledger_entries')
  .insert({
    source: 'referral',
    source_ref: conversionId,
    earnings_amount: 100,
  });

// Unique constraint (source, source_ref) prevents duplicates
if (error && error.code === '23505') {
  console.log('Entry already exists');
  return; // Not an error - idempotent
}
```

### Rollback Pattern

```typescript
try {
  await createLedgerEntry(conversionId);
} catch (error) {
  console.error('Ledger creation failed:', error);
  
  // Rollback approval
  await adminClient
    .from('conversions')
    .update({ 
      status: 'pending',
      approved_at: null,
      approved_by: null,
    })
    .eq('id', conversionId);
    
  throw error;
}
```

## Security Notes

1. **Service Role Key**: Never commit to git, never expose to browser
2. **Admin Allowlist**: Enforced via `ADMIN_EMAILS` environment variable
3. **Client Components**: Never import `createAdminClient` into files with `'use client'`
4. **RLS**: User client operations are always subject to RLS policies
5. **Audit Trail**: All admin operations log the user email who performed them

## Testing Admin Operations

1. Set `ADMIN_EMAILS` to your test email
2. Log in via Supabase Auth
3. Access admin routes (e.g., `/dashboard/huntpay/admin`)
4. Check console logs for operation details

## Troubleshooting

### "Missing required environment variable"
- Check `.env` or `.env.local` has all required variables
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set on production server

### Admin operations return 403
- Ensure your email is in `ADMIN_EMAILS`
- Check you're logged in (`checkAdminAuth` requires active session)

### Ledger entries not created
- Check console for errors in `createPartnerLedgerEntry...` functions
- Verify `partner_programs` and `partner_entities` tables exist
- Check unique constraint on `partner_ledger_entries(source, source_ref)`

### Public pages show 500 errors
- Missing Supabase env vars (check logs)
- RLS policies blocking reads (use admin panel to verify)

## Migration Notes

The `createClient()` function in `src/lib/supabase/server.ts` is kept for backward compatibility but will delegate to `createUserClient()`. Gradually migrate all non-admin code to use `createUserClient()` explicitly for clarity.

## Table Namespacing Note

This application has TWO separate systems using Supabase:

1. **HuntPay System**: Uses tables like `conversions`, `hunts`, `stops`, `teams`
2. **Referral System**: Uses tables prefixed with `referral_*` (e.g., `referral_conversions`, `referral_programs`)

The `referral_` prefix prevents name collisions with HuntPay tables. Both systems write to the shared partner ledger (`partner_ledger_entries`) with different `source` values.

**See `REFERRAL_TABLE_NAMESPACE.md` for complete table mapping and usage guide.**

## Related Documentation

- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Service Role](https://supabase.com/docs/guides/api/api-keys#the-servicerole-key)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- `REFERRAL_TABLE_NAMESPACE.md` - Why referral tables are prefixed
