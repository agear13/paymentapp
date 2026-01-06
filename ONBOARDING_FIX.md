# Onboarding Organization Creation Fix

## ✅ Issue Fixed: "Failed to create organization"

### Root Cause
The organizations API endpoint was using **camelCase** field names but the Prisma schema uses **snake_case** field names.

**Before (Broken):**
```typescript
// API was trying to use:
clerkOrgId  // ❌ This doesn't exist in database
createdAt   // ❌ This doesn't exist in database

// But database schema has:
clerk_org_id  // ✅ Correct field name
created_at    // ✅ Correct field name
```

### Files Fixed

#### 1. `/src/app/api/organizations/route.ts`
**Changed:**
- GET endpoint: `clerkOrgId` → `clerk_org_id`
- GET endpoint: `createdAt` → `created_at`
- POST endpoint: `clerkOrgId` → `clerk_org_id` (in where clause and data)

**Before:**
```typescript
const organizations = await prisma.organizations.findMany({
  select: {
    id: true,
    clerkOrgId: true,  // ❌ Wrong
    name: true,
    createdAt: true,    // ❌ Wrong
  },
});
```

**After:**
```typescript
const organizations = await prisma.organizations.findMany({
  select: {
    id: true,
    clerk_org_id: true,  // ✅ Correct
    name: true,
    created_at: true,    // ✅ Correct
  },
});
```

#### 2. `/src/components/onboarding/onboarding-form.tsx`
**Added Better Error Handling:**
- Now catches and displays the actual error message from API
- Logs full error details to console for debugging
- Shows specific error message in toast notification

**Before:**
```typescript
if (!orgResponse.ok) {
  throw new Error('Failed to create organization'); // Generic error
}
```

**After:**
```typescript
if (!orgResponse.ok) {
  const errorData = await orgResponse.json().catch(() => ({}));
  console.error('Organization creation failed:', errorData);
  throw new Error(errorData.error || 'Failed to create organization');
}
```

### Why This Happened

This is a common issue when mixing:
- **JavaScript/TypeScript conventions** (camelCase)
- **PostgreSQL conventions** (snake_case)
- **Prisma ORM** (which follows database naming)

The API endpoint was written with camelCase field names, expecting Prisma to automatically map them, but Prisma requires exact field name matches to the schema.

### Database Schema (Correct Format)

```prisma
model organizations {
  id                        String   @id @default(uuid()) @db.Uuid
  clerk_org_id              String   @unique @db.VarChar(255)  // ← snake_case
  name                      String   @db.VarChar(255)
  created_at                DateTime @default(now())          // ← snake_case
  // ... other fields
}
```

### Testing the Fix

1. **Navigate to Onboarding:**
   ```
   https://your-app.onrender.com/onboarding
   ```

2. **Fill in the Form:**
   - Organization Name: "Test Org"
   - Display Name: "Test Company"
   - Default Currency: USD

3. **Submit:**
   - Should see success toast: "Organization created successfully!"
   - Should redirect to dashboard

4. **Verify in Database:**
   ```sql
   SELECT id, clerk_org_id, name, created_at 
   FROM organizations 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

### Error Messages You Might Still See

#### "Organization already exists" (409)
- **Cause:** You've already created an organization with that temp ID
- **Fix:** Change the clerk_org_id generation or delete existing organization
- **Or:** Just skip to dashboard if you already have an org

#### "Unauthorized" (401)
- **Cause:** Not logged in or session expired
- **Fix:** Log in first at `/auth/login`

#### "Failed to create merchant settings" (500)
- **Cause:** Second step (merchant settings) failed
- **Fix:** Check that organization was created successfully
- **Check:** Verify `merchant_settings` table exists in database

### Additional Improvements Made

1. **Better Error Logging:**
   - Console logs now show full error response
   - Helps debug API failures in production

2. **Specific Error Messages:**
   - Toast now shows actual error from API
   - Not just generic "Failed to complete onboarding"

3. **Type Safety:**
   - Added proper error typing: `catch (error: any)`
   - Safely accesses error.message

### Related Files

These files also interact with organizations:

- ✅ `src/lib/auth/get-org.ts` - Uses correct `clerk_org_id`
- ✅ `src/app/api/merchant-settings/route.ts` - Already using snake_case
- ✅ `src/app/(dashboard)/dashboard/page.tsx` - Uses organization from `get-org.ts`

### Preventing Future Issues

**Rule:** Always use snake_case when writing to Prisma queries

**Good:**
```typescript
await prisma.organizations.create({
  data: {
    clerk_org_id: value,  // ✅ Matches schema
    created_at: new Date(), // ✅ Matches schema
  }
});
```

**Bad:**
```typescript
await prisma.organizations.create({
  data: {
    clerkOrgId: value,  // ❌ Won't work
    createdAt: new Date(), // ❌ Won't work
  }
});
```

### Quick Reference: Field Name Mapping

| API Input (camelCase) | Body Property | Database Field (snake_case) |
|----------------------|---------------|----------------------------|
| clerkOrgId | body.clerkOrgId | clerk_org_id |
| organizationName | body.name | name |
| displayName | body.displayName | display_name |
| defaultCurrency | body.defaultCurrency | default_currency |
| stripeAccountId | body.stripeAccountId | stripe_account_id |
| hederaAccountId | body.hederaAccountId | hedera_account_id |

**Pattern:** 
- API accepts camelCase from frontend (body.camelCase)
- API writes to database using snake_case (database.snake_case)

### Success Criteria

After this fix:
- ✅ Organization creation succeeds
- ✅ Merchant settings creation succeeds
- ✅ User redirected to dashboard
- ✅ Dashboard loads without errors
- ✅ Organization visible in database

### If Still Having Issues

Check in this order:

1. **Clear Browser Cache:**
   - Hard refresh (Ctrl+Shift+R)
   - Or use incognito mode

2. **Check Database:**
   ```sql
   -- See if organizations table exists
   \dt organizations
   
   -- Check if any organizations exist
   SELECT * FROM organizations;
   
   -- Check if merchant_settings exist
   SELECT * FROM merchant_settings;
   ```

3. **Check Render Logs:**
   - Look for Prisma errors
   - Look for "Failed to create organization"
   - Should now see more detailed error messages

4. **Test API Directly:**
   ```bash
   # Test organization creation
   curl -X POST https://your-app.onrender.com/api/organizations \
     -H "Content-Type: application/json" \
     -H "Cookie: your-session-cookie" \
     -d '{"name":"Test","clerkOrgId":"test123"}'
   ```

### Deployment Checklist

- ✅ Fixed field names in organizations API
- ✅ Added error logging in onboarding form
- ✅ Improved error messages for users
- ✅ No linter errors
- ✅ Tested locally (if possible)
- ✅ Ready to deploy to Render

### Next Steps After Fix

1. Deploy to Render
2. Navigate to `/onboarding`
3. Create organization
4. Verify dashboard loads
5. Complete merchant settings (Stripe/Hedera)
6. Test creating a payment link

The onboarding flow should now work end-to-end! 🎉

