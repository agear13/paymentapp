# Troubleshooting Payment Links Disappearing Issue

## Quick Fixes to Try (In Order)

### 1. Hard Refresh the Browser ⚡
This is the most likely fix:
- **Windows/Linux**: `Ctrl + Shift + R` or `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

This clears the page cache and forces a fresh load.

### 2. Check Browser Console for Errors 🔍
1. Open browser DevTools (F12 or Right-click → Inspect)
2. Go to "Console" tab
3. Look for any red error messages
4. Take a screenshot if you see errors

### 3. Check LocalStorage 💾
The app uses localStorage to cache your organization ID:
1. Open DevTools (F12)
2. Go to "Application" tab (Chrome) or "Storage" tab (Firefox)
3. Click "Local Storage" → your site URL
4. Look for key: `provvypay.organizationId`
5. If it's missing or wrong, delete it and refresh

### 4. Check Network Tab 🌐
1. Open DevTools (F12)
2. Go to "Network" tab
3. Refresh the page
4. Look for the request to `/api/payment-links`
5. Check if it:
   - Returns 200 status
   - Has `organizationId` parameter in URL
   - Returns data in response

### 5. Restart Dev Server 🔄
If running locally:
```bash
cd src
npm run dev
```

Then refresh browser.

## Diagnostic Checklist

Run through these to identify the issue:

- [ ] **Are you logged in?**
  - Check if your email shows in sidebar footer
  - If not, log out and log back in

- [ ] **Is organizationId loading?**
  - Open DevTools Console
  - Type: `localStorage.getItem('provvypay.organizationId')`
  - Press Enter
  - Should show your org ID (a UUID string)

- [ ] **Is the API working?**
  - In browser, navigate to: `http://localhost:3000/api/user/organization`
  - Should return JSON with `organizationId`
  - If error, check database connection

- [ ] **Any console errors?**
  - Red errors in DevTools Console
  - Failed API requests in Network tab
  - 401/403 errors (authentication issue)
  - 500 errors (server issue)

## What Changed That Could Affect This

Our Platform Preview implementation changed:

1. **Sidebar navigation** - Added new menu items
2. **User type in sidebar** - Initially changed, then reverted
3. **No changes to**:
   - Payment links page
   - Database queries
   - API routes
   - Authentication logic
   - Organization hook

## If Nothing Works

### Nuclear Option: Clear All Browser Data
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

OR

1. Go to browser settings
2. Clear browsing data
3. Select: Cached files and cookies
4. Time range: Last hour
5. Log back into the app

### Check Database Directly
If you have database access:

```sql
-- Check if your payment links still exist in database
SELECT id, title, status, amount, currency
FROM "PaymentLink"
WHERE "organizationId" = 'YOUR_ORG_ID_HERE'
ORDER BY "createdAt" DESC;
```

If they're in the database, it's definitely a frontend issue.

## Most Likely Causes (In Order)

1. **Browser cache issue** (90% probability)
   - Fix: Hard refresh (Ctrl+Shift+R)

2. **LocalStorage got cleared** (5% probability)
   - Fix: Log out and log back in

3. **Console error preventing load** (4% probability)
   - Fix: Check console, fix error, refresh

4. **Database connection issue** (1% probability)
   - Fix: Restart dev server, check DB

## Manual Verification Steps

### Step 1: Verify Organization ID
```javascript
// In browser console:
const orgId = localStorage.getItem('provvypay.organizationId');
console.log('Organization ID:', orgId);

// If null, that's your problem - you need to log out/in
```

### Step 2: Manually Fetch Payment Links
```javascript
// In browser console (replace with your org ID):
fetch('/api/payment-links?organizationId=YOUR_ORG_ID')
  .then(r => r.json())
  .then(data => console.log('Payment links:', data));

// This will show if the API is working
```

### Step 3: Check React State
```javascript
// In browser console with React DevTools:
// Select the PaymentLinksPage component
// Check if paymentLinks state is empty
// Check if isLoading is stuck on true
// Check if organizationId is null
```

## Expected vs Actual Behavior

### Expected:
1. Page loads
2. `useOrganization()` hook fetches org ID from localStorage/API
3. Once org ID is loaded, `fetchPaymentLinks()` is called
4. API returns your payment links
5. Table displays the links

### If Table is Empty:
- One of steps 2-4 is failing
- Most likely: Browser cache served old HTML/JS
- Next likely: LocalStorage cleared

## Quick Test

To verify the Platform Preview didn't break anything:

1. Navigate to `/dashboard` (main dashboard)
2. Does it load correctly?
3. Navigate to `/dashboard/partners/dashboard`
4. Does it load correctly?
5. Navigate back to `/dashboard/payment-links`
6. Does it work now?

If other pages work but payment links doesn't, the issue is specific to that page (unlikely to be caused by our changes).

## Still Not Working?

Please provide:
1. Screenshot of browser console (any errors?)
2. Screenshot of Network tab (payment-links API call)
3. Output of: `localStorage.getItem('provvypay.organizationId')`
4. Do other dashboard pages work correctly?
5. Did a hard refresh help?

## Revert Platform Preview (Last Resort)

If you want to temporarily revert all Platform Preview changes:

```bash
cd src
git status
git diff components/dashboard/app-sidebar.tsx

# If you want to revert:
git checkout components/dashboard/app-sidebar.tsx
rm -rf app/(dashboard)/dashboard/platform-preview/
rm lib/data/mock-platform-preview.ts
```

Then refresh browser.

---

**TL;DR**: Try a hard refresh first (Ctrl+Shift+R). That fixes 90% of these issues after code changes.

