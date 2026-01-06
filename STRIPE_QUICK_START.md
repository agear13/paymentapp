# ⚡ Stripe Webhook - Quick Start Guide

**Status:** ✅ Production Ready | **Time to Test:** 5 minutes

---

## 🎯 What You Have

Your Stripe webhook integration is **100% complete and production-ready**:
- ✅ Webhook route with signature verification
- ✅ Payment confirmation with database updates
- ✅ Ledger entries with double-entry accounting
- ✅ UI displays in Transactions and Ledger tabs
- ✅ Idempotency protection (safe for retries)

**Today's change:** Added `export const runtime = 'nodejs'` to webhook route.

---

## 🚀 Test Locally (5 minutes)

### Step 1: Install Stripe CLI

**Windows:**
```powershell
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
```

**macOS:**
```bash
brew install stripe/stripe-cli/stripe
```

### Step 2: Login to Stripe
```bash
stripe login
```

### Step 3: Configure Environment

Add to `src/.env.local`:
```bash
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_FROM_STEP_4_BELOW
```

Get keys from: https://dashboard.stripe.com/test/apikeys

### Step 4: Start Dev Server & Webhook Listener

**Terminal 1:**
```bash
cd src
npm run dev
```

**Terminal 2:**
```bash
stripe listen --forward-to http://localhost:3000/api/stripe/webhook
# Copy the whsec_... secret, add to .env.local, restart Terminal 1
```

### Step 5: Test with Script

**Windows:**
```powershell
.\scripts\test-stripe-webhook.ps1
# Select option 5 (Run all test events)
```

**macOS/Linux:**
```bash
./scripts/test-stripe-webhook.sh
# Select option 5 (Run all test events)
```

### Step 6: Verify

1. **Check Terminal 1** for webhook processing logs:
   ```
   [INFO] Webhook signature verified
   [INFO] Payment confirmed via Stripe
   [INFO] Stripe settlement posted to ledger
   ```

2. **Check Transactions Tab**  
   http://localhost:3000/dashboard/transactions → Click "Stripe" tab

3. **Check Ledger Tab**  
   http://localhost:3000/dashboard/ledger → Click "Entries" tab

**Done!** ✅ Your Stripe webhooks are working.

---

## 🌐 Deploy to Production

### Step 1: Create Production Webhook

1. Go to https://dashboard.stripe.com/webhooks
2. **Switch to LIVE mode** (toggle in top-right)
3. Click "Add endpoint"
4. URL: `https://your-app.onrender.com/api/stripe/webhook`
5. Select events:
   - payment_intent.succeeded
   - payment_intent.payment_failed
   - checkout.session.completed
6. Click "Add endpoint"
7. **Copy webhook signing secret** (whsec_...)

### Step 2: Configure Render

Render Dashboard → Your Service → Environment:
```bash
STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
```

### Step 3: Test

1. Stripe Dashboard → Webhooks → Your endpoint
2. Click "Send test webhook"
3. Select "payment_intent.succeeded"
4. Verify response is 200 OK
5. Check Render logs for: "Webhook event processed successfully"

**Done!** ✅ Your production webhooks are live.

---

## 📋 Environment Variables

### Required Variables

| Variable | Example | Where to Get |
|----------|---------|--------------|
| `STRIPE_SECRET_KEY` | `sk_test_...` or `sk_live_...` | Stripe Dashboard → API Keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` or `pk_live_...` | Stripe Dashboard → API Keys |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Stripe CLI listener or Dashboard |

### Test vs Live

**Local/Testing:**
- Use `sk_test_...` and `pk_test_...` keys
- Use `whsec_...` from `stripe listen` command

**Production:**
- Use `sk_live_...` and `pk_live_...` keys (switch to LIVE mode in dashboard)
- Use `whsec_...` from production webhook endpoint

---

## 🔍 Troubleshooting

### Webhook returns 401 Unauthorized
- Copy correct secret from webhook listener or Stripe Dashboard
- Update `.env.local` (local) or Render environment (production)
- **Restart dev server** (local) or redeploy (production)

### Payment not showing in Transactions tab
- Check logs for "Payment confirmed via Stripe"
- Verify metadata includes `payment_link_id`
- Refresh browser (Cmd/Ctrl + R)

### Ledger entries missing
- Check logs for "Stripe settlement posted to ledger"
- Query database: `SELECT * FROM ledger_entries WHERE idempotency_key LIKE 'stripe-%';`
- Verify ledger accounts exist (should be auto-created)

---

## 📚 Full Documentation

- **`STRIPE_INTEGRATION_SUMMARY.md`** - Complete integration guide
- **`STRIPE_WEBHOOK_PRODUCTION_READY.md`** - Production deployment details
- **`STRIPE_WEBHOOK_SETUP.md`** - Detailed setup instructions
- **`RENDER_ENV_VARIABLES.md`** - All environment variables

---

## ✅ Checklist

**Local Testing:**
- [ ] Stripe CLI installed
- [ ] Logged in to Stripe (`stripe login`)
- [ ] Environment variables configured in `.env.local`
- [ ] Dev server running (`npm run dev`)
- [ ] Webhook listener running (`stripe listen`)
- [ ] Test events triggered and successful
- [ ] Transactions appear in UI
- [ ] Ledger entries created

**Production Deployment:**
- [ ] Production webhook created in Stripe Dashboard (LIVE mode)
- [ ] Webhook secret copied
- [ ] Environment variables set in Render (LIVE keys)
- [ ] Application deployed
- [ ] Test webhook sent from Stripe Dashboard
- [ ] Response is 200 OK
- [ ] Logs show successful processing

---

## 🎉 You're Ready!

Your Stripe webhook integration is production-ready. Just follow the steps above to test locally, then deploy to production.

**Questions?** Check the full documentation in `STRIPE_INTEGRATION_SUMMARY.md`.

**Happy coding! 🚀**

