# Data Fix Summary

## Problem Identified

### Duplicate Organizations with Circular References
The database has duplicate organizations where `clerk_org_id` points to another organization's UUID instead of a proper Clerk ID:

```
organization b7a6a8be-a360-480c-b7d3-94cb9b19a2e3 
  ↓ clerk_org_id = ed622608-0f25-4ca9-8025-858d7fbd79b6
  
organization 7bdbeb1e-2fd6-4883-95b3-09ba5e3675fa 
  ↓ clerk_org_id = 77d52ac3-d55b-45a1-ac0d-c630a84df428
```

### Data Distribution
- Organization `ed622608-0f25-4ca9-8025-858d7fbd79b6` (alishajayne13@gmail.com): 37 payment links
- Organization `b7a6a8be-a360-480c-b7d3-94cb9b19a2e3` (duplicate): 10 payment links
- Organization `77d52ac3-d55b-45a1-ac0d-c630a84df428` (jaynealisha77@gmail.com): 0 payment links
- Organization `7bdbeb1e-2fd6-4883-95b3-09ba5e3675fa` (duplicate): 0 payment links

## SQL Fix Commands

### Run these commands in the Render PostgreSQL shell:

```sql
-- 1. Check current state
SELECT id, clerk_org_id, name FROM organizations 
WHERE clerk_org_id IN (SELECT id::text FROM organizations);

-- 2. Migrate payment links from duplicate org to main org
UPDATE payment_links 
SET organization_id = 'ed622608-0f25-4ca9-8025-858d7fbd79b6' 
WHERE organization_id = 'b7a6a8be-a360-480c-b7d3-94cb9b19a2e3';

-- 3. Migrate merchant settings if any exist on duplicate org
UPDATE merchant_settings 
SET organization_id = 'ed622608-0f25-4ca9-8025-858d7fbd79b6' 
WHERE organization_id = 'b7a6a8be-a360-480c-b7d3-94cb9b19a2e3';

-- 4. Migrate audit logs
UPDATE audit_logs 
SET organization_id = 'ed622608-0f25-4ca9-8025-858d7fbd79b6' 
WHERE organization_id = 'b7a6a8be-a360-480c-b7d3-94cb9b19a2e3';

-- 5. Delete the duplicate organization for alishajayne13
DELETE FROM organizations WHERE id = 'b7a6a8be-a360-480c-b7d3-94cb9b19a2e3';

-- 6. Delete the duplicate organization for jaynealisha77 (if it has no data)
DELETE FROM organizations WHERE id = '7bdbeb1e-2fd6-4883-95b3-09ba5e3675fa';

-- 7. Verify the fix
SELECT 
  o.id,
  o.name,
  o.clerk_org_id,
  COUNT(DISTINCT pl.id) as payment_links,
  COUNT(DISTINCT ms.id) as merchant_settings
FROM organizations o
LEFT JOIN payment_links pl ON pl.organization_id = o.id
LEFT JOIN merchant_settings ms ON ms.organization_id = o.id
WHERE o.id IN (
  'ed622608-0f25-4ca9-8025-858d7fbd79b6',
  '77d52ac3-d55b-45a1-ac0d-c630a84df428',
  '1c067d75-bc47-457f-9197-dc3cc25d5c44'
)
GROUP BY o.id, o.name, o.clerk_org_id;
```

## Expected Result

After running these commands, you should have:
- `alishajayne13@gmail.com` → organization `ed622608-0f25-4ca9-8025-858d7fbd79b6` with **47 payment links** (37 + 10 migrated)
- `jaynealisha77@gmail.com` → organization `77d52ac3-d55b-45a1-ac0d-c630a84df428` with **0 payment links** (their own org)
- `hello@provvypay.com` → organization `1c067d75-bc47-457f-9197-dc3cc25d5c44` with their payment links

## Additional Cleanup (if needed)

If there are other duplicate organizations, you can find them with:

```sql
-- Find all organizations with circular clerk_org_id references
SELECT id, clerk_org_id, name, created_at 
FROM organizations 
WHERE clerk_org_id IN (SELECT id::text FROM organizations)
ORDER BY created_at DESC;
```

Then for each duplicate, follow steps 2-5 above.

## Root Cause

The `getOrCreateDbOrgId` function in the payment-links API was using `upsert` with the database UUID as `clerk_org_id`, creating duplicate organizations. This has been fixed in the latest code.

## Prevention

The payment-links API has been updated to:
1. Remove the `getOrCreateDbOrgId` function
2. Directly use the organization ID from the request
3. Validate user permissions before any operation
4. Include `organizationId` in the transformed response

The organizations API has been updated to:
1. Only return organizations the user is linked to
2. Ensure proper data isolation
