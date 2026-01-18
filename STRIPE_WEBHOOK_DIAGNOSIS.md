# 🔍 Stripe Webhook Diagnosis & Fix

**Issue:** Stripe payments work but invoice doesn't update to PAID after payment

**Root Cause:** Webhook is not configured or environment variable is missing

---

## ✅ Quick Diagnosis Checklist

### 1. Check Environment Variable

**Required:** `STRIPE_WEBHOOK_SECRET=whsec_xxxxx`

**Check your environment:**

```bash
# If running locally
echo $STRIPE_WEBHOOK_SECRET

# If deployed on Render
# Go to: Render Dashboard → Your Service → Environment
# Look for: STRIPE_WEBHOOK_SECRET
```

**Critical:** If this variable is:
- ❌ Missing
- ❌ Set to "disabled"  
- ❌ Empty

Then webhooks will **NOT** be processed!

---

## 🔧 Fix: Setup Stripe Webhook

### For Production (Render Deployment)

#### Step 1: Create Webhook in Stripe Dashboard

1. Go to https://dashboard.stripe.com/webhooks
2. Ensure you're in **TEST MODE** (toggle in top right) for testing
3. Click **"+ Add endpoint"**
4. Enter your webhook URL:
   ```
   https://your-app-name.onrender.com/api/stripe/webhook
   ```
5. Select events to listen for:
   - ✅ `checkout.session.completed`
   - ✅ `checkout.session.expired`
   - ✅ `payment_intent.succeeded`
   - ✅ `payment_intent.payment_failed`
   - ✅ `payment_intent.canceled`

6. Click **"Add endpoint"**
7. Click **"Reveal"** under "Signing secret"
8. Copy the secret (starts with `whsec_`)

#### Step 2: Add to Render Environment

1. Go to Render Dashboard → Your Service → Environment
2. Click **"Add Environment Variable"**
3. Key: `STRIPE_WEBHOOK_SECRET`
4. Value: `whsec_xxxxx` (paste the secret from Step 1)
5. Click **"Save Changes"**

Render will automatically redeploy with the new variable.

---

### For Local Development

#### Step 1: Install Stripe CLI

**Windows (PowerShell as Admin):**
```powershell
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
```

**Mac:**
```bash
brew install stripe/stripe-cli/stripe
```

#### Step 2: Authenticate

```bash
stripe login
```

Follow the prompts to authenticate with your Stripe account.

#### Step 3: Listen for Webhooks

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

This will output a webhook signing secret like:
```
Ready! Your webhook signing secret is whsec_xxxxx
```

#### Step 4: Add to .env.local

Create or edit `.env.local` in project root:

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

#### Step 5: Restart Dev Server

```bash
# Stop current server (Ctrl+C)
npm run dev
```

---

## 🧪 Test the Webhook

### Test in Production

1. Go to Stripe Dashboard → Webhooks
2. Click on your webhook endpoint
3. Click **"Send test webhook"**
4. Select `payment_intent.succeeded`
5. Click **"Send test webhook"**
6. Check response status: should be **200 OK**

### Check Logs (Render)

1. Go to Render Dashboard → Your Service → Logs
2. Look for:
   ```
   [INFO] Processing Stripe webhook event - eventType: payment_intent.succeeded
   [INFO] Payment confirmed via Stripe
   [INFO] Webhook event processed successfully
   ```

### Test End-to-End

1. Create a test payment link
2. Complete payment with test card: `4242 4242 4242 4242`
3. After payment, check:
   - ✅ Payment link status → `PAID`
   - ✅ Success page displayed
   - ✅ Payment event recorded

---

## 🐛 Troubleshooting

### Issue: Webhook returns 401 (Unauthorized)

**Cause:** Invalid webhook signature

**Fix:**
1. Ensure `STRIPE_WEBHOOK_SECRET` matches the one from Stripe Dashboard
2. No extra spaces or quotes
3. Starts with `whsec_`

### Issue: Webhook returns 200 but doesn't update status

**Check logs for:**
```
"Stripe webhook disabled - skipping verification and processing"
```

**Fix:** Add or update `STRIPE_WEBHOOK_SECRET` environment variable

### Issue: Payment link ID missing from metadata

**Check logs for:**
```
"Payment link ID missing from PaymentIntent metadata"
```

**Cause:** Payment created without proper metadata

**Fix:** Ensure checkout session includes:
```javascript
metadata: {
  paymentLinkId: 'your-payment-link-id'
}
```

---

## 📊 Verification Steps

After setup, verify everything works:

1. **Check Environment Variable**
   ```bash
   # In Render logs, look for startup logs
   # Should NOT see: "Stripe webhook disabled"
   ```

2. **Test Webhook Delivery**
   - Send test webhook from Stripe Dashboard
   - Check for 200 OK response
   - Verify logs show event processed

3. **Test Real Payment**
   - Create payment link
   - Complete test payment
   - Verify status changes to PAID
   - Check payment events table

4. **Monitor Webhook Dashboard**
   - Go to Stripe Dashboard → Webhooks
   - Check "Recent deliveries"
   - All should show green checkmarks (200 OK)

---

## 🚀 Quick Fix Summary

If webhook is not working:

1. ✅ Add `STRIPE_WEBHOOK_SECRET` to Render environment
2. ✅ Create webhook endpoint in Stripe Dashboard
3. ✅ Copy signing secret from Stripe
4. ✅ Update Render environment variable
5. ✅ Wait for automatic redeploy
6. ✅ Test with send test webhook
7. ✅ Verify with real payment

**Time to fix:** ~5 minutes

---

## 📞 Need Help?

If webhook still not working after following this guide:

1. Check Render logs for error messages
2. Check Stripe Dashboard → Webhooks → Recent deliveries for error details
3. Verify webhook URL is correct (check for typos)
4. Ensure application is deployed and accessible
5. Try sending test webhook from Stripe Dashboard

---

## 📝 Current Webhook Configuration

**Endpoint:** `/api/stripe/webhook`  
**Method:** `POST`  
**Authentication:** Stripe signature verification  
**Events Handled:**
- `payment_intent.succeeded` → Updates to PAID
- `payment_intent.payment_failed` → Records failure
- `payment_intent.canceled` → Records cancellation
- `checkout.session.completed` → Updates to PAID
- `checkout.session.expired` → Logs expiration

**Code Location:** `src/app/api/stripe/webhook/route.ts`

The webhook handler is fully implemented and production-ready. It just needs the proper configuration!

