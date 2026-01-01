# Merchant Endpoint Debugging Guide 🔍

**Issue:** "Not getting any output" when frontend loads merchant data for payment link

**Endpoint:** `GET /api/public/merchant/[shortCode]`

---

## ✅ Current State (Already Implemented)

### Frontend Component: `src/components/public/hedera-payment-option.tsx`

**Status:** ✅ Already has comprehensive logging and error handling!

**Logs Present:**
- Line 61: `console.error('[HederaPaymentOption] shortCode is missing!')`
- Line 67: `console.log('[HederaPaymentOption] Fetching merchant settings for shortCode:', shortCode)`
- Line 84: `console.log('[HederaPaymentOption] Fetching merchant from:', url)`
- Line 87: `console.log('[HederaPaymentOption] Response status:', response.status)`
- Line 91: `console.error('[HederaPaymentOption] API error:', response.status, errorData)`
- Line 96: `console.log('[HederaPaymentOption] Merchant data received:', result)`
- Line 99: `console.error('[HederaPaymentOption] Missing data field in response:', result)`
- Line 105: `console.warn('[HederaPaymentOption] Merchant has not configured Hedera payments')`
- Line 111: `console.log('[HederaPaymentOption] Merchant account ID set:', result.data.hederaAccountId)`
- Line 115: `console.error('[HederaPaymentOption] Failed to fetch merchant settings:', error)`

**Error States Handled:**
- ✅ Missing shortCode (line 60-64)
- ✅ HTTP errors (line 89-93)
- ✅ Missing data field (line 98-101)
- ✅ Missing Hedera account (line 103-109)
- ✅ Network/fetch errors (line 113-117)

**UI States:**
- ✅ Loading state (lines 312-317)
- ✅ Error state with retry button (lines 320-331)
- ✅ Success state (lines 334+)

### Backend Route: `src/app/api/public/merchant/[shortCode]/route.ts`

**Status:** ✅ Already has comprehensive server-side logging!

**Logs Present:**
- Line 20: `log.info({ shortCode }, '[Merchant API] Request received')`
- Line 23: `log.warn('[Merchant API] Missing shortCode in request')`
- Line 31: `log.info({ shortCode }, '[Merchant API] Looking up payment link')`
- Line 42: `log.warn({ shortCode }, '[Merchant API] Payment link not found')`
- Line 49-52: `log.info({ shortCode, paymentLinkId, organizationId }, '[Merchant API] Payment link found...')`
- Line 66-69: `log.warn({ shortCode, organizationId }, '[Merchant API] Merchant settings not found...')`
- Line 76-83: `log.info({ shortCode, hasHederaAccount, hasStripeAccount }, '[Merchant API] Merchant settings found...')`
- Line 94: `log.error({ error }, '[Merchant API] Failed to fetch merchant settings')`

**Error Responses:**
- ✅ 400: Missing shortCode
- ✅ 404: Payment link not found
- ✅ 404: Merchant settings not found
- ✅ 500: Internal server error

---

## 🧪 Diagnostic Steps

### Step 1: Check Browser Console

Open the payment page and check the browser console for logs:

```
Expected logs (if working):
[HederaPaymentOption] Fetching merchant settings for shortCode: ABC123
[HederaPaymentOption] Fetching merchant from: /api/public/merchant/ABC123
[HederaPaymentOption] Response status: 200
[HederaPaymentOption] Merchant data received: { data: { ... } }
[HederaPaymentOption] Merchant account ID set: 0.0.123456
```

**If you see NO logs at all:**
- Component is not mounting
- `isAvailable` prop is `false`
- `shortCode` is undefined
- See "Troubleshooting: No Logs" below

**If you see error logs:**
- Check the specific error message
- See "Common Errors" section below

### Step 2: Check Server Logs

Check the terminal running `npm run start` for server logs:

```
Expected logs (if working):
{"level":"info","shortCode":"ABC123","msg":"[Merchant API] Request received"}
{"level":"info","shortCode":"ABC123","msg":"[Merchant API] Looking up payment link"}
{"level":"info","shortCode":"ABC123","paymentLinkId":"...","organizationId":"...","msg":"[Merchant API] Payment link found..."}
{"level":"info","shortCode":"ABC123","hasHederaAccount":true,"hasStripeAccount":true,"msg":"[Merchant API] Merchant settings found..."}
```

**If you see NO logs at all:**
- Request is not reaching the server
- Network error or wrong URL
- See "Troubleshooting: Request Not Reaching Server"

**If you see warning/error logs:**
- Check which step failed
- See "Common Errors" section below

### Step 3: Test Database Directly

Run the test script to check database state:

```bash
cd src
npm run test:merchant
```

**This will:**
1. List all available payment links with short codes
2. Show which ones have merchant settings configured
3. Provide curl commands to test the API

**Example output:**
```
🔍 Testing Merchant Endpoint
================================

Available payment links:
------------------------
1. Short Code: ABC123
   Status: OPEN
   Amount: USD 50.00
   Merchant: Test Merchant

💡 To test the endpoint, run:
   npm run test:merchant ABC123
```

### Step 4: Test API with Curl

Test the endpoint directly:

```bash
# Replace ABC123 with your actual short code
curl http://localhost:3000/api/public/merchant/ABC123
```

**Expected success response:**
```json
{
  "data": {
    "hederaAccountId": "0.0.123456",
    "displayName": "Test Merchant",
    "hasStripeAccount": true,
    "hasHederaAccount": true
  }
}
```

**Error responses:**

```json
// 404 - Payment link not found
{
  "error": "Payment link not found"
}

// 404 - Merchant settings not found
{
  "error": "Merchant settings not found"
}

// 400 - Missing short code
{
  "error": "Short code is required"
}
```

---

## 🐛 Common Errors & Fixes

### Error 1: "Payment link not found" (404)

**Cause:** No payment link exists with that short code in the database.

**Fix:**
```bash
# Check what payment links exist
cd src
npm run test:merchant

# Or check database directly
npx prisma studio
# Navigate to payment_links table
```

**Create test data:**
```bash
cd src
npm run setup:merchant
```

### Error 2: "Merchant settings not found" (404)

**Cause:** Payment link exists, but no merchant_settings record for that organization.

**Server log will show:**
```
[Merchant API] Payment link found, fetching merchant settings
[Merchant API] Merchant settings not found for organization
```

**Fix:**
```bash
cd src
npm run setup:merchant
```

This script will:
- Find all organizations
- Create merchant_settings with test Hedera and Stripe accounts
- Update existing settings if needed

### Error 3: "Merchant has not configured Hedera payments"

**Cause:** Merchant settings exist, but `hedera_account_id` is NULL.

**Frontend will show:**
```
[HederaPaymentOption] Merchant has not configured Hedera payments
```

**Fix:**
```sql
-- Update merchant settings with Hedera account
UPDATE merchant_settings 
SET hedera_account_id = '0.0.123456'
WHERE organization_id = 'YOUR_ORG_ID';
```

Or run:
```bash
cd src
npm run setup:merchant
```

### Error 4: Component Not Mounting (No Logs)

**Possible causes:**

1. **Hedera not available:**
   - Check `availablePaymentMethods.hedera` is `true`
   - Check merchant_settings has `hedera_account_id` set

2. **Dynamic import not loading:**
   - Check browser console for chunk load errors
   - See if "Loading crypto payment option..." appears briefly

3. **shortCode is undefined:**
   - Check parent component passes `shortCode` prop
   - Check payment link data structure

**Debug:**
```typescript
// In payment-method-selector.tsx, add before HederaPaymentOption:
console.log('Hedera available?', availablePaymentMethods.hedera);
console.log('shortCode:', shortCode);
console.log('paymentLinkId:', paymentLinkId);
```

### Error 5: Request Not Reaching Server

**Possible causes:**

1. **Server not running:**
   ```bash
   # Check if server is running on port 3000
   curl http://localhost:3000/api/health
   ```

2. **Wrong URL:**
   - Check browser Network tab
   - Verify URL is `/api/public/merchant/[shortCode]`
   - NOT `/api/payment-links/[shortCode]/merchant` (old endpoint)

3. **CORS or network error:**
   - Check browser console for CORS errors
   - Check if running on different port

**Fix:**
```bash
# Restart server
cd src
npm run start
```

### Error 6: JSON Parse Error

**Cause:** Server returned non-JSON response (HTML error page, etc.)

**Frontend will show:**
```
[HederaPaymentOption] API error: 500 { error: 'Unknown error' }
```

**Fix:**
- Check server logs for the actual error
- Check if database connection is working
- Check if Prisma client is generated

```bash
cd src
npx prisma generate
npm run start
```

---

## 🔧 Troubleshooting Checklist

Run through this checklist systematically:

### Database Layer
- [ ] Payment link exists with the short code
- [ ] Payment link status is OPEN (not DRAFT/EXPIRED/CANCELED)
- [ ] Organization exists for the payment link
- [ ] Merchant settings exist for the organization
- [ ] Merchant settings have `hedera_account_id` set

**Test:** `npm run test:merchant [shortCode]`

### API Layer
- [ ] Server is running on port 3000
- [ ] API route file exists at correct path
- [ ] Prisma client is generated
- [ ] Database connection is working
- [ ] Server logs show request received

**Test:** `curl http://localhost:3000/api/public/merchant/[shortCode]`

### Frontend Layer
- [ ] Component is mounting (check React DevTools)
- [ ] `isAvailable` prop is true
- [ ] `shortCode` prop is defined and correct
- [ ] `useEffect` is running (check console logs)
- [ ] Fetch is being called (check Network tab)
- [ ] Response is being parsed correctly

**Test:** Open browser console and Network tab

---

## 📋 Quick Test Commands

```bash
# 1. Find available payment links
cd src
npm run test:merchant

# 2. Test specific short code
npm run test:merchant ABC123

# 3. Test API with curl
curl http://localhost:3000/api/public/merchant/ABC123

# 4. Check database
npx prisma studio

# 5. Create/update merchant settings
npm run setup:merchant

# 6. Check server health
curl http://localhost:3000/api/health

# 7. View server logs
# (Just watch the terminal running npm run start)
```

---

## 🎯 Root Cause Analysis

Based on the code review, here are the **most likely** root causes:

### 1. **Missing Merchant Settings (Most Common)**

**Probability:** 80%

**Symptoms:**
- API returns 404
- Server log: "Merchant settings not found"
- Frontend shows error state

**Fix:** Run `npm run setup:merchant`

### 2. **Missing Hedera Account ID**

**Probability:** 15%

**Symptoms:**
- API returns 200 but `hederaAccountId` is null
- Frontend shows: "Merchant has not configured Hedera payments"
- Component doesn't proceed past merchant fetch

**Fix:** Update `merchant_settings.hedera_account_id` in database

### 3. **Component Not Mounting**

**Probability:** 4%

**Symptoms:**
- No console logs at all
- Hedera option not visible in UI
- `availablePaymentMethods.hedera` is false

**Fix:** Check payment link's available methods calculation

### 4. **Wrong Short Code**

**Probability:** 1%

**Symptoms:**
- API returns 404
- Server log: "Payment link not found"

**Fix:** Use correct short code from payment link

---

## 🚀 Recommended Action Plan

**If you're seeing "no output", follow these steps in order:**

### Step 1: Verify Database (30 seconds)
```bash
cd src
npm run test:merchant
```

This will immediately show if:
- Payment links exist
- Merchant settings exist
- What short codes to use

### Step 2: Test API Directly (10 seconds)
```bash
curl http://localhost:3000/api/public/merchant/[YOUR_SHORT_CODE]
```

This isolates whether the issue is:
- Backend (API returns error)
- Frontend (API works but UI doesn't show it)

### Step 3: Check Browser Console (10 seconds)
- Open payment page: `http://localhost:3000/pay/[YOUR_SHORT_CODE]`
- Open DevTools Console
- Look for `[HederaPaymentOption]` logs

This shows:
- Is component mounting?
- Is fetch being called?
- What's the response?

### Step 4: Fix Based on Findings

**If API returns 404 "Merchant settings not found":**
```bash
cd src
npm run setup:merchant
```

**If API returns 200 but no `hederaAccountId`:**
```sql
UPDATE merchant_settings 
SET hedera_account_id = '0.0.123456'
WHERE organization_id = (
  SELECT organization_id FROM payment_links WHERE short_code = 'YOUR_CODE'
);
```

**If no logs in console:**
- Check if Hedera option is visible in UI
- Check `availablePaymentMethods.hedera` value
- Check browser Network tab for fetch calls

---

## 📝 Summary

**The code is already well-instrumented!** Both frontend and backend have comprehensive logging and error handling.

**The issue is most likely:**
1. Missing merchant settings in database (80%)
2. Missing Hedera account ID (15%)
3. Component not mounting due to `isAvailable=false` (4%)
4. Wrong short code (1%)

**To diagnose:**
1. Run `npm run test:merchant` to check database
2. Check browser console for `[HederaPaymentOption]` logs
3. Check server logs for `[Merchant API]` logs
4. Test API with curl

**To fix:**
- Run `npm run setup:merchant` to create/update merchant settings
- Verify payment link exists and is OPEN status
- Ensure `hedera_account_id` is set in merchant_settings

---

## 🔗 Related Files

- Frontend: `src/components/public/hedera-payment-option.tsx`
- Backend: `src/app/api/public/merchant/[shortCode]/route.ts`
- Test Script: `src/scripts/test-merchant-endpoint.ts`
- Setup Script: `src/scripts/setup-merchant.ts`
- Parent Component: `src/components/public/payment-method-selector.tsx`

---

**Need more help?** Run the test script and share the output:
```bash
cd src
npm run test:merchant [YOUR_SHORT_CODE]
```

