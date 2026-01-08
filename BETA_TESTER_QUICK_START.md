# 🚀 Provvypay Beta Tester Quick Start

Welcome! This guide will help you test Provvypay's payment platform. You'll be testing in a **safe sandbox environment** - no real money involved!

---

## 📝 What You'll Be Testing

- ✅ Account creation and login
- ✅ Organization setup
- ✅ Creating payment links
- ✅ Making payments with:
  - Credit cards (via Stripe test mode)
  - Cryptocurrency (via Hedera testnet)
- ✅ Viewing transaction data
- ✅ Connecting to Xero (demo company)

---

## 🎯 Step 1: Create Your Account (5 minutes)

1. **Go to the beta site:** `[BETA_URL_WILL_BE_PROVIDED]`
2. Click **"Sign Up"**
3. Enter your email and create a password
4. Check your email for a confirmation link
5. Click the link to verify your account
6. Sign in with your credentials

✅ **You're in!**

---

## 🏢 Step 2: Set Up Your Organization (2 minutes)

After login, you'll see the onboarding page:

1. **Organization Name:** `[Your Name] Beta Test`
2. **Display Name:** `[Your Name] Testing`
3. **Default Currency:** `USD` (or your preference)
4. Click **"Complete Setup"**

✅ **Organization created!**

---

## 💳 Step 3: Set Up Payment Methods (15 minutes)

### A. Set Up Hedera (Cryptocurrency) Testing

**What is HashPack?** A cryptocurrency wallet for testing Hedera payments.

1. **Download HashPack:**
   - Go to: https://www.hashpack.app/
   - Install the browser extension
   - Create a new wallet (save your seed phrase!)

2. **Switch to Testnet:**
   - In HashPack, click Settings (gear icon)
   - Select "Network"
   - Choose **"Testnet"** (NOT mainnet!)
   - Confirm the switch

3. **Get Your Account ID:**
   - In HashPack main screen
   - Copy your Account ID (looks like `0.0.1234567`)

4. **Get Free Test HBAR:**
   - Go to: https://portal.hedera.com/faucet
   - Paste your testnet Account ID
   - Click "Get HBAR"
   - Wait ~30 seconds
   - Check HashPack - you should see test HBAR!

5. **Associate Test Tokens:**
   - In HashPack, go to "Tokens"
   - Click "+" to add tokens
   - Search for and associate:
     - **USDC** (Token ID: `0.0.429274`)
     - **USDT** (Token ID: `0.0.429275`)

6. **Add Account ID to Provvypay:**
   - In Provvypay: Dashboard → Settings → Merchant
   - Paste your Hedera Account ID in the "Hedera Account ID" field
   - Click **"Save Changes"**

✅ **Hedera setup complete!**

### B. Stripe Setup (Already Done!)

The Stripe test environment is already configured. You'll use test credit cards when making payments.

**Test Card Number:** `4242 4242 4242 4242`  
**Expiry:** Any future date (e.g., `12/25`)  
**CVC:** Any 3 digits (e.g., `123`)

### C. Set Up Xero Integration (Optional - 10 minutes)

**Note:** This connects to a Xero **demo company**, not your real accounting!

1. **Get Xero Demo Access:**
   - Go to: https://developer.xero.com/
   - Click "Try the Demo Company"
   - Sign up or log in
   - Note your demo company credentials

2. **Connect in Provvypay:**
   - Dashboard → Settings → Integrations
   - Find "Xero" section
   - Click **"Connect to Xero"**
   - Sign in with demo company credentials
   - Authorize Provvypay
   - Select "Demo Company" from the dropdown
   - Click **"Authorize"**

✅ **Xero connected!**

---

## 💰 Step 4: Create Your First Payment Link (3 minutes)

1. Go to **Dashboard → Payment Links**
2. Click **"Create Payment Link"**
3. Fill in:
   - **Amount:** `10.00`
   - **Currency:** `USD`
   - **Description:** `Beta Test Payment #1`
4. Click **"Create"**
5. Click **"Activate"** to make it live
6. Copy the payment link URL

✅ **Payment link created!**

---

## 🧪 Step 5: Test Payments

### Test 1: Stripe Payment (5 minutes)

1. Open payment link in a **new incognito/private browser window**
2. You'll see the payment page
3. Click on **"Credit Card" / "Stripe"** option
4. Click **"Pay $10.00"**
5. You'll be redirected to Stripe checkout
6. Enter test card details:
   - **Card:** `4242 4242 4242 4242`
   - **Expiry:** `12/25`
   - **CVC:** `123`
   - **Name:** Your name
   - **Email:** Your email
7. Click **"Pay"**
8. You'll be redirected back

**Verify in Provvypay:**
- Go back to Dashboard → Payment Links
- Your payment should show **"PAID"** status
- Click on it to see details

✅ **Stripe payment works!**

### Test 2: Hedera HBAR Payment (5 minutes)

1. Create another payment link (same as Step 4)
2. Open it in a new browser window
3. Click **"Hedera" / "Cryptocurrency"** option
4. Select **"HBAR"** as the token
5. Click **"Connect Wallet"**
6. HashPack will pop up - approve the connection
7. Review the payment amount (converted to HBAR)
8. Click **"Pay with HBAR"**
9. HashPack will show transaction - click **"Confirm"**
10. Wait ~5 seconds for confirmation
11. Payment should be confirmed!

**Verify in Provvypay:**
- Check Payment Links - should show **"PAID"**
- Note it shows "HBAR" as payment method

✅ **Hedera payment works!**

### Test 3: Hedera USDC Payment (Optional)

Repeat Test 2, but:
- Select **"USDC"** instead of HBAR
- You'll need testnet USDC (ask developer to send you some)

---

## 📊 Step 6: Verify Data Display (10 minutes)

### A. Payment Links Table

**Navigate to:** Dashboard → Payment Links

**Check:**
- [ ] All your payment links are listed
- [ ] Status shows correctly (OPEN, PAID)
- [ ] Amounts display correctly
- [ ] Payment method icons show
- [ ] Can search/filter links

### B. Ledger Tab

**Navigate to:** Dashboard → Ledger

**Check:**
- [ ] Shows accounting entries for your payments
- [ ] Each payment has 2+ entries (debits and credits)
- [ ] Debits equal credits (balanced)
- [ ] Account names make sense
- [ ] Can filter by date

**Expected to see accounts like:**
- Stripe Clearing Account
- Crypto Clearing - HBAR
- Crypto Clearing - USDC
- Accounts Receivable
- Revenue

### C. Transactions Tab

**Navigate to:** Dashboard → Transactions

**Check:**
- [ ] All completed payments show here
- [ ] Transaction IDs are present
- [ ] Amounts and currencies correct
- [ ] Payment methods identified
- [ ] Timestamps make sense
- [ ] Can export to CSV

### D. Xero Sync (If Connected)

**In Provvypay:**
- Settings → Integrations → Xero
- Check sync status for each payment
- Should show "SUCCESS" or error message

**In Xero Demo Company:**
- Log in to Xero demo company
- Accounting → Invoices
- Check that invoices were created for your payments
- Verify amounts match

---

## 🐛 What to Test & Report

### Things to Try:

1. **Create multiple payment links** with different amounts
2. **Make payments** using all methods (Stripe, HBAR, USDC)
3. **Test expired links** - create a link, let it expire, try to pay
4. **Test search and filters** in all tabs
5. **Test mobile view** - use your phone
6. **Disconnect and reconnect** Xero
7. **Update merchant settings** - change default currency, etc.
8. **Export data** - try CSV exports

### What to Look For:

- ❌ **Errors or crashes** - take screenshots!
- 🤔 **Confusing UI** - what's unclear?
- 🐌 **Slow performance** - where?
- ✨ **Things that work well** - we want to know!
- 💡 **Feature suggestions** - what's missing?

### How to Report Issues:

**For each issue, provide:**

1. **What you were doing:** "I was creating a payment link..."
2. **What you expected:** "I expected to see..."
3. **What actually happened:** "Instead, I saw..."
4. **Screenshots:** Include if possible
5. **Browser & Device:** Chrome on Windows, Safari on iPhone, etc.

**Send feedback to:** `[YOUR_EMAIL_HERE]`

---

## ⚠️ Important Notes

### This is TEST MODE:
- ✅ No real money involved
- ✅ Test credit cards only
- ✅ Testnet cryptocurrency (free tokens)
- ✅ Xero demo company (not your real books)

### Security:
- 🔒 Your password is real - keep it safe
- 🔒 Your HashPack seed phrase is real - backup securely
- 🔒 Don't share your account credentials

### Getting Stuck?

**Common Issues:**

**"HashPack won't connect"**
- Check you're on TESTNET (not mainnet)
- Try refreshing the page
- Make sure HashPack extension is unlocked

**"Payment link says EXPIRED"**
- Links expire after 24 hours by default
- Create a new one

**"Don't have testnet USDC"**
- Contact the developer for testnet tokens
- HBAR tests are sufficient for now

**"Xero sync shows FAILED"**
- This might be expected in early testing
- Note the error and report it

---

## 📋 Beta Testing Checklist

Use this to track your testing:

### Account & Setup
- [ ] Created account successfully
- [ ] Verified email
- [ ] Completed organization onboarding
- [ ] Set up Hedera account ID
- [ ] Connected Xero (optional)

### Payment Link Creation
- [ ] Created a payment link
- [ ] Activated it
- [ ] Copied link URL
- [ ] Created links with different amounts
- [ ] Created link with different currency

### Payment Testing
- [ ] Completed Stripe payment
- [ ] Completed HBAR payment
- [ ] Attempted USDC payment
- [ ] Tested with multiple payment links

### Data Verification
- [ ] Verified payment links table displays correctly
- [ ] Checked ledger entries appear
- [ ] Verified transactions tab shows payments
- [ ] Confirmed Xero sync works (if connected)
- [ ] Tested search/filter functionality
- [ ] Exported CSV data

### User Experience
- [ ] Tested on desktop browser
- [ ] Tested on mobile device
- [ ] Tested in different browsers
- [ ] Found UI intuitive / confusing (note which)
- [ ] Performance acceptable

### Feedback Provided
- [ ] Sent bug reports (if any)
- [ ] Sent feature suggestions
- [ ] Sent positive feedback
- [ ] Completed beta testing survey

---

## 🎉 Thank You!

Your feedback is invaluable in making Provvypay better. Thank you for taking the time to test!

**Questions?** Contact: `[YOUR_CONTACT_INFO]`

**Found a critical bug?** Reach out immediately!

---

**Happy Testing! 🚀**

---

## Quick Reference Card

Keep this handy:

### Test Stripe Card
```
Card Number: 4242 4242 4242 4242
Expiry: 12/25
CVC: 123
```

### Hedera Testnet Resources
```
HashPack: https://www.hashpack.app/
Testnet Faucet: https://portal.hedera.com/faucet
Mirror Node: https://testnet.mirrornode.hedera.com
USDC Token ID: 0.0.429274
USDT Token ID: 0.0.429275
```

### Xero Demo
```
Portal: https://developer.xero.com/
Demo Company: Available after signup
```

### Your Beta Environment
```
URL: [PROVIDED_BY_DEVELOPER]
Support: [DEVELOPER_EMAIL]
```

---

**Version:** 1.0  
**Date:** January 7, 2026

