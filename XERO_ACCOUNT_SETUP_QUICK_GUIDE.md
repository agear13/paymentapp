# Xero Account Mapping - Quick Setup Guide

## 🎯 What You Need to Do

Your syncs are failing because the system doesn't know which Xero account codes to use. You need to tell Provvypay which accounts in Xero to map to.

---

## 📋 **Step-by-Step Instructions**

### **Step 1: Wait for Render to Deploy** (~3-5 minutes)
Check your Render dashboard - the latest deploy should be running now.

### **Step 2: Go to Settings → Integrations**
1. Open Provvypay
2. Navigate to **Settings** → **Integrations**
3. Scroll down past the Xero connection section

### **Step 3: Find "Xero Account Mapping" Section**
You'll now see a new section called **"Xero Account Mapping"** with a form to configure 8 accounts.

### **Step 4: Map Your Xero Accounts**

You need to map these **8 accounts**:

| What it's for | Example Xero Account | Notes |
|--------------|---------------------|-------|
| **Sales Revenue** | "200 - Sales" | Where invoice revenue is recorded |
| **Accounts Receivable** | "110 - Accounts Receivable" | Customer invoices |
| **Stripe Clearing** | "1050 - Stripe" | For Stripe payments |
| **HBAR Clearing** | "1051 - HBAR" | For Hedera HBAR payments |
| **USDC Clearing** | "1052 - USDC" | For USDC stablecoin |
| **USDT Clearing** | "1053 - USDT" | For USDT stablecoin |
| **AUDD Clearing** 🇦🇺 | "1054 - AUDD" | For Australian Dollar stablecoin |
| **Fee Expense** | "6100 - Payment Fees" | Processing fees |

---

## 🏦 **Setting Up Accounts in Xero** (If Needed)

If you don't have these accounts in Xero yet, you need to create them first:

### **Option A: Use Existing Accounts** (Simplest)
1. Open your Xero account
2. Go to **Accounting** → **Chart of Accounts**
3. Find similar accounts you already have
4. Use those in Provvypay

### **Option B: Create New Accounts** (Recommended for clarity)

In Xero, go to **Accounting** → **Chart of Accounts** → **Add Account**:

1. **Sales Revenue** (if not existing):
   - Type: **Revenue**
   - Code: **200** (or your standard revenue code)
   - Name: **Sales** or **Revenue**

2. **Accounts Receivable** (usually already exists):
   - Type: **Current Asset**
   - Code: **110** (standard)
   - Name: **Accounts Receivable**

3. **Clearing Accounts** (create 5 separate ones):
   
   **For Stripe:**
   - Type: **Current Asset** or **Bank**
   - Code: **1050**
   - Name: **Stripe Clearing**
   
   **For HBAR:**
   - Type: **Current Asset** or **Bank**
   - Code: **1051**
   - Name: **HBAR Clearing** or **Hedera Clearing**
   
   **For USDC:**
   - Type: **Current Asset** or **Bank**
   - Code: **1052**
   - Name: **USDC Clearing**
   
   **For USDT:**
   - Type: **Current Asset** or **Bank**
   - Code: **1053**
   - Name: **USDT Clearing**
   
   **For AUDD (Australian Dollar Stablecoin):**
   - Type: **Current Asset** or **Bank**
   - Code: **1054**
   - Name: **AUDD Clearing** 🇦🇺

4. **Fee Expense** (if not existing):
   - Type: **Expense**
   - Code: **6100** (or your expense code)
   - Name: **Payment Processing Fees** or **Bank Fees**

---

## 💡 **Understanding Clearing Accounts**

**What are clearing accounts?**  
Temporary holding accounts for payments in transit. When a customer pays via HBAR, the money goes:
1. **Invoice** → Accounts Receivable (110)
2. **Payment received** → HBAR Clearing (1051)
3. **Later** → Bank account (when you convert/transfer)

**Why separate accounts for each token?**
- Better tracking of each cryptocurrency
- Easier reconciliation
- Clear audit trail
- Accurate reporting

---

## ✅ **Complete the Mapping**

### In Provvypay (after deploy):

1. Go to **Settings** → **Integrations**
2. Scroll to **"Xero Account Mapping"**
3. Click **"Fetch Xero Accounts"** (loads your chart of accounts)
4. Select accounts from the dropdown for each field:
   - Revenue Account
   - Receivable Account
   - Stripe Clearing
   - HBAR Clearing
   - USDC Clearing
   - USDT Clearing
   - AUDD Clearing
   - Fee Expense
5. Click **"Save Mappings"**
6. Success! ✅

---

## 🔄 **Retry Failed Syncs**

After configuring the accounts:

1. Scroll down to **"Xero Sync Queue"**
2. You should see your 6 payments in "RETRYING" status
3. They will automatically retry in a few minutes
4. **OR** click **"Process Queue"** to retry immediately
5. Check the status - should show **"SUCCESS"** ✅

---

## 🎉 **Verify in Xero**

After successful sync:

1. Open Xero
2. Go to **Business** → **Invoices** (or **Sales**)
3. You should see 6 new invoices:
   - Invoice numbers: `PL-RwWypg3Q`, `PL-QueHixjJ`, etc.
   - All marked as **PAID**
   - Payment references: Hedera transaction IDs
   - Amounts: $1 AUD each

---

## ❓ **Troubleshooting**

### Issue: "Can't find my accounts in the dropdown"
**Solution**: Click **"Fetch Xero Accounts"** button to reload from Xero

### Issue: "Accounts not showing up after creating them in Xero"
**Solution**: 
1. Wait 30 seconds for Xero to sync
2. Click **"Fetch Xero Accounts"** in Provvypay
3. If still not showing, refresh the page

### Issue: "Which account should I use?"
**Suggestions**:
- **Revenue**: Any account in the 200-299 or 4000-4999 range
- **Receivables**: Usually "110 - Accounts Receivable" (standard)
- **Clearing**: Create new accounts in the 1050-1099 range
- **Fee Expense**: Any account in the 6000-6999 range

### Issue: "Can I use the same clearing account for all crypto?"
**Answer**: No! Each token must have its own clearing account for proper tracking and reconciliation.

---

## 📞 **Need Help?**

If you're stuck:
1. Take a screenshot of your Xero Chart of Accounts
2. Take a screenshot of the Provvypay mapping form
3. Let me know what's confusing

---

**Estimated Time**: 10-15 minutes (including creating accounts in Xero)  
**Difficulty**: ⭐⭐ (Easy once you know which accounts to use)

---

## 🚀 **Quick Tips**

- ✅ You only need to do this **once**
- ✅ All future payments will use these mappings automatically
- ✅ You can change the mappings later if needed
- ✅ The UI shows helpful descriptions for each field
- ✅ Validation ensures you don't use duplicate clearing accounts

---

**Once you've configured the accounts, your Xero integration will be 100% working!** 🎉

