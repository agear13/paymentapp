# Quick SQL Fix - 5 Minutes

## The Problem
Your old accounts aren't linked to the organization in the database.

## The Fix (3 SQL Queries)

### 1. Get Your Organization ID
Go to Supabase → SQL Editor → Run this:

```sql
SELECT id, name FROM organizations ORDER BY created_at DESC LIMIT 1;
```

**Copy the `id`** - this is your `ORG_ID`

### 2. Get Your User IDs
Run this:

```sql
SELECT id, email FROM auth.users ORDER BY created_at;
```

Find and copy:
- `id` for `alishajayne13@gmail.com` → This is `USER1_ID`
- `id` for `jaynealisha77@gmail.com` → This is `USER2_ID`

### 3. Link Users to Organization
Replace the placeholders with your actual IDs from above, then run:

```sql
-- Link user 1
INSERT INTO user_organizations (id, user_id, organization_id, role, created_at, updated_at)
VALUES (gen_random_uuid(), 'USER1_ID', 'ORG_ID', 'OWNER', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Link user 2  
INSERT INTO user_organizations (id, user_id, organization_id, role, created_at, updated_at)
VALUES (gen_random_uuid(), 'USER2_ID', 'ORG_ID', 'OWNER', NOW(), NOW())
ON CONFLICT DO NOTHING;
```

## Test It

1. Log in with `alishajayne13@gmail.com`
2. Open browser console (F12)
3. Run: `localStorage.clear()`
4. Refresh page
5. Go to merchant settings → Should save successfully now!
6. Create invoice → Payment methods should appear!

## Done! ✅

Both old accounts should now work perfectly.

**Full guide with screenshots**: See `FIX_USER_ORGANIZATION_MAPPING.md`

