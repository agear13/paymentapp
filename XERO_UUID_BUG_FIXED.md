# 🐛 Xero Account Mapping Bug - FIXED!

## The Problem

Your error message:
```
Invalid Xero account code: "683929ab-726e-46c7-aa2f-58099c499aa4"
This appears to be an internal ID.
```

## Root Cause

The Xero Account Mapping UI component was **saving UUIDs** (Xero's internal accountID) instead of **account codes** ("200", "1050", "1053", etc.) to the database.

### Where The Bug Was:

**File:** `src/components/dashboard/settings/xero-account-mapping.tsx`

**Line 427** - SelectItem value:
```typescript
// ❌ BEFORE (WRONG):
<SelectItem key={account.accountID} value={account.accountID}>
  {account.code} - {account.name}
</SelectItem>

// ✅ AFTER (FIXED):
<SelectItem key={account.accountID} value={account.code}>
  {account.code} - {account.name}
</SelectItem>
```

**Line 448** - Summary display lookup:
```typescript
// ❌ BEFORE (WRONG):
const account = accounts.find(a => a.accountID === accountId);

// ✅ AFTER (FIXED):
const account = accounts.find(a => a.code === accountId);
```

**Lines 510-517** - Default mappings:
```typescript
// ❌ BEFORE (WRONG):
xero_usdt_clearing_account_id: findAccount(accounts, ['1053', 'usdt'])?.accountID,

// ✅ AFTER (FIXED):
xero_usdt_clearing_account_id: findAccount(accounts, ['1053', 'usdt'])?.code,
```

---

## ✅ What Was Fixed

1. ✅ SelectItem now saves **account.code** instead of **account.accountID**
2. ✅ MappingSummaryItem now looks up by **code** instead of **UUID**
3. ✅ getDefaultMappings now returns **codes** instead of **UUIDs**

---

## 🚀 How To Test The Fix

### Step 1: Deploy the Fix

1. **Commit the changes:**
   ```bash
   git add src/components/dashboard/settings/xero-account-mapping.tsx
   git commit -m "Fix: Use Xero account codes instead of UUIDs for mappings"
   git push
   ```

2. **Render will auto-deploy** (takes ~2-3 minutes)

### Step 2: Clear Old UUID Mappings

Your database currently has UUIDs stored. You need to re-save with correct codes:

1. **Log into your app**
2. **Go to Settings → Xero Account Mappings**
3. **Re-select each account** from the dropdown (they should now save codes)
4. **Click "Save Mappings"**

You should see values like:
- Revenue: `200`
- USDT: `1053`
- HBAR: `1051`
- etc.

### Step 3: Test Sync

1. **Go to Settings → Integrations**
2. **Click "Process Queue"**
3. **Should work now!** ✅
4. **Verify invoice in Xero**

---

## 📊 Expected Database Values

**Before (WRONG):**
```sql
xero_usdt_clearing_account_id = '683929ab-726e-46c7-aa2f-58099c499aa4' -- UUID
```

**After (CORRECT):**
```sql
xero_usdt_clearing_account_id = '1053' -- Account Code
```

---

## 🔍 Why This Happened

The Xero API returns accounts with TWO identifiers:

1. **`accountID`** (UUID) - Internal Xero database ID
   - Example: `683929ab-726e-46c7-aa2f-58099c499aa4`
   - Used by Xero API for lookups
   - NOT used for accounting entries

2. **`code`** (String) - The account code
   - Example: `200`, `1053`, `1050`
   - Used in accounting entries
   - What we need to save

The UI was accidentally saving #1 instead of #2.

---

## 🎯 Timeline

**Before Fix:**
1. User selects "1053 - USDT Clearing" from dropdown
2. UI saves UUID: `683929ab-726e-46c7-aa2f-58099c499aa4`
3. Sync tries to use UUID as account code
4. Xero rejects: "Invalid account code"
5. Sync fails ❌

**After Fix:**
1. User selects "1053 - USDT Clearing" from dropdown
2. UI saves code: `1053`
3. Sync uses `1053` as account code
4. Xero accepts it
5. Sync succeeds! ✅

---

## 📝 What You Need To Do

1. ✅ **Code is fixed** (already done)
2. ⏳ **Wait for Render deployment** (~2-3 minutes)
3. 🔄 **Re-save your mappings** in the UI
4. 🧪 **Test a sync**

---

## ✨ Bonus: Automatic Xero Sync Still Working

Your cron job is still configured and running every 5 minutes:
- ✅ CRON_SECRET configured
- ✅ cron-job.org setup complete
- ✅ Authenticated successfully (200 OK)

Once you re-save the mappings, syncs will work automatically!

---

**Date**: 2026-01-20  
**Status**: ✅ BUG FIXED - Ready to re-save mappings

