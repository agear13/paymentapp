# 🔴 LIVE WEBHOOK TROUBLESHOOTING

**Issue:** Payment completed but invoice not updating to PAID

---

## 🔍 Step-by-Step Diagnosis

### Step 1: Verify Render Deployment Completed

After changing the environment variable:

1. Go to **Render Dashboard** → Your Service → **Events**
2. Check if the most recent deployment shows **"Live"** (green)
3. If it says "Deploying" or "Failed", wait or check errors

**⏱️ Deployments take 2-3 minutes**

---

### Step 2: Check Render Logs (MOST IMPORTANT)

1. Go to **Render Dashboard** → Your Service → **Logs**
2. Look for recent webhook activity

**What to look for:**

#### ✅ **GOOD - Webhook is working:**
```
[INFO] Processing Stripe webhook event - eventType: payment_intent.succeeded
[INFO] Payment confirmed via Stripe
[INFO] Webhook event processed successfully
```

#### ❌ **STILL DISABLED:**
```
[WARN] Stripe webhook disabled - skipping verification and processing
```
**Fix:** Environment variable still shows "disabled" - redeploy or wait

#### ❌ **INVALID SIGNATURE:**
```
[ERROR] Invalid webhook signature
[ERROR] Webhook signature verification failed
```
**Fix:** Wrong webhook secret - double-check the secret from Stripe

#### ⚠️ **NO WEBHOOK LOGS AT ALL:**
This means Stripe isn't sending webhooks!
**Fix:** Webhook not configured in Stripe Dashboard (see Step 3)

---

### Step 3: Verify Webhook in Stripe Dashboard

1. Go to https://dashboard.stripe.com/webhooks
2. Ensure you're in correct mode (TEST/LIVE)
3. Check if your endpoint exists:
   ```
   https://your-app-name.onrender.com/api/stripe/webhook
   ```

4. Click on the endpoint
5. Check **"Recent deliveries"** section

**What you should see:**

#### ✅ **GOOD:**
- Recent delivery with your payment
- Status: **200 OK** (green checkmark)

#### ❌ **BAD - 401 Unauthorized:**
- Wrong webhook secret
- Get the correct secret from this page
- Update in Render

#### ❌ **BAD - 404 Not Found:**
- Wrong URL
- Should be: `https://[your-app].onrender.com/api/stripe/webhook`
- Edit endpoint URL

#### ❌ **BAD - 500 Error:**
- Application error
- Check Render logs for error details

#### ⚠️ **NO RECENT DELIVERIES:**
- Webhook might not be configured to receive the right events
- Click endpoint → **Edit** → Ensure these events are selected:
  - `payment_intent.succeeded`
  - `checkout.session.completed`

---

### Step 4: Test Webhook Delivery

**Manual Test from Stripe:**

1. Go to Stripe Dashboard → Webhooks → Your endpoint
2. Click **"Send test webhook"**
3. Select: `payment_intent.succeeded`
4. Click **"Send test webhook"**
5. Check response:
   - ✅ Should be **200 OK**
   - ❌ If 401/400/500, see error message

**Check Render Logs immediately after:**
- Should see: "Processing Stripe webhook event"

---

### Step 5: Check Payment Link Metadata

The webhook needs the payment link ID in metadata.

**Check in Stripe Dashboard:**

1. Go to **Payments** → Find your recent payment
2. Click on the payment
3. Scroll to **"Metadata"** section
4. Should see: `paymentLinkId: xxx-xxx-xxx`

**If metadata is MISSING:**
- This is a bug in the checkout creation
- Webhook will receive event but can't update payment link
- Check logs for: "Payment link ID missing from PaymentIntent metadata"

---

## 🔧 Quick Fixes by Symptom

### Symptom: "Webhook disabled" in logs
**Fix:**
```bash
# Render Environment Variable should be:
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# NOT:
STRIPE_WEBHOOK_SECRET=disabled
```

### Symptom: "Invalid signature" in logs
**Fix:**
1. Get correct secret from Stripe Dashboard
2. Must start with `whsec_`
3. No extra spaces
4. Update in Render and redeploy

### Symptom: No webhook logs at all
**Fix:**
1. Create webhook endpoint in Stripe
2. URL: `https://[your-app].onrender.com/api/stripe/webhook`
3. Events: `payment_intent.succeeded`, `checkout.session.completed`

### Symptom: "Payment link ID missing" in logs
**Fix:**
- Checkout session creation is missing metadata
- Need to check `src/app/api/stripe/create-checkout-session/route.ts`

---

## 🧪 Verification Checklist

Check ALL of these:

- [ ] Render deployment is "Live" (not deploying)
- [ ] `STRIPE_WEBHOOK_SECRET` is NOT "disabled"
- [ ] `STRIPE_WEBHOOK_SECRET` starts with `whsec_`
- [ ] Webhook endpoint exists in Stripe Dashboard
- [ ] Webhook URL is correct (matches your Render app)
- [ ] Webhook events include `payment_intent.succeeded`
- [ ] Test webhook from Stripe returns 200 OK
- [ ] Recent deliveries show in Stripe Dashboard
- [ ] Render logs show "Processing Stripe webhook event"
- [ ] Payment includes `paymentLinkId` in metadata

---

## 📞 Next Steps

1. **Check Render Logs RIGHT NOW**
   - What do you see after the payment?
   - Copy any error messages

2. **Check Stripe Dashboard → Webhooks → Recent deliveries**
   - Is your payment there?
   - What status code?

3. **Send Test Webhook**
   - Does it return 200 OK?
   - What appears in Render logs?

**Report back with:**
- What you see in Render logs
- What you see in Stripe webhook deliveries
- Any error messages

This will help identify the exact issue!

