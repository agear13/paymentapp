# 🚨 Xero Sync Issues - Fix Guide

## Problems Detected

Your Xero sync is failing with **two validation errors**:

1. **"Organisation is not subscribed to currency USD"** - Your Xero organization doesn't support USD
2. **"Account code '683929AB-726E-46C7-AA2F-58099C499AA4' is not a valid code"** - Using a UUID instead of a Xero account code

---

## ✅ Fix #1: Currency Issue

### Problem
Your Xero organization is not set up to handle USD currency, but your payment was in USD.

### Solutions (Pick One)

#### Option A: Enable USD in Xero (Recommended if you accept USD payments)

1. Log into your Xero account
2. Go to **Settings** → **General Settings** → **Features**
3. Enable **Multi-Currency**
4. Go to **Settings** → **Currencies**
5. Click **Add Currency**
6. Add **USD** (United States Dollar)
7. Save changes

#### Option B: Change Default Currency in Provvypay

1. Go to Provvypay → **Settings** → **General**
2. Change **Default Currency** to match your Xero base currency (e.g., AUD)
3. Save changes

This will make all new payment links use your Xero-supported currency.

---

## ✅ Fix #2: Invalid Account Code

### Problem
Your Xero account mapping is using an internal UUID (`683929AB-726E-46C7-AA2F-58099C499AA4`) instead of a valid Xero account code.

Xero expects **account codes** like:
- ✅ `200` (Sales Revenue)
- ✅ `400` (Expense Account)
- ✅ `110` (Accounts Receivable)

**NOT** UUIDs like:
- ❌ `683929AB-726E-46C7-AA2F-58099C499AA4`

### Solution: Fix Your Xero Account Mappings

1. Go to Provvypay → **Settings** → **Integrations**
2. Scroll to **Xero Account Mapping** section
3. For each mapping, enter the **Xero Account Code** (not name, not ID)

#### How to Find Your Xero Account Codes:

1. Open Xero in another tab
2. Go to **Accounting** → **Chart of Accounts**
3. Look at the **Code** column (e.g., "200", "400", "1050")
4. Copy these codes and paste them into Provvypay

#### Example Mapping:

| Provvypay Field | Xero Account Example | Xero Code |
|----------------|----------------------|-----------|
| **Sales Revenue Account** | "200 - Sales" | `200` |
| **Accounts Receivable** | "110 - Accounts Receivable" | `110` |
| **Stripe Clearing** | "1050 - Stripe Clearing" | `1050` |
| **HBAR Clearing** | "1051 - HBAR" | `1051` |
| **USDC Clearing** | "1052 - USDC" | `1052` |
| **USDT Clearing** | "1053 - USDT" | `1053` |
| **AUDD Clearing** | "1054 - AUDD" | `1054` |
| **Fee Expense** | "6100 - Payment Fees" | `6100` |

5. Click **Save Mappings**

---

## 🔄 Retry Failed Syncs

After fixing the above issues:

1. Go to **Settings** → **Integrations** → **Xero**
2. Scroll to **Sync Queue Status**
3. Click **"Process Queue Now"**

This will retry all failed syncs with your corrected settings.

---

## 🧪 Test the Fix

1. Create a small test payment link ($1)
2. Make a payment (Stripe or crypto)
3. Go to **Settings** → **Integrations** → **Xero** → **Sync Status**
4. Check if sync shows as **SUCCESS**
5. Verify invoice appears in Xero

---

## 📝 Common Xero Account Codes

Here are typical account codes you might use:

### Revenue Accounts (100-299)
- `200` - Sales Revenue
- `260` - Other Revenue

### Expense Accounts (400-599)
- `400` - General Expenses
- `404` - Bank Fees
- `485` - Payment Processing Fees

### Asset Accounts (1000-1199)
- `1050` - Stripe Clearing
- `1051` - HBAR Clearing
- `1052` - USDC Clearing
- `1053` - USDT Clearing
- `1054` - AUDD Clearing
- `1200` - Accounts Receivable

### Current Assets (600-699)
- `610` - Accounts Receivable (Alternative)

---

## ⚠️ Important Notes

1. **Account codes are case-sensitive** - Use exact codes from Xero
2. **Don't use account names** - Only use the numeric/alphanumeric code
3. **Don't use UUIDs** - Never use internal IDs or database IDs
4. **Create accounts first** - If you don't have these accounts in Xero, create them first

---

## 🆘 Still Having Issues?

### Check Xero Connection

1. Go to **Settings** → **Integrations**
2. Look for **Xero Connection Status**
3. If **Disconnected**, click **"Connect to Xero"**
4. Authorize the connection

### Check Error Details

1. Go to **Settings** → **Integrations** → **Xero**
2. Scroll to **Recent Syncs**
3. Click on failed sync to see detailed error message
4. Look for specific validation errors

### Verify Account Code Format

Run this check on your settings:
- Is the account code **shorter than 10 characters**? ✅
- Is it **alphanumeric only**? ✅
- Does it **match exactly** what's in Xero? ✅
- Is it **NOT a UUID** (no dashes)? ✅

---

## 📊 Quick Checklist

- [ ] Multi-currency enabled in Xero (if using USD)
- [ ] OR Default currency in Provvypay matches Xero base currency
- [ ] All 8 Xero account mappings configured with **codes** (not UUIDs)
- [ ] Account codes match exactly what's in Xero Chart of Accounts
- [ ] Xero connection is active and authorized
- [ ] Clicked "Process Queue Now" to retry failed syncs
- [ ] Test payment synced successfully

---

## 🎯 Expected Result

After fixing these issues, you should see:

1. ✅ Invoices created in Xero with correct account codes
2. ✅ Payments recorded against those invoices
3. ✅ Sync status shows **SUCCESS** in Provvypay
4. ✅ No more "validation exception" errors
5. ✅ All pending syncs processed successfully

---

**Last Updated**: 2026-01-17
**Estimated Fix Time**: 10-15 minutes

