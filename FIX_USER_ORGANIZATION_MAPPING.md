# Fix User-Organization Mapping - SQL Script

## 🎯 The Exact Problem

Your database has:
- ✅ 3 users in Supabase Auth
- ✅ 1 organization in `organizations` table
- ❌ Only 1 entry in `user_organizations` junction table (the new account)

**The old accounts** (`alishajayne13@gmail.com` and `jaynealisha77@gmail.com`) are **NOT linked** to any organization in the `user_organizations` table. That's why:
- They can't save merchant settings
- They can't see payment links
- The API returns "No organization found"

**The new account** (`hello@provvypay.com`) works because it was properly linked when created.

## ✅ The Fix

Link the old user accounts to the existing organization by adding entries to `user_organizations` table.

## 🔧 Step-by-Step Fix (Supabase)

### Step 1: Open Supabase SQL Editor

1. Go to [supabase.com](https://supabase.com)
2. Log into your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Get the Organization ID

Run this query first to get your organization ID:

```sql
-- Get the existing organization
SELECT id, name, created_at 
FROM organizations 
ORDER BY created_at DESC;
```

**Copy the `id` value** - you'll need it for the next step.

### Step 3: Get the User IDs

Run this query to get the Supabase user IDs:

```sql
-- Get all users from Supabase Auth
SELECT 
  id,
  email,
  created_at
FROM auth.users
ORDER BY created_at;
```

You should see:
- User 1: `alishajayne13@gmail.com`
- User 2: `jaynealisha77@gmail.com`
- User 3: `hello@provvypay.com`

**Copy the `id` values** for the first two users.

### Step 4: Check Current Mappings

```sql
-- See what's currently in user_organizations
SELECT 
  uo.id,
  uo.user_id,
  u.email,
  uo.organization_id,
  o.name as org_name,
  uo.role,
  uo.created_at
FROM user_organizations uo
LEFT JOIN auth.users u ON u.id = uo.user_id
LEFT JOIN organizations o ON o.id = uo.organization_id
ORDER BY uo.created_at DESC;
```

You should see only ONE row (for hello@provvypay.com).

### Step 5: Add Missing Mappings

**⚠️ IMPORTANT**: Replace these placeholder values with your actual IDs from Steps 2 & 3:
- `YOUR_ORG_ID_HERE` = The organization ID from Step 2
- `ALISHA_USER_ID_HERE` = The user ID for alishajayne13@gmail.com
- `JAYNE_USER_ID_HERE` = The user ID for jaynealisha77@gmail.com

```sql
-- Link alishajayne13@gmail.com to the organization
INSERT INTO user_organizations (
  id,
  user_id,
  organization_id,
  role,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'ALISHA_USER_ID_HERE',  -- Replace with actual user ID
  'YOUR_ORG_ID_HERE',      -- Replace with actual org ID
  'OWNER',
  NOW(),
  NOW()
)
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- Link jaynealisha77@gmail.com to the organization
INSERT INTO user_organizations (
  id,
  user_id,
  organization_id,
  role,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'JAYNE_USER_ID_HERE',    -- Replace with actual user ID
  'YOUR_ORG_ID_HERE',      -- Replace with actual org ID
  'OWNER',
  NOW(),
  NOW()
)
ON CONFLICT (user_id, organization_id) DO NOTHING;
```

### Step 6: Verify the Fix

```sql
-- Check all mappings now exist
SELECT 
  uo.id,
  u.email,
  o.name as org_name,
  uo.role,
  uo.created_at
FROM user_organizations uo
LEFT JOIN auth.users u ON u.id = uo.user_id
LEFT JOIN organizations o ON o.id = uo.organization_id
ORDER BY uo.created_at;
```

You should now see **3 rows** - one for each user.

## 🧪 Test the Fix

### Test 1: Clear Cache

1. Log into your app with `alishajayne13@gmail.com`
2. Open browser DevTools (F12)
3. Go to Console
4. Run:
   ```javascript
   localStorage.removeItem('provvypay.organizationId');
   ```
5. **Refresh the page** (this will fetch new org ID from API)

### Test 2: Check Organization ID

```javascript
// Should now return the organization ID
fetch('/api/user/organization')
  .then(r => r.json())
  .then(d => console.log('Organization:', d));
```

Should print:
```json
{
  "organizationId": "your-org-id",
  "name": "Your Org Name"
}
```

### Test 3: Check Merchant Settings

```javascript
const orgId = localStorage.getItem('provvypay.organizationId');
fetch('/api/merchant-settings?organizationId=' + orgId)
  .then(r => r.json())
  .then(d => console.log('Merchant Settings:', d));
```

Should show your Stripe/Hedera IDs.

### Test 4: Check Payment Links

```javascript
const orgId = localStorage.getItem('provvypay.organizationId');
fetch('/api/payment-links?organizationId=' + orgId)
  .then(r => r.json())
  .then(d => console.log('Payment Links:', d));
```

Should show any existing payment links (may be empty if none created yet for this org).

### Test 5: Save Merchant Settings

1. Navigate to `/dashboard/settings/merchant`
2. Verify Stripe/Hedera IDs are shown
3. Click Save
4. Should save successfully
5. Refresh page
6. Settings should persist

### Test 6: Create Payment Link

1. Navigate to `/dashboard/payment-links`
2. Click "+ Create Invoice"
3. Fill in form
4. Submit
5. Should create successfully
6. Should appear in table
7. Open link in incognito
8. Should show payment method buttons

## 🎉 Expected Results

After running the SQL fix:

- ✅ All 3 users can log in
- ✅ All 3 users see the same organization
- ✅ All 3 users can save merchant settings
- ✅ All 3 users can create payment links
- ✅ All 3 users see the same payment links
- ✅ Payment methods work for all users

## 📊 Understanding the Schema

### Organizations Table
Stores organization/company records
```
id | name | clerk_org_id | created_at
```

### User_Organizations Table (Junction)
Links users to organizations (many-to-many)
```
id | user_id | organization_id | role | created_at
```

### Why This Broke

When you set up the new `hello@provvypay.com` account, it properly:
1. Created a user in Supabase Auth
2. Found or created an organization
3. **Created an entry in `user_organizations`** linking the user to the org

But the old accounts (`alishajayne13@gmail.com` and `jaynealisha77@gmail.com`):
1. ✅ Exist in Supabase Auth
2. ❌ Have NO entry in `user_organizations`
3. ❌ Therefore have no organization association

This happens when:
- Database was reset/migrated
- Users were created before `user_organizations` table existed
- Onboarding flow didn't complete properly
- Manual user creation bypassed proper setup

## 🔒 Alternative: Use Existing Organization

If you want to check which organization the new user is using and ensure others use the same:

```sql
-- Find which org hello@provvypay.com is linked to
SELECT 
  o.id,
  o.name,
  uo.user_id,
  u.email
FROM organizations o
JOIN user_organizations uo ON uo.organization_id = o.id
JOIN auth.users u ON u.id = uo.user_id
WHERE u.email = 'hello@provvypay.com';
```

Use that `o.id` as `YOUR_ORG_ID_HERE` in the INSERT statements above.

## 🚨 Important Notes

1. **Use OWNER role** for your test accounts (gives full permissions)
2. **Use same organization ID** for all users
3. **Clear localStorage** after fixing (forces refetch of org ID)
4. **Refresh page** after clearing cache
5. **Don't create duplicate mappings** (the `ON CONFLICT` handles this)

## 🆘 If SQL Fails

If you get errors:

### Error: "duplicate key value violates unique constraint"
**Meaning**: Mapping already exists
**Fix**: It's safe, ignore this error

### Error: "violates foreign key constraint"
**Meaning**: Wrong user_id or organization_id
**Fix**: Double-check the IDs from Step 2 & 3

### Error: "permission denied"
**Meaning**: Need admin access
**Fix**: Use Supabase dashboard SQL editor (has admin privileges)

## 📝 Full Example (Copy-Paste Ready)

Once you have the IDs, this is what it should look like:

```sql
-- Example with real IDs (REPLACE WITH YOUR ACTUAL IDs!)

-- Link alishajayne13@gmail.com
INSERT INTO user_organizations (id, user_id, organization_id, role, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',  -- alishajayne13's user ID
  '12345678-90ab-cdef-1234-567890abcdef',  -- Your org ID
  'OWNER',
  NOW(),
  NOW()
)
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- Link jaynealisha77@gmail.com
INSERT INTO user_organizations (id, user_id, organization_id, role, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'f9e8d7c6-b5a4-3210-fedc-ba0987654321',  -- jaynealisha77's user ID
  '12345678-90ab-cdef-1234-567890abcdef',  -- Same org ID
  'OWNER',
  NOW(),
  NOW()
)
ON CONFLICT (user_id, organization_id) DO NOTHING;
```

## ✅ Success Checklist

After running the SQL:

- [ ] Ran all 6 steps in Supabase SQL Editor
- [ ] Verified 3 rows in `user_organizations` table
- [ ] Logged in with `alishajayne13@gmail.com`
- [ ] Cleared localStorage
- [ ] Refreshed page
- [ ] Organization ID now loads
- [ ] Merchant settings save successfully
- [ ] Can create payment links
- [ ] Payment methods appear
- [ ] Tested with all 3 accounts

## 🎓 Preventing This in Future

Add to your onboarding/signup flow to ensure `user_organizations` entries are created:

```typescript
// When creating a new user
async function createUserWithOrganization(userId: string, email: string) {
  // 1. Create or get organization
  const org = await prisma.organizations.upsert({
    where: { /* some identifier */ },
    create: { /* org data */ },
    update: {},
  });
  
  // 2. Link user to organization (THIS IS CRITICAL!)
  await prisma.user_organizations.create({
    data: {
      user_id: userId,
      organization_id: org.id,
      role: 'OWNER',
    },
  });
}
```

---

**Ready to fix? Run the SQL queries in Supabase and your old accounts will work!** 🚀

