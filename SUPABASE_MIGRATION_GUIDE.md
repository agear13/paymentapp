# Supabase Dual Client Migration Guide

Quick reference for developers working with the new dual client architecture.

## Quick Decision Tree

```
Need to access Supabase?
│
├─ Is this a client component ('use client')?
│  └─ Use: import { createClient } from '@/lib/supabase/client'
│
├─ Is this user-facing data or auth check?
│  └─ Use: createUserClient() from '@/lib/supabase/server'
│
├─ Is this an admin operation that MUST succeed?
│  └─ Use: createAdminClient() from '@/lib/supabase/admin'
│
└─ Not sure?
   └─ Default to createUserClient() for safety
```

## Common Patterns: Before → After

### 1. Admin Approval Route

**❌ Before (Unsafe - RLS could block)**:
```typescript
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  
  // DB write - COULD BE BLOCKED BY RLS!
  const { error } = await supabase
    .from('conversions')
    .update({ status: 'approved' })
    .eq('id', id);
}
```

**✅ After (Safe - Bypasses RLS)**:
```typescript
import { createAdminClient } from '@/lib/supabase/admin';
import { checkAdminAuth } from '@/lib/auth/admin';

export async function POST(request: NextRequest) {
  // Auth check uses user client
  const { isAdmin, user, error } = await checkAdminAuth();
  if (!isAdmin) return NextResponse.json({ error }, { status: 403 });
  
  // DB write uses admin client - GUARANTEED SUCCESS
  const adminClient = createAdminClient();
  const { error: updateError } = await adminClient
    .from('conversions')
    .update({ status: 'approved' })
    .eq('id', id);
}
```

### 2. Public Page

**❌ Before (Confusing 404 on env error)**:
```typescript
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';

export default async function Page({ params }) {
  const supabase = await createClient(); // Could throw!
  
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('code', params.code)
    .single();
    
  if (error || !data) {
    notFound(); // Same error for missing env vs missing data
  }
}
```

**✅ After (Clear error handling)**:
```typescript
import { createUserClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';

export default async function Page({ params }) {
  // Catch configuration errors
  let supabase;
  try {
    supabase = await createUserClient();
  } catch (error) {
    console.error('Supabase config error:', error);
    return <ConfigurationError />;
  }
  
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('code', params.code)
    .single();
    
  if (error) {
    console.error('Data fetch error:', error);
  }
  
  if (!data) {
    notFound(); // True 404 - data doesn't exist
  }
}
```

### 3. Ledger Integration Helper

**❌ Before (Could fail due to RLS)**:
```typescript
import { createClient } from '@/lib/supabase/server';

export async function createLedgerEntry(conversionId: string) {
  const supabase = await createClient();
  
  // RLS might block this write!
  const { error } = await supabase
    .from('partner_ledger_entries')
    .insert({
      source_ref: conversionId,
      earnings_amount: 100,
    });
}
```

**✅ After (Always succeeds)**:
```typescript
import { createAdminClient } from '@/lib/supabase/admin';

export async function createLedgerEntry(conversionId: string) {
  // Admin client bypasses RLS
  const adminClient = createAdminClient();
  
  const { error } = await adminClient
    .from('partner_ledger_entries')
    .insert({
      source_ref: conversionId,
      earnings_amount: 100,
    });
    
  // Idempotent - duplicate key is OK
  if (error && error.code === '23505') {
    return; // Already exists
  }
  
  if (error) throw error;
}
```

### 4. Dashboard Data Fetching

**✅ Correct (User-facing read)**:
```typescript
import { createUserClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createUserClient();
  
  // User can only see their own data (RLS enforced)
  const { data: entries } = await supabase
    .from('partner_ledger_entries')
    .select('*');
    
  return <Dashboard entries={entries} />;
}
```

## Import Cheat Sheet

### Server Components / API Routes

```typescript
// For auth checks and user-facing reads
import { createUserClient } from '@/lib/supabase/server';

// For admin operations (SERVER ONLY!)
import { createAdminClient } from '@/lib/supabase/admin';

// For auth validation helper
import { checkAdminAuth } from '@/lib/auth/admin';
```

### Client Components

```typescript
// Only option for client components
import { createClient } from '@/lib/supabase/client';
```

## Environment Variables

### Development (.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # From Supabase dashboard
ADMIN_EMAILS=dev@example.com
```

### Production (Render/Vercel/etc.)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # KEEP SECRET!
ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

## Security Checklist

- ✅ Never import `createAdminClient` in client components
- ✅ Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser
- ✅ Always validate admin auth before using admin client
- ✅ Use user client for auth checks (respects session)
- ✅ Use admin client only for writes that must succeed
- ✅ Log all admin operations with user email
- ✅ Implement rollback for failed multi-step operations

## Common Mistakes

### ❌ Using admin client for user data reads
```typescript
// BAD - Bypasses RLS unnecessarily
const adminClient = createAdminClient();
const { data } = await adminClient.from('user_data').select('*');
```

**Why bad**: User should only see their own data. Admin client sees ALL data.

**Fix**: Use `createUserClient()` instead.

### ❌ Using user client for critical writes
```typescript
// BAD - Could be blocked by RLS
const supabase = await createUserClient();
await supabase.from('partner_ledger_entries').insert(...);
```

**Why bad**: RLS policy changes could break ledger creation.

**Fix**: Use `createAdminClient()` for ledger writes.

### ❌ Not catching config errors in public pages
```typescript
// BAD - Throws 500, looks broken
const supabase = await createUserClient();
const { data } = await supabase.from('programs').select('*');
```

**Why bad**: Missing env vars cause unhandled exception.

**Fix**: Wrap in try/catch, show user-friendly error.

### ❌ Importing admin client in client component
```typescript
'use client';
import { createAdminClient } from '@/lib/supabase/admin'; // ERROR!
```

**Why bad**: Service role key would be exposed to browser!

**Fix**: Use API route with admin client, call from client.

## Testing Your Changes

### 1. Test Admin Operations
```bash
# Set admin email
export ADMIN_EMAILS=your@email.com

# Login to Supabase
# Navigate to /dashboard/programs/conversions
# Approve a conversion
# Check partner_ledger_entries table
```

### 2. Test Rollback
```bash
# Temporarily break ledger insert (remove required field)
# Approve conversion
# Verify conversion status reverts to 'pending'
# Fix ledger insert
# Re-approve conversion
```

### 3. Test Public Pages Without Env
```bash
# Temporarily rename .env.local
# Visit /r/TEST-CODE
# Should see "Configuration Error" not 404
# Restore .env.local
```

### 4. Test Client Import Protection
```bash
# Try importing admin client in a 'use client' file
# npm run build should fail or lint should catch it
```

## Migration Checklist

When migrating old code:

- [ ] Replace `import { createClient }` with `import { createUserClient }`
- [ ] Check if operation is admin-only
- [ ] If admin: switch to `createAdminClient()`
- [ ] Add try/catch for config errors in public pages
- [ ] Add console.error for debugging
- [ ] Test with missing env vars
- [ ] Test with valid env vars
- [ ] Verify no admin client imports in client components

## Getting Help

1. **Build errors**: Check IMPLEMENTATION_SUMMARY.md
2. **Usage questions**: Check SUPABASE_DUAL_CLIENTS.md
3. **Security questions**: Review Security Checklist above
4. **404 vs 500 errors**: Check public page error handling pattern

## Related Files

- `SUPABASE_DUAL_CLIENTS.md` - Full documentation
- `IMPLEMENTATION_SUMMARY.md` - What was changed
- `src/lib/supabase/server.ts` - User client
- `src/lib/supabase/admin.ts` - Admin client
- `src/lib/auth/admin.ts` - Admin auth helper
