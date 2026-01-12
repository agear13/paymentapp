# 🚨 CRITICAL: Data Isolation Bug Fix

## Problem

**ALL USERS SEE ALL ORGANIZATIONS' DATA!**

### Root Cause
The application had NO proper link between Supabase users and organizations. The `getUserOrganization()` function was using `findFirst()` which returned the **first organization in the database**, causing:

- ✅ Your payment links showing in Danielle's dashboard
- ✅ Danielle's payment links showing in your dashboard  
- ✅ All users seeing the same transactions, ledger, etc.

### Affected Pages
1. **Payment Links** (`/dashboard/payment-links`) - Hardcoded org ID
2. **Transactions** (`/dashboard/transactions`) - Used `findFirst()`
3. **Ledger** (`/dashboard/ledger`) - Used `findFirst()`

---

## Solution

### 1. Created `user_organizations` Junction Table
A proper many-to-many relationship between users and organizations with roles.

### 2. Updated Code
- ✅ `getUserOrganization()` now filters by `user_id`
- ✅ Payment Links page uses dynamic org from context
- ✅ Organizations API creates `user_organizations` record on signup

---

## Deployment Steps

### Step 1: Run Database Migration

**On Render Shell:**

```bash
# Connect to the database
psql $DATABASE_URL << 'EOF'

-- Create user_organizations junction table
CREATE TABLE IF NOT EXISTS user_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS user_organizations_user_id_idx ON user_organizations(user_id);
CREATE INDEX IF NOT EXISTS user_organizations_organization_id_idx ON user_organizations(organization_id);
CREATE INDEX IF NOT EXISTS user_organizations_role_idx ON user_organizations(role);

-- Add comments
COMMENT ON TABLE user_organizations IS 'Junction table linking users to organizations with roles';
COMMENT ON COLUMN user_organizations.user_id IS 'Supabase auth.users.id (UUID as string)';
COMMENT ON COLUMN user_organizations.organization_id IS 'Reference to organizations table';
COMMENT ON COLUMN user_organizations.role IS 'User role within the organization: OWNER, ADMIN, MEMBER';

EOF
```

### Step 2: Link Existing Users to Their Organizations

**IMPORTANT:** You need to know:
1. Your Supabase user ID
2. Danielle's Supabase user ID (when she signs up)
3. The organization IDs

#### Get User IDs

```bash
# Get your user ID (use your admin email)
psql $DATABASE_URL -c "SELECT id, email FROM auth.users WHERE email = 'alishajayne13@gmail.com';"

# Get Danielle's user ID (after she signs up)
psql $DATABASE_URL -c "SELECT id, email FROM auth.users WHERE email = 'jaynealisha77@gmail.com';"
```

#### Get Organization IDs

```bash
# List all organizations
psql $DATABASE_URL -c "SELECT id, name FROM organizations ORDER BY created_at;"
```

#### Link Users to Organizations

```bash
# Replace with actual user_id and organization_id values

# Link YOUR user to YOUR organization
psql $DATABASE_URL << 'EOF'
INSERT INTO user_organizations (user_id, organization_id, role, created_at, updated_at)
VALUES (
  'YOUR_USER_ID_HERE',  -- Your Supabase user ID
  'YOUR_ORG_ID_HERE',   -- Your organization ID
  'OWNER',
  NOW(),
  NOW()
)
ON CONFLICT (user_id, organization_id) DO NOTHING;
EOF

# Link DANIELLE to HER organization
psql $DATABASE_URL << 'EOF'
INSERT INTO user_organizations (user_id, organization_id, role, created_at, updated_at)
VALUES (
  'DANIELLE_USER_ID_HERE',  -- Danielle's Supabase user ID
  'f473baac-68c6-4295-ab30-ea7cdd8700b4',  -- Danielle's org ID (from setup)
  'OWNER',
  NOW(),
  NOW()
)
ON CONFLICT (user_id, organization_id) DO NOTHING;
EOF
```

### Step 3: Deploy Code Changes

The code changes are already committed. Just redeploy on Render:

```bash
# Render will auto-deploy from GitHub, OR manually trigger:
# Render Dashboard → Your Service → Manual Deploy → Deploy latest commit
```

### Step 4: Verify Fix

After deployment:

1. **You log in** → Should see ONLY your payment links
2. **Danielle logs in** → Should see ONLY her payment links
3. **Check transactions** → Each user sees only their org's data
4. **Check ledger** → Each user sees only their org's data

---

## Quick Verification SQL

```sql
-- Check user_organizations table
SELECT 
  uo.role,
  u.email as user_email,
  o.name as org_name,
  uo.created_at
FROM user_organizations uo
JOIN auth.users u ON u.id = uo.user_id
JOIN organizations o ON o.id = uo.organization_id
ORDER BY uo.created_at;

-- Check payment links per organization
SELECT 
  o.name as organization,
  COUNT(pl.id) as payment_link_count
FROM organizations o
LEFT JOIN payment_links pl ON pl.organization_id = o.id
GROUP BY o.id, o.name;
```

---

## What Changed in Code

### 1. `src/lib/auth/get-org.ts`
**Before:**
```typescript
const organization = await prisma.organizations.findFirst({
  select: { id: true, name: true, clerk_org_id: true },
});
```

**After:**
```typescript
const userOrg = await prisma.$queryRaw`
  SELECT o.id, o.name, o.clerk_org_id, uo.role
  FROM organizations o
  INNER JOIN user_organizations uo ON uo.organization_id = o.id
  WHERE uo.user_id = ${user.id}
  ORDER BY uo.created_at ASC
  LIMIT 1
`;
```

### 2. `src/app/(dashboard)/dashboard/payment-links/page.tsx`
**Before:**
```typescript
const organizationId = '791bd0c8-029f-4988-836d-ced2bebc9e39'; // HARDCODED!
```

**After:**
```typescript
const { organizationId, isLoading: isOrgLoading } = useOrganization();
```

### 3. `src/app/api/organizations/route.ts`
**Before:**
```typescript
const organization = await prisma.organizations.create({
  data: { name: body.name, clerk_org_id: body.clerkOrgId },
});
```

**After:**
```typescript
const result = await prisma.$transaction(async (tx) => {
  const organization = await tx.organizations.create({
    data: { name: body.name, clerk_org_id: body.clerkOrgId },
  });
  
  // Link user to organization
  await tx.$executeRaw`
    INSERT INTO user_organizations (user_id, organization_id, role, created_at, updated_at)
    VALUES (${user.id}, ${organization.id}, 'OWNER', NOW(), NOW())
  `;
  
  return organization;
});
```

---

## Files Changed

1. ✅ `src/prisma/migrations/add_user_organizations_table.sql` (new)
2. ✅ `src/lib/auth/get-org.ts` (updated)
3. ✅ `src/app/(dashboard)/dashboard/payment-links/page.tsx` (updated)
4. ✅ `src/app/api/organizations/route.ts` (updated)
5. ✅ `CRITICAL_DATA_ISOLATION_FIX.md` (this file)

---

## Next Steps

1. ⚠️ **RUN MIGRATION** (Step 1 above)
2. ⚠️ **LINK USERS TO ORGS** (Step 2 above)
3. ⚠️ **DEPLOY CODE** (Step 3 above)
4. ✅ **VERIFY** (Step 4 above)

---

## Notes

- This fix ensures **proper multi-tenancy** and **data isolation**
- New users will automatically be linked to their organizations on signup
- Existing users need to be manually linked (one-time operation)
- The `role` field supports future RBAC (Role-Based Access Control)

