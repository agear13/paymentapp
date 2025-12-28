# Merchant Onboarding Guide

Welcome to Provvypay! This guide will help you get started with accepting payments via Stripe and cryptocurrency (Hedera).

---

## 📋 Quick Start Checklist

- [ ] Create your account
- [ ] Set up your organization
- [ ] Configure merchant settings
- [ ] Connect payment providers (Stripe/Hedera)
- [ ] (Optional) Connect to Xero
- [ ] Create your first payment link
- [ ] Test a payment
- [ ] Go live!

---

## Step 1: Create Your Account

1. Visit **https://app.provvypay.com**
2. Click **"Sign Up"**
3. Choose your preferred sign-up method:
   - Email & Password
   - Google OAuth
   - GitHub OAuth
4. Verify your email address
5. Complete your profile

**Time Required:** 2 minutes

---

## Step 2: Set Up Your Organization

1. After signing in, you'll be prompted to create an organization
2. Enter your **Organization Name** (e.g., "Acme Corp")
3. Click **"Create Organization"**

Your organization is the top-level entity that contains all your payment links, transactions, and settings.

**Time Required:** 1 minute

---

## Step 3: Configure Merchant Settings

Navigate to **Dashboard → Settings → Merchant**

### Required Settings

#### 1. Display Name
- This appears on payment pages
- Example: "Acme Corporation"

#### 2. Default Currency
- Choose your primary currency (USD, AUD, EUR, etc.)
- This will be the default for new payment links

#### 3. Hedera Account ID (for crypto payments)
- Format: `0.0.XXXXXX`
- This is where you'll receive cryptocurrency payments
- **Get your Hedera Account ID:**
  - Create account at [HashPack](https://www.hashpack.app/)
  - Copy your Account ID from wallet

**Time Required:** 5 minutes

---

## Step 4: Connect Payment Providers

### Option A: Stripe (Credit Card Payments)

1. Go to **Settings → Integrations**
2. Click **"Connect Stripe"**
3. Follow Stripe OAuth flow
4. Authorize Provvypay to access your Stripe account
5. Return to dashboard

**What you need:**
- Active Stripe account
- Business verification completed (for live mode)

**Time Required:** 3 minutes

### Option B: Hedera (Cryptocurrency)

Hedera payments are automatic once you've added your Hedera Account ID in Merchant Settings.

**Supported Tokens:**
- 💎 HBAR (native token)
- 💵 USDC stablecoin
- 💰 USDT stablecoin
- 🇦🇺 AUDD (Australian Dollar stablecoin)

**What you need:**
- Hedera account (from HashPack, Blade, etc.)
- Account must be associated with tokens you want to receive

**Time Required:** Already done in Step 3!

---

## Step 5: Connect to Xero (Optional but Recommended)

Automatically sync payments to your Xero accounting system.

1. Go to **Settings → Integrations**
2. Click **"Connect Xero"**
3. Log in to your Xero account
4. Select your organization
5. Authorize Provvypay
6. Configure account mappings:
   - **Revenue Account:** Where sales are recorded
   - **Receivables Account:** AR account
   - **Clearing Accounts:** One for each payment method
   - **Fee Expense Account:** Processing fees

**Time Required:** 10 minutes

**Benefits:**
- Automatic invoice creation
- Automatic payment recording
- Proper double-entry bookkeeping
- Reconciliation reports

---

## Step 6: Create Your First Payment Link

1. Go to **Dashboard → Payment Links**
2. Click **"Create Payment Link"**
3. Fill in the details:

### Required Fields

- **Amount:** The payment amount (e.g., 100.00)
- **Currency:** USD, AUD, EUR, etc.
- **Description:** What the payment is for
  - Example: "Website development services"

### Optional Fields

- **Invoice Reference:** Your internal invoice number
  - Example: "INV-001"
- **Customer Email:** For payment confirmations
- **Customer Phone:** For SMS notifications (future)
- **Expiry Date:** When the link expires
  - Default: 30 days

4. Click **"Create Payment Link"**

**Result:** You'll get a short link like `https://pay.provvypay.com/ABC12345`

**Time Required:** 2 minutes

---

## Step 7: Share the Payment Link

### Ways to Share

1. **Copy Link**
   - Click "Copy Link" button
   - Share via email, SMS, or messaging app

2. **QR Code**
   - Click "Show QR Code"
   - Customer scans with phone camera
   - Perfect for in-person payments

3. **Email**
   - Click "Send Email"
   - Enter customer email
   - Provvypay sends payment link automatically

---

## Step 8: Customer Payment Flow

### What Your Customer Sees

1. **Landing Page**
   - Your merchant name
   - Payment amount and currency
   - Payment description
   - Payment method options

2. **Payment Method Selection**
   - **Pay with Card** (via Stripe)
     - Credit/Debit cards
     - Apple Pay / Google Pay
   - **Pay with Crypto** (via Hedera)
     - Choose token: HBAR, USDC, USDT, or AUDD
     - See exact amount in crypto
     - Connect wallet and pay

3. **Confirmation**
   - Success message
   - Transaction details
   - Receipt email (if provided)

---

## Step 9: Monitor Payments

### Dashboard Overview

**Dashboard Home** shows:
- Total revenue (today, this week, this month)
- Active payment links
- Recent transactions
- Success rate

### Payment Links Page

View all payment links with:
- Status (Open, Paid, Expired)
- Amount
- Creation date
- Payment method used
- Quick actions (View, Copy, Cancel)

### Transactions Page

See detailed transaction history:
- Payment amount
- Payment method
- Token type (for crypto)
- Transaction ID
- Timestamp

---

## Step 10: Test Mode vs. Live Mode

### Test Mode (Stripe)

Use Stripe test cards:
- **Success:** `4242 4242 4242 4242`
- **Declined:** `4000 0000 0000 0002`
- Any future expiry date
- Any 3-digit CVC

### Test Mode (Hedera)

Use Hedera Testnet:
- Get testnet HBAR from faucet
- Test account: Testnet account ID
- No real money involved

### Go Live

1. Complete Stripe verification
2. Switch to production credentials
3. Use mainnet Hedera account
4. Start accepting real payments!

---

## 📊 Understanding Reports

Navigate to **Dashboard → Reports**

### Revenue Summary
- Total revenue
- Breakdown by payment method
- Percentage distribution

### Token Breakdown
Shows revenue from:
- 💳 Stripe
- ℏ HBAR
- 💵 USDC
- 💰 USDT
- 🇦🇺 AUDD

### Ledger Balance
- Current balances in clearing accounts
- Entry counts
- Account reconciliation

### Reconciliation Report
- Expected vs. actual revenue
- Variance detection
- Status indicators

---

## 🔔 Notification Settings

Configure how you receive notifications:

**Email Notifications:**
- Payment confirmations
- Payment failures
- Xero sync failures
- Weekly summaries

**In-App Notifications:**
- Bell icon in dashboard
- Real-time updates
- Unread count badge

**Manage at:** Settings → Notifications

---

## 💡 Best Practices

### 1. Use Invoice References
Always include invoice references for easier reconciliation in Xero.

### 2. Set Expiry Dates
Prevent stale payment links by setting reasonable expiry dates (7-30 days).

### 3. Include Customer Email
Enables automatic payment confirmations and better customer experience.

### 4. Monitor Failed Payments
Check Xero sync queue regularly to catch any sync failures.

### 5. Use Descriptive Descriptions
Help customers understand what they're paying for:
- ✅ "Website development - Project Alpha"
- ❌ "Payment"

### 6. Test Before Launch
Create test payment links and complete test transactions before going live.

---

## 🆘 Common Issues & Solutions

### Issue: "Xero sync failed"

**Solution:**
1. Check Xero connection status
2. Verify account mappings are correct
3. Check Xero account permissions
4. Replay sync from Admin → Queue

### Issue: "Crypto payment not detected"

**Solution:**
1. Verify transaction on HashScan
2. Check correct token was sent (HBAR, USDC, USDT, or AUDD)
3. Check amount matches exactly (within 0.1%)
4. Wait 30 seconds for mirror node update

### Issue: "Payment link expired"

**Solution:**
1. Create a new payment link
2. Or extend expiry date before it expires

### Issue: "Customer didn't receive email"

**Solution:**
1. Check spam folder
2. Verify email address is correct
3. Resend email from payment link page

---

## 📞 Getting Help

### Documentation
- API Documentation: `API_DOCUMENTATION.md`
- Xero Integration: `XERO_INTEGRATION_GUIDE.md`
- FAQ: `FAQ.md`

### Support Channels
- **Email:** support@provvypay.com
- **In-App:** Click help icon (?) in dashboard
- **Status Page:** https://status.provvypay.com

### Response Times
- **Critical issues:** 1 hour
- **General inquiries:** 24 hours
- **Feature requests:** 48 hours

---

## 🎯 Next Steps

Now that you're set up:

1. ✅ Create your first real payment link
2. ✅ Share it with a customer
3. ✅ Monitor the payment
4. ✅ Check your Xero sync (if connected)
5. ✅ Review your reports
6. ✅ Customize your notification preferences

---

## 🚀 Advanced Features

### Multi-Currency Support
Accept payments in multiple currencies with automatic FX conversion.

### Automated Xero Sync
Payments automatically create invoices and payments in Xero.

### Reconciliation Reports
Verify expected revenue matches actual ledger balances.

### Weekly Summaries
Receive email summaries of your payment activity.

### API Access
Integrate Provvypay into your own systems via REST API.

---

**Welcome to Provvypay!** 🎉

You're now ready to accept payments via credit card and cryptocurrency. If you have any questions, our support team is here to help.

---

**Last Updated:** December 16, 2025  
**Version:** 1.0





