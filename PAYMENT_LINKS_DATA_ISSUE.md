# Payment Links & Payment Methods Issue - Diagnosis & Fix

## Problems

1. ✅ **Login works** - You can log in successfully
2. ❌ **Payment links table empty** - Your previously created payment links aren't showing
3. ❌ **No payment methods** - When creating new invoice, Stripe/Hedera options don't appear

## Root Cause: Organization ID Mismatch

Your app uses `organizationId` to associate data with your account. The issue is likely:

**Your old payment links and merchant settings are associated with Organization ID "A"**
**But you're currently logged in with Organization ID "B"**

This commonly happens when:
- Database was reset/migrated
- User account was recreated
- Organization records got out of sync
- localStorage has cached wrong org ID

## Quick Diagnostic (Do This First)

### Step 1: Check Your Current Organization ID

1. Log into your deployed app
2. Open browser DevTools (F12)
3. Go to **Console** tab
4. Paste this code and press Enter:

```javascript
// Check current organization ID
const orgId = localStorage.getItem('provvypay.organizationId');
console.log('Current Organization ID:', orgId);

// Fetch merchant settings
fetch('/api/merchant-settings?organizationId=' + orgId)
  .then(r => r.json())
  .then(d => {
    console.log('Merchant Settings:', d);
    if (d.data && d.data.length > 0) {
      console.log('✅ Merchant settings found!');
      console.log('Stripe ID:', d.data[0].stripe_account_id);
      console.log('Hedera ID:', d.data[0].hedera_account_id);
    } else {
      console.log('❌ No merchant settings for this organization');
    }
  });

// Check payment links
fetch('/api/payment-links?organizationId=' + orgId)
  .then(r => r.json())
  .then(d => {
    console.log('Payment Links:', d);
    if (d.data && d.data.length > 0) {
      console.log('✅ Found', d.data.length, 'payment links');
    } else {
      console.log('❌ No payment links for this organization');
    }
  });
```

### Step 2: Interpret Results

#### Scenario A: "❌ No merchant settings for this organization"
**Problem**: Merchant settings don't exist for your current org ID
**Fix**: Recreate merchant settings (see Fix #1 below)

#### Scenario B: "❌ No payment links for this organization"
**Problem**: Payment links exist in database but for different org ID
**Fix**: Database query needed (see Fix #2 below)

#### Scenario C: Both show "✅ Found"
**Problem**: Frontend not refreshing or caching issue
**Fix**: Hard refresh (Ctrl+Shift+R)

## Fix #1: Recreate Merchant Settings

If merchant settings don't exist for your current organization:

### Option A: Via Settings UI

1. Navigate to `/dashboard/settings/merchant`
2. Fill in the form:
   - **Display Name**: Your business name
   - **Default Currency**: USD (or your preference)
   - **Stripe Account ID**: Your Stripe account ID
   - **Hedera Account ID**: Your Hedera account ID (format: 0.0.xxxxx)
3. Save

### Option B: Via Console (Quick Fix)

```javascript
// Get your current org ID
const orgId = localStorage.getItem('provvypay.organizationId');

// Create merchant settings
fetch('/api/merchant-settings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    organizationId: orgId,
    displayName: 'Your Business Name',
    defaultCurrency: 'USD',
    stripeAccountId: 'acct_YOUR_STRIPE_ID',  // Replace with actual ID
    hederaAccountId: '0.0.YOUR_HEDERA_ID',   // Replace with actual ID
  })
})
.then(r => r.json())
.then(d => console.log('Created merchant settings:', d))
.catch(e => console.error('Error:', e));
```

After creating, refresh the page and try creating a payment link.

## Fix #2: Database Organization ID Mismatch

If your old payment links exist but aren't showing, they're associated with a different org ID.

### Check Database Directly

If you have database access (e.g., Supabase dashboard):

```sql
-- Find all organizations
SELECT id, name, created_at 
FROM organizations 
ORDER BY created_at DESC;

-- Find your payment links (replace ORG_ID with each from above)
SELECT id, amount, currency, description, organization_id, created_at
FROM "PaymentLink"
WHERE organization_id = 'OLD_ORG_ID_HERE'
ORDER BY created_at DESC;

-- Find merchant settings
SELECT id, organization_id, display_name, stripe_account_id, hedera_account_id
FROM merchant_settings
ORDER BY created_at DESC;
```

### Fix: Update Organization IDs

If payment links are associated with wrong org ID:

```sql
-- Get your current organization ID first
-- (from localStorage or Console diagnostic above)

-- Update payment links to current org ID
UPDATE "PaymentLink"
SET organization_id = 'YOUR_CURRENT_ORG_ID'
WHERE organization_id = 'OLD_ORG_ID';

-- Update merchant settings to current org ID
UPDATE merchant_settings
SET organization_id = 'YOUR_CURRENT_ORG_ID'
WHERE organization_id = 'OLD_ORG_ID';
```

**⚠️ Warning**: Only do this if you're sure about the org IDs!

## Fix #3: Clear Cache & Retry

Sometimes the issue is just stale data:

1. **Clear localStorage**:
   ```javascript
   localStorage.removeItem('provvypay.organizationId');
   ```

2. **Log out completely**

3. **Clear browser cache**:
   - Chrome/Edge: Ctrl+Shift+Delete → Clear cached files
   - Or DevTools → Application → Clear storage

4. **Log back in**

5. **Check if data loads now**

## Why This Happens

### Common Causes:

1. **Database Migration/Reset**
   - Database was wiped or reset
   - Organizations table got new records
   - Old payment links still reference old org IDs

2. **User Recreation**
   - User account was deleted and recreated
   - New user got assigned to new organization
   - Old data still tied to old organization

3. **Development vs Production**
   - Testing in dev with one dataset
   - Production has different organization IDs
   - Data doesn't match

4. **Supabase/Auth Issues**
   - Auth provider changed
   - User ID changed
   - Organization mapping broke

## Preventing This in Future

### Add Organization Check to Your Code

Update `src/hooks/use-organization.ts` to log org ID:

```typescript
React.useEffect(() => {
  async function fetchOrganization() {
    try {
      const cached = window.localStorage.getItem('provvypay.organizationId');
      if (cached) {
        console.log('📋 Using cached organization ID:', cached);  // Add this
        setOrganizationId(cached);
        setIsLoading(false);
      }

      const response = await fetch('/api/user/organization');
      
      if (!response.ok) {
        throw new Error('Failed to fetch organization');
      }

      const data = await response.json();
      
      if (data.organizationId) {
        console.log('📋 Fetched organization ID:', data.organizationId);  // Add this
        setOrganizationId(data.organizationId);
        window.localStorage.setItem('provvypay.organizationId', data.organizationId);
      } else {
        setError('No organization found');
      }
      
      setIsLoading(false);
    } catch (e: any) {
      console.error('Error fetching organization:', e);
      setError(e?.message || 'Failed to resolve organization');
      setIsLoading(false);
    }
  }

  fetchOrganization();
}, [])
```

This helps you debug organization ID issues in the future.

## Testing After Fix

### 1. Check Merchant Settings Page

Navigate to: `/dashboard/settings/merchant`

Should show:
- ✅ Display name
- ✅ Default currency
- ✅ Stripe account ID
- ✅ Hedera account ID

### 2. Try Creating Payment Link

Navigate to: `/dashboard/payment-links`

Click "+ Create Invoice"

Should show:
- ✅ Form fields (amount, description, etc.)
- ✅ Payment methods section (after creating link)

### 3. Check Created Payment Link

After creating:
1. Should appear in table immediately
2. Click to view details
3. Should show Stripe and/or Hedera as payment options

### 4. Check Public Payment Page

1. Copy the payment link URL
2. Open in incognito/private window
3. Should show:
   - ✅ Merchant name
   - ✅ Amount and currency
   - ✅ Payment method buttons (Stripe/Hedera)

## Complete Diagnostic Script

Run this comprehensive check:

```javascript
// Complete diagnostic
async function diagnosePlatform() {
  console.log('🔍 Starting Platform Diagnostic...\n');
  
  // 1. Check auth
  const orgId = localStorage.getItem('provvypay.organizationId');
  console.log('1️⃣ Organization ID:', orgId || '❌ NOT FOUND');
  
  if (!orgId) {
    console.log('❌ CRITICAL: No organization ID. Log out and back in.');
    return;
  }
  
  // 2. Check merchant settings
  console.log('\n2️⃣ Checking merchant settings...');
  const settingsRes = await fetch('/api/merchant-settings?organizationId=' + orgId);
  const settings = await settingsRes.json();
  
  if (settings.data && settings.data.length > 0) {
    const s = settings.data[0];
    console.log('✅ Merchant settings found');
    console.log('   Display Name:', s.display_name);
    console.log('   Stripe ID:', s.stripe_account_id || '❌ NOT SET');
    console.log('   Hedera ID:', s.hedera_account_id || '❌ NOT SET');
    
    if (!s.stripe_account_id && !s.hedera_account_id) {
      console.log('   ⚠️ No payment methods configured!');
    }
  } else {
    console.log('❌ No merchant settings found for this organization');
    console.log('   Fix: Go to /dashboard/settings/merchant and fill in details');
  }
  
  // 3. Check payment links
  console.log('\n3️⃣ Checking payment links...');
  const linksRes = await fetch('/api/payment-links?organizationId=' + orgId);
  const links = await linksRes.json();
  
  if (links.data && links.data.length > 0) {
    console.log('✅ Found', links.data.length, 'payment links');
    console.log('   Latest:', links.data[0].description);
  } else {
    console.log('❌ No payment links found');
    console.log('   This might be normal if you haven\'t created any yet');
    console.log('   OR your old links are tied to different org ID');
  }
  
  // 4. Check user endpoint
  console.log('\n4️⃣ Checking user organization endpoint...');
  const userOrgRes = await fetch('/api/user/organization');
  const userOrg = await userOrgRes.json();
  console.log('   Returned Org ID:', userOrg.organizationId);
  
  if (userOrg.organizationId !== orgId) {
    console.log('   ⚠️ MISMATCH! Cached org ID differs from API');
    console.log('   Cached:', orgId);
    console.log('   API:', userOrg.organizationId);
  }
  
  console.log('\n✅ Diagnostic complete!');
}

diagnosePlatform();
```

## Getting Database Access

### If Using Supabase:

1. Go to [supabase.com](https://supabase.com)
2. Log in to your project
3. Click "Table Editor" or "SQL Editor"
4. Run the SQL queries above

### If Using Render PostgreSQL:

1. Go to Render dashboard
2. Click your database
3. Click "Connect" → Copy the connection string
4. Use a tool like [TablePlus](https://tableplus.com/) or [pgAdmin](https://www.pgadmin.org/)
5. Run the SQL queries

## Need Help?

Provide these details:

1. **Output of the diagnostic script** (copy/paste from console)
2. **Your current organization ID** (from localStorage)
3. **Do merchant settings exist?** (yes/no)
4. **Do payment links exist in database?** (if you can check)
5. **When were the payment links created?** (before or after recent deployment)

---

**Quick Action Items:**

1. ✅ Run diagnostic script in browser console
2. ✅ Check if merchant settings exist
3. ✅ Recreate merchant settings if missing
4. ✅ Check organization ID consistency
5. ✅ Fix database org IDs if mismatched
6. ✅ Test creating new payment link

