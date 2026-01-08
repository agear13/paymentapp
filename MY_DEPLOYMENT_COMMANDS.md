# 🚀 Your Personalized Deployment Commands

**Your Email:** alishajayne13@gmail.com  
**Timeline:** This week  
**Estimated Time:** 45-60 minutes

---

## 📋 **QUICK DEPLOYMENT CHECKLIST**

Copy and paste these commands directly!

---

### **STEP 1: Database Migration** (2 minutes)

```bash
# Connect to your beta database
psql $DATABASE_URL

# Run migration
\i prisma/migrations/add_idempotency_constraints.sql

# Verify (should see new columns)
\d payment_events

# Exit
\q
```

**Alternative (if file path doesn't work):**
```bash
# Copy and paste the SQL directly
psql $DATABASE_URL <<EOF
$(cat prisma/migrations/add_idempotency_constraints.sql)
EOF
```

---

### **STEP 2: Environment Variables for Render** (10 minutes)

Go to: **Render Dashboard → Your Service → Environment → Add Environment Variable**

#### **🔴 CRITICAL - Your Admin Email:**
```bash
ADMIN_EMAIL_ALLOWLIST=alishajayne13@gmail.com
```

#### **🔴 CRITICAL - Test/Testnet Mode:**
```bash
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
NEXT_PUBLIC_HEDERA_NETWORK=testnet
```

#### **🔴 CRITICAL - Render URLs:**
```bash
# Replace YOUR_SERVICE_NAME with your actual Render service name
NEXT_PUBLIC_APP_URL=https://YOUR_SERVICE_NAME.onrender.com
XERO_REDIRECT_URI=https://YOUR_SERVICE_NAME.onrender.com/api/xero/callback
```

#### **Feature Flags (Confirmed):**
```bash
ENABLE_HEDERA_STABLECOINS=false
ENABLE_BETA_OPS=true
ENABLE_XERO_SYNC=true
```

#### **All Other Variables:**
See `beta-env-template.txt` for complete list

---

### **STEP 3: Stripe Webhook Setup** (5 minutes)

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. **Endpoint URL:**
   ```
   https://YOUR_SERVICE_NAME.onrender.com/api/stripe/webhook
   ```
4. **Select events:**
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
5. Click "Add endpoint"
6. **Copy the webhook signing secret** (starts with `whsec_`)
7. Add to Render as `STRIPE_WEBHOOK_SECRET`

---

### **STEP 4: Xero OAuth Setup** (3 minutes)

1. Go to: https://developer.xero.com/
2. My Apps → Edit your developer app
3. **OAuth 2.0 redirect URIs:**
   ```
   https://YOUR_SERVICE_NAME.onrender.com/api/xero/callback
   ```
4. Save

---

### **STEP 5: Create Beta User** (2 minutes)

**Option A: Run locally against beta database:**
```bash
# Set your beta database URL
export DATABASE_URL="your-beta-database-url-here"

# Run script
npx tsx scripts/setup-beta-user.ts \
  --email beta@example.com \
  --name "Beta Tester" \
  --with-links
```

**Option B: Run on Render Shell:**
```bash
# Go to: Render Dashboard → Your Service → Shell
# Then paste:
npx tsx scripts/setup-beta-user.ts \
  --email beta@example.com \
  --name "Beta Tester" \
  --with-links
```

---

### **STEP 6: Verify Deployment** (10 minutes)

```bash
# 1. Check homepage
curl https://YOUR_SERVICE_NAME.onrender.com

# 2. Test sign up
# Go to: https://YOUR_SERVICE_NAME.onrender.com/auth/login
# Click "Sign Up"

# 3. Test beta ops panel (with YOUR email)
# Go to: https://YOUR_SERVICE_NAME.onrender.com/admin/beta-ops
# Should see admin dashboard
```

---

### **STEP 7: Test Payments** (15 minutes)

#### **Stripe Test Payment:**
```
Test Card: 4242 4242 4242 4242
Expiry: 12/25
CVC: 123
```

#### **Hedera Test Payment:**
1. Install HashPack: https://www.hashpack.app/
2. Switch to TESTNET
3. Get HBAR: https://portal.hedera.com/faucet
4. Copy your Hedera Account ID
5. Add to Settings → Merchant in Provvypay
6. Make test payment

---

## 🎯 **YOUR QUICK CHECKLIST**

- [ ] Database migration run
- [ ] Environment variables configured
- [ ] ADMIN_EMAIL_ALLOWLIST=alishajayne13@gmail.com added
- [ ] Stripe webhook configured
- [ ] Xero redirect URI updated
- [ ] Beta user created
- [ ] Sign up works
- [ ] Stripe test payment works
- [ ] Hedera test payment works
- [ ] Beta ops panel accessible at /admin/beta-ops
- [ ] Ready to invite beta tester!

---

## 🔗 **YOUR LINKS**

**Beta Environment:**
```
https://YOUR_SERVICE_NAME.onrender.com
```

**Beta Ops Panel (Your Admin Access):**
```
https://YOUR_SERVICE_NAME.onrender.com/admin/beta-ops
```

**Stripe Webhook URL:**
```
https://YOUR_SERVICE_NAME.onrender.com/api/stripe/webhook
```

**Xero Redirect URI:**
```
https://YOUR_SERVICE_NAME.onrender.com/api/xero/callback
```

---

## 📧 **BETA TESTER INVITATION EMAIL**

```
Subject: Welcome to Provvypay Beta Testing!

Hi [Beta Tester Name],

Your beta testing environment is ready! 🎉

🌐 Beta Environment:
https://YOUR_SERVICE_NAME.onrender.com

📚 Quick Start Guide:
[Attach BETA_TESTER_QUICK_START.md]

🔧 What to Test:
• Account creation and onboarding
• Payment link creation  
• Stripe test payments (card: 4242 4242 4242 4242)
• Hedera testnet payments (HBAR)
• Data display in all tabs
• Xero integration (optional)

⏱️ Time Needed: ~1-2 hours

📝 Feedback: alishajayne13@gmail.com

🆘 Resources:
• Testnet HBAR: https://portal.hedera.com/faucet
• HashPack Wallet: https://www.hashpack.app/
• Xero Demo: https://developer.xero.com/

Thank you! 🙏

Best regards,
[Your Name]
```

---

## 🐛 **QUICK TROUBLESHOOTING**

**Webhook not working?**
```bash
# Check Render logs
# Render Dashboard → Your Service → Logs → Enable "Live tail"
# Look for: "Processing Stripe webhook event"
```

**Beta ops panel says "Not authorized"?**
```bash
# Verify in Render:
ADMIN_EMAIL_ALLOWLIST=alishajayne13@gmail.com
ENABLE_BETA_OPS=true

# Make sure you're signed in with: alishajayne13@gmail.com
```

**Hedera payment not detecting?**
```bash
# Verify:
NEXT_PUBLIC_HEDERA_NETWORK=testnet

# Check HashPack is on TESTNET (not mainnet)
```

---

## 📊 **MONITORING YOUR BETA**

**Check daily:**
1. **Beta Ops Panel:** https://YOUR_SERVICE_NAME.onrender.com/admin/beta-ops
2. **Render Logs:** Dashboard → Service → Logs
3. **Database:** Check recent payment_events

**Look for:**
- Correlation IDs in logs ✅
- Webhook events in ops panel ✅
- Payments showing in all tabs ✅
- No duplicate payments ✅

---

## ✅ **YOU'RE ALL SET!**

**Total Time:** 45-60 minutes  
**Your Admin Email:** alishajayne13@gmail.com  
**Timeline:** This week

**Start with Step 1 and work through sequentially.**

**Need help?** Check `FINAL_DEPLOYMENT_GUIDE.md` for detailed instructions.

**Good luck! 🚀**

---

**Remember to replace `YOUR_SERVICE_NAME` with your actual Render service name throughout!**

