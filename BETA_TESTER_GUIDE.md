# Provvypay Beta Testing Guide

Welcome to Provvypay beta testing! This guide will walk you through the complete setup and testing process.

---

## **🎯 What You'll Test**

As a beta tester, you'll experience the **complete merchant onboarding journey**:
1. ✅ Account creation and email verification
2. ✅ Organization setup
3. ✅ Payment method configuration (Stripe & Hedera)
4. ✅ Creating and managing payment links
5. ✅ Processing test payments
6. ✅ Xero accounting integration (optional)

---

## **📋 Prerequisites**

Before you start, you'll need:
- 📧 An email address for your account
- 💳 (Optional) Stripe test account or ability to create one
- 🔐 (Optional) HashPack wallet for Hedera testnet payments
- 📊 (Optional) Xero demo company for accounting sync

**Don't worry if you don't have these yet - we'll guide you through getting them!**

---

## **🚀 Step-by-Step Setup**

### **Step 1: Create Your Account**

1. **Go to the signup page:**
   ```
   https://provvypay-api.onrender.com
   ```

2. **Click "Sign Up"**

3. **Enter your details:**
   - Email address
   - Password (minimum 8 characters)

4. **Click "Sign Up"**

5. **Check your email for verification:**
   - Subject: "Confirm your email"
   - Click the "Confirm your email" button

6. **You'll be redirected to the onboarding page** ✅

---

### **Step 2: Complete Onboarding**

After email confirmation, you'll see the onboarding form:

1. **Organization Name:**
   - Enter your company or business name
   - Example: "Acme Corp Beta Testing"

2. **Business Display Name:**
   - This appears on payment pages and receipts
   - Example: "Acme Corporation"

3. **Default Currency:**
   - Select your primary currency (USD, AUD, EUR, etc.)
   - You can add more currencies later

4. **Click "Create Organization"**

5. **Success!** You'll be redirected to the dashboard ✅

---

### **Step 3: Configure Payment Methods**

**Important:** You won't be able to create payment links until you configure at least one payment method!

#### **Option A: Stripe (Credit/Debit Cards)**

1. **Go to Settings → Integration Settings**

2. **Stripe Account ID:**
   - For testing, you can use: `acct_test_beta`
   - Or connect your real Stripe test account

3. **Click "Save Settings"**

4. **You can now accept card payments!** ✅

**To test with real Stripe:**
- Create a free Stripe account at https://stripe.com
- Use test mode (toggle in Stripe Dashboard)
- Copy your Account ID from Settings

---

#### **Option B: Hedera (Crypto Payments)**

1. **Install HashPack Wallet:**
   - Chrome/Brave: https://chrome.google.com/webstore (search "HashPack")
   - Firefox: https://addons.mozilla.org (search "HashPack")

2. **Create a Testnet Account:**
   - Open HashPack
   - Select "Testnet" network
   - Create new account
   - **Save your recovery phrase securely!**

3. **Get Test HBAR:**
   - Go to: https://portal.hedera.com/faucet
   - Enter your testnet account ID (format: `0.0.12345`)
   - Request test HBAR (free!)

4. **Configure in Provvypay:**
   - Go to Settings → Integration Settings
   - Enter your Hedera Account ID (format: `0.0.12345`)
   - Click "Save Settings"

5. **You can now accept crypto payments!** ✅

---

### **Step 4: Create Your First Payment Link**

1. **Go to Dashboard → Payment Links**

2. **Click "Create Link"**

3. **Fill in the details:**
   - **Amount:** 10.00 (or any amount)
   - **Currency:** USD (or your default)
   - **Description:** "Test Invoice #1"
   - **Customer Email:** (optional) your email for testing
   - **Customer Name:** (optional) "Test Customer"
   - **Due Date:** (optional) tomorrow's date
   - **Invoice Reference:** (optional) "INV-001"

4. **Click "Create Payment Link"**

5. **Success!** Your payment link appears in the table ✅

---

### **Step 5: Test a Payment**

#### **Test with Stripe (Credit Card)**

1. **Click on your payment link** (or copy the link and open in new tab)

2. **The payment page should show:**
   - Your business name
   - Amount and currency
   - Payment options (Stripe should be enabled)

3. **Click "Pay with Card"**

4. **Enter Stripe test card details:**
   - **Card number:** `4242 4242 4242 4242`
   - **Expiry:** Any future date (e.g., `12/26`)
   - **CVC:** Any 3 digits (e.g., `123`)
   - **Name:** Any name
   - **Email:** Your email

5. **Click "Pay"**

6. **Payment should process successfully!**

7. **Check the dashboard:**
   - Payment link status should be "PAID" ✅
   - Transaction should appear in Transactions tab ✅
   - Ledger entries should be created ✅

---

#### **Test with Hedera (Crypto)**

1. **Open your payment link**

2. **Click "Pay with Hedera"**

3. **Select Token:**
   - HBAR (testnet)
   - Amount will be calculated

4. **Click "Pay with HashPack"**

5. **HashPack wallet will open:**
   - Review the transaction
   - **Make sure you're on TESTNET!**
   - Click "Approve"

6. **Wait for confirmation** (~3-5 seconds)

7. **Payment confirmed!**

8. **Check the dashboard:**
   - Payment link status should be "PAID" ✅
   - Transaction shows Hedera payment ✅

---

### **Step 6: Xero Integration (Optional)**

**Note:** This is optional but highly recommended for testing the complete accounting workflow!

#### **Setup Xero Demo Company**

1. **Create free Xero account:**
   - Go to: https://www.xero.com/signup/
   - Select "Try Xero for free"
   - Use your email address

2. **Create Demo Company:**
   - Xero will offer to create a demo company with sample data
   - This is perfect for testing!

3. **Connect to Provvypay:**
   - Go to Settings → Integration Settings
   - Click "Connect to Xero"
   - Authorize Provvypay
   - Select your demo company

4. **Configure Account Mappings:**
   - Revenue Account: "Sales" (or similar)
   - Receivable Account: "Accounts Receivable"
   - Stripe Clearing: "Stripe Clearing Account" (create if needed)
   - Hedera Clearing: "Crypto Clearing Account" (create if needed)

5. **Save Settings**

#### **Test Xero Sync**

1. **Create and pay a payment link** (as in Step 5)

2. **Go to Xero Sync tab in Provvypay**

3. **Click "Sync to Xero"** (or it may auto-sync)

4. **Check Xero:**
   - Open your Xero demo company
   - Go to Accounting → Invoices
   - You should see your payment synced! ✅

---

## **🧪 Testing Checklist**

Use this checklist to ensure you've tested all key features:

### **Account & Setup**
- [ ] Sign up with email
- [ ] Receive and confirm verification email
- [ ] Complete onboarding form
- [ ] Access dashboard successfully

### **Payment Configuration**
- [ ] Configure Stripe account ID
- [ ] (Optional) Configure Hedera account ID
- [ ] Save integration settings

### **Payment Links**
- [ ] Create payment link with all fields
- [ ] View payment link in dashboard
- [ ] Open payment link in browser
- [ ] See correct payment methods displayed

### **Stripe Payments**
- [ ] Pay with Stripe test card
- [ ] See payment confirmed
- [ ] Check payment status updates to PAID
- [ ] Verify transaction appears in Transactions tab
- [ ] Check ledger entries created

### **Hedera Payments (if configured)**
- [ ] Pay with HashPack wallet
- [ ] See payment confirmed
- [ ] Check payment status updates to PAID
- [ ] Verify Hedera transaction

### **Xero Integration (if configured)**
- [ ] Connect Xero account
- [ ] Configure account mappings
- [ ] Sync paid invoice to Xero
- [ ] Verify invoice appears in Xero

### **Error Handling**
- [ ] Try creating payment link without payment methods (should fail gracefully)
- [ ] Try invalid payment details
- [ ] Check error messages are clear

---

## **🐛 What to Report**

As a beta tester, please report:

### **Critical Issues**
- ❌ Cannot sign up or log in
- ❌ Cannot create payment links
- ❌ Payments not processing
- ❌ Dashboard not loading

### **Important Issues**
- ⚠️ Confusing UI/UX
- ⚠️ Unclear error messages
- ⚠️ Missing features or functionality
- ⚠️ Slow performance

### **Nice to Have**
- 💡 Feature suggestions
- 💡 UI/UX improvements
- 💡 Documentation gaps

### **How to Report**
For each issue, please include:
1. **What you were trying to do**
2. **What you expected to happen**
3. **What actually happened**
4. **Steps to reproduce**
5. **Screenshots (if applicable)**

---

## **💳 Test Card Numbers (Stripe)**

Use these test cards for different scenarios:

### **Successful Payments**
- **Standard:** `4242 4242 4242 4242`
- **3D Secure:** `4000 0027 6000 3184`
- **Mastercard:** `5555 5555 5555 4444`

### **Failed Payments**
- **Declined:** `4000 0000 0000 0002`
- **Insufficient funds:** `4000 0000 0000 9995`
- **Expired card:** `4000 0000 0000 0069`

**All test cards:**
- Expiry: Any future date
- CVC: Any 3 digits
- Postal code: Any valid format

---

## **🔐 Security Notes**

- ✅ This is a **BETA environment** on testnet/test mode
- ✅ Use **test data only** - no real money or real accounts
- ✅ Stripe is in **test mode** - no real charges
- ✅ Hedera is on **testnet** - test HBAR has no value
- ✅ Xero should use a **demo company** - not your real books

**Never use real:**
- Bank accounts
- Credit cards
- Production Xero accounts
- Sensitive customer data

---

## **❓ FAQ**

### **Q: I didn't receive the verification email**
**A:** Check your spam folder. If still not there, try signing up again or contact support.

### **Q: Can I test without Stripe/Hedera?**
**A:** You need at least one payment method configured. Stripe test mode is easiest to set up.

### **Q: Do I need a real Stripe account?**
**A:** No! You can use the test account ID `acct_test_beta` for basic testing.

### **Q: How do I get test HBAR?**
**A:** Use the Hedera faucet at https://portal.hedera.com/faucet (free, no signup required).

### **Q: Is my data safe?**
**A:** Yes! This is a test environment. All data is isolated and can be deleted at any time.

### **Q: Can I invite team members?**
**A:** Not yet - this feature is coming soon!

### **Q: What if I find a bug?**
**A:** Great! That's what beta testing is for. Report it with details (see "What to Report" section).

---

## **🎉 Thank You!**

Your feedback is invaluable in making Provvypay better for all merchants. Happy testing!

---

## **📞 Support**

If you need help or have questions:
- **Email:** alishajayne13@gmail.com
- **Report Issues:** Include screenshots and detailed steps

---

**Last Updated:** January 20, 2026
**Environment:** Beta Testing (Render)
**Version:** 1.0-beta

