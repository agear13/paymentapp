# Quick Fix Guide - Payment Links & Payment Methods

## 🎯 What's Wrong

You can log in, but:
- ❌ Old payment links don't show in table
- ❌ No payment methods when creating invoice
- ✅ Stripe & Hedera IDs are saved in settings

## 🔍 Most Likely Cause

**Organization ID Mismatch**: Your old data is tied to a different organization ID than you're currently logged in with.

## ⚡ Quick Fix Options

### Option 1: Use Diagnostic Panel (Easiest)

I've created a diagnostic component for you. Add it temporarily to your dashboard:

1. **Add to dashboard page**:

Edit `src/app/(dashboard)/dashboard/page.tsx`:

```typescript
// Add this import at top
import { DiagnosticPanel } from '@/components/dashboard/diagnostic-panel';

// Then add component somewhere in the page (near the top is good)
<DiagnosticPanel />
```

2. **View the dashboard** - It will show you exactly what's wrong

3. **Click the quick fix buttons** to resolve issues

4. **Remove the component** after fixing

### Option 2: Browser Console (Quick)

1. Open your deployed app
2. Press F12 (DevTools)
3. Go to **Console** tab
4. Copy/paste this entire script:

```javascript
async function quickFix() {
  console.log('🔧 Quick Fix Tool\n');
  
  const orgId = localStorage.getItem('provvypay.organizationId');
  console.log('Organization ID:', orgId);
  
  if (!orgId) {
    console.log('❌ No org ID! Log out and back in.');
    return;
  }
  
  // Check merchant settings
  const settingsRes = await fetch('/api/merchant-settings?organizationId=' + orgId);
  const settings = await settingsRes.json();
  
  if (!settings.data || settings.data.length === 0) {
    console.log('\n❌ No merchant settings found!');
    console.log('➡️ Fix: Go to /dashboard/settings/merchant');
    console.log('   Fill in: Display Name, Currency, Stripe ID, Hedera ID');
    return;
  }
  
  const s = settings.data[0];
  console.log('\n✅ Merchant Settings Found:');
  console.log('   Display Name:', s.display_name);
  console.log('   Stripe ID:', s.stripe_account_id || '❌ MISSING');
  console.log('   Hedera ID:', s.hedera_account_id || '❌ MISSING');
  
  if (!s.stripe_account_id && !s.hedera_account_id) {
    console.log('\n⚠️ No payment methods configured!');
    console.log('➡️ Fix: Go to /dashboard/settings/merchant');
    console.log('   Add your Stripe or Hedera account ID');
  }
  
  // Check payment links
  const linksRes = await fetch('/api/payment-links?organizationId=' + orgId);
  const links = await linksRes.json();
  
  if (!links.data || links.data.length === 0) {
    console.log('\n❌ No payment links found');
    console.log('   Your old links may be tied to different org ID');
  } else {
    console.log('\n✅ Found', links.data.length, 'payment links');
  }
}

quickFix();
```

5. **Follow the instructions** it prints

### Option 3: Recreate Merchant Settings (Fastest)

If the console says "No merchant settings found":

1. Navigate to: `/dashboard/settings/merchant`

2. Fill in the form:
   - **Display Name**: Your business name
   - **Default Currency**: USD
   - **Stripe Account ID**: `acct_YOUR_STRIPE_ID`
   - **Hedera Account ID**: `0.0.YOUR_HEDERA_ID`

3. **Save**

4. Try creating a payment link again

## 🎯 Step-by-Step Resolution

### Step 1: Identify the Issue

Run the diagnostic (Option 1 or 2 above)

### Step 2: Fix Based on Result

#### If "No merchant settings found":
→ Go to `/dashboard/settings/merchant` and fill in details

#### If "No payment methods configured":
→ Add Stripe or Hedera account ID in merchant settings

#### If "Organization ID mismatch":
→ Clear cache and log out/in:
```javascript
localStorage.removeItem('provvypay.organizationId');
```
Then log out and back in.

#### If "No payment links found":
→ Your old links are tied to different org ID
→ Need database query to fix (see PAYMENT_LINKS_DATA_ISSUE.md)

### Step 3: Test

1. Go to `/dashboard/payment-links`
2. Click "+ Create Invoice"
3. Fill in amount and description
4. Submit
5. Check if payment link created successfully
6. Open the payment link in incognito
7. Should see Stripe/Hedera payment options

## 📊 What Each Issue Means

### Issue: "No merchant settings"
**Meaning**: The app doesn't know your Stripe/Hedera IDs
**Impact**: Can't create payment links with payment methods
**Fix**: Add settings at `/dashboard/settings/merchant`

### Issue: "No payment methods configured"
**Meaning**: Merchant settings exist but IDs are empty
**Impact**: Payment links created but no payment options shown
**Fix**: Edit settings and add Stripe/Hedera IDs

### Issue: "Organization ID mismatch"
**Meaning**: Cached org ID differs from API
**Impact**: Loading wrong data
**Fix**: Clear cache, log out/in

### Issue: "No payment links found"
**Meaning**: Either none created OR tied to different org ID
**Impact**: Table appears empty
**Fix**: Check database or create new link

## 🚀 Testing Checklist

After applying fixes:

- [ ] Navigate to `/dashboard/settings/merchant`
- [ ] Verify Stripe ID shows correctly
- [ ] Verify Hedera ID shows correctly
- [ ] Navigate to `/dashboard/payment-links`
- [ ] Click "+ Create Invoice"
- [ ] Fill in form (amount: 100, description: Test)
- [ ] Submit successfully
- [ ] See new link in table
- [ ] Click on link to view details
- [ ] Copy link URL
- [ ] Open in incognito/private window
- [ ] See payment method buttons (Stripe/Hedera)

If all checked, you're good! ✅

## 🔗 Related Documentation

- **Full diagnosis**: `PAYMENT_LINKS_DATA_ISSUE.md`
- **Deployment fixes**: `DEPLOYMENT_ISSUES_RESOLVED.md`
- **General troubleshooting**: `TROUBLESHOOTING_PAYMENT_LINKS.md`

## 💡 Pro Tips

1. **Always check merchant settings first** - 90% of "no payment methods" issues are here

2. **Use the diagnostic panel** - Saves time vs manual checking

3. **Check console for errors** - Red errors = something's broken

4. **Test in incognito** - Ensures no cache issues

5. **Keep org ID consistent** - Don't switch between test/prod accounts

## ❓ Still Not Working?

Run this complete diagnostic and send results:

```javascript
async function fullDiag() {
  const report = {
    orgId: localStorage.getItem('provvypay.organizationId'),
    email: 'alishajayne13@gmail.com',
    timestamp: new Date().toISOString(),
  };
  
  // Merchant settings
  const settingsRes = await fetch('/api/merchant-settings?organizationId=' + report.orgId);
  report.settings = await settingsRes.json();
  
  // Payment links
  const linksRes = await fetch('/api/payment-links?organizationId=' + report.orgId);
  report.links = await linksRes.json();
  
  // User org
  const userOrgRes = await fetch('/api/user/organization');
  report.userOrg = await userOrgRes.json();
  
  console.log('DIAGNOSTIC REPORT:');
  console.log(JSON.stringify(report, null, 2));
  
  return report;
}

fullDiag();
```

Copy the output and share it for debugging.

---

**TL;DR**:
1. Open dashboard → Add `<DiagnosticPanel />` component
2. Click "Run Diagnostics"
3. Follow the quick fix buttons
4. Test creating a payment link
5. Should work now! ✅

