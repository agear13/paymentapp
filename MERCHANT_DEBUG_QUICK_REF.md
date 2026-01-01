# Merchant Endpoint Debug - Quick Reference 🚀

**Issue:** "Not getting any output" when loading merchant data

---

## ⚡ Quick Diagnosis (90 seconds)

### 1. Check Database (30s)
```bash
cd src
npm run test:merchant
```

**Look for:**
- ✅ Payment links listed → Use one of those short codes
- ❌ No payment links → Create test data: `npm run setup:merchant`

### 2. Test API (10s)
```bash
# Replace with your short code
curl http://localhost:3000/api/public/merchant/SkD0OB06
```

**Expected:**
```json
{
  "data": {
    "hederaAccountId": "0.0.1234",
    "displayName": "Merchant Name",
    "hasStripeAccount": true,
    "hasHederaAccount": true
  }
}
```

**If 404:** Run `npm run setup:merchant`

### 3. Check Browser Console (20s)
```
1. Open: http://localhost:3000/pay/SkD0OB06
2. Press F12
3. Look for: [HederaPaymentOption] logs
```

**If NO logs:** Component not mounting → Check Step 4

**If ERROR logs:** Read the error message

### 4. Check Component (30s)
```
1. In DevTools → React Components tab
2. Search: "HederaPaymentOption"
3. Check props: isAvailable, shortCode
```

**If not found:** Check `availablePaymentMethods.hedera`

---

## 🎯 Most Likely Causes

| Symptom | Cause | Fix |
|---------|-------|-----|
| No logs in console | Component not mounting | Check `isAvailable` prop |
| API returns 404 | Missing merchant settings | Run `npm run setup:merchant` |
| "Merchant not configured" | No `hedera_account_id` | Update database or run setup script |
| Hedera option not visible | `availablePaymentMethods.hedera = false` | Check merchant settings |

---

## 🔧 Quick Fixes

### Fix 1: Missing Merchant Settings
```bash
cd src
npm run setup:merchant
```

### Fix 2: Check What's Available
```bash
cd src
npm run test:merchant SkD0OB06
```

### Fix 3: Test Specific Short Code
```bash
# Get list of short codes
npm run test:merchant

# Test one
npm run test:merchant [SHORT_CODE]
```

---

## 📋 Debugging Checklist

- [ ] Server running? `curl http://localhost:3000/api/health`
- [ ] Payment link exists? `npm run test:merchant`
- [ ] Merchant settings exist? (test script shows this)
- [ ] Hedera account set? (test script shows this)
- [ ] API returns 200? `curl http://localhost:3000/api/public/merchant/[CODE]`
- [ ] Component mounting? (Check React DevTools)
- [ ] Console logs present? (Check browser console)
- [ ] Network request sent? (Check Network tab)

---

## 🚨 Common Errors

### "Payment link not found"
```bash
# Check what exists
npm run test:merchant

# Use a valid short code from the list
```

### "Merchant settings not found"
```bash
# Create merchant settings
npm run setup:merchant
```

### "Merchant has not configured Hedera payments"
```sql
-- Update database
UPDATE merchant_settings 
SET hedera_account_id = '0.0.123456'
WHERE organization_id = 'YOUR_ORG_ID';
```

Or run: `npm run setup:merchant`

### No console logs at all
```javascript
// Add to payment-method-selector.tsx before HederaPaymentOption:
console.log('Hedera available?', availablePaymentMethods.hedera);
console.log('shortCode:', shortCode);
```

---

## 📖 Full Documentation

- **Complete Guide:** `MERCHANT_ENDPOINT_DEBUG_GUIDE.md`
- **Diagnosis Report:** `MERCHANT_ENDPOINT_DIAGNOSIS_COMPLETE.md`
- **Test Script:** `src/scripts/test-merchant-endpoint.ts`

---

## 🎯 Action Plan

**If you see "no output":**

1. Run `npm run test:merchant` → Get valid short code
2. Run `npm run test:merchant [CODE]` → Verify data exists
3. Open `http://localhost:3000/pay/[CODE]` → Check console
4. Share console output if still stuck

**90% of issues are:**
- Missing merchant settings (run `npm run setup:merchant`)
- Component not mounting (`isAvailable=false`)
- Wrong short code (use one from test script)

---

**Need help?** Run the test script and share the output! 🚀

