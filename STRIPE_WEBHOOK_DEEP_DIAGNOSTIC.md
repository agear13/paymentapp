# 🔬 Deep Stripe Webhook Diagnostic

**Situation:**
- ✅ Events configured: payment_intent.succeeded, checkout.session.completed, etc.
- ✅ Payment goes through successfully
- ❌ NO webhook deliveries showing in Stripe
- ❌ Invoice not updating to PAID

This suggests a mismatch between where payments are being processed and where webhooks are configured.

---

## 🎯 Critical Check: Stripe Account Mismatch

### Problem: Different Stripe Accounts

You might have:
- Webhook configured on **Account A**
- But payments processing through **Account B**

### How to Check:

#### 1. Find Your Recent Payment

1. Go to https://dashboard.stripe.com/test/payments
2. **Verify you're in TEST mode** (top right should say "Viewing test data")
3. Find your most recent payment
4. Click on it

**Questions:**
- ✅ **Do you see your payment there?**
  - If YES → Continue below
  - If NO → You might be in the wrong mode or wrong account

#### 2. Check the Payment Intent Event

On the payment details page:
1. Scroll down to **"Events and logs"** section
2. Look for `payment_intent.succeeded` event
3. Click on it

**Key Question:**
- Does the event show a webhook icon or webhook delivery status?
- Does it say "Sent to 1 endpoint" or "No webhooks configured"?

#### 3. Get the API Key from Payment

In the payment details:
1. Look at the top right corner
2. You should see which API key was used
3. Does it match your `STRIPE_SECRET_KEY` in Render?

---

## 🔍 Check Webhook Endpoint Details

### Verify Webhook Account

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click on your webhook endpoint
3. At the top of the page, verify:
   - Is this in TEST mode?
   - What account name is shown?

### Check Recent Payments List

In the webhook page:
1. Scroll down past "Recent deliveries"
2. Click **"View logs"** or **"Testing"** tab
3. Try sending a test webhook again
4. Check the response

### Verify Endpoint URL

**CRITICAL:** Is the webhook URL EXACTLY:
```
https://provvypay-api.onrender.com/api/stripe/webhook
```

Common mistakes:
- Wrong domain
- Missing `/api/stripe/webhook`
- Extra characters or spaces
- HTTP instead of HTTPS

---

## 🧪 Test Payment Intent Directly

Let's verify your payment is creating the right events:

1. Go to your most recent payment in Stripe
2. Click the "Events and logs" tab
3. Find `payment_intent.succeeded`
4. **What's the status?**
   - "Webhook sent" → Good, but where?
   - "No webhooks sent" → Events might not be triggering webhooks
   - Nothing → Payment might not have succeeded

---

## 🔐 Verify Stripe Keys Match

### Check Your App's Stripe Keys

1. **In Render Environment**, check:
   - `STRIPE_SECRET_KEY` - should be `sk_test_...`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - should be `pk_test_...`

2. **In Stripe Dashboard:**
   - Go to https://dashboard.stripe.com/test/apikeys
   - Compare the publishable key
   - Do they match?

### Potential Issue: Using Wrong Keys

If your app uses `pk_test_ABC` but webhook is configured under `pk_test_XYZ`:
- Payments go to account ABC
- Webhook configured for account XYZ
- Webhook never fires because they're different accounts

---

## 🔄 Check Checkout Session vs Payment Intent

### Which flow are you using?

Look at your recent payment in Stripe:

**If it's a Checkout Session:**
- The webhook should receive `checkout.session.completed`
- Also creates a `payment_intent.succeeded`
- Check which event is being sent to webhook

**If it's a Payment Intent:**
- The webhook should receive `payment_intent.succeeded` only
- This is the direct payment flow

### Check Event Ordering

Sometimes events fire in this order:
1. `payment_intent.succeeded` (first)
2. `checkout.session.completed` (second)

If webhook is slow, it might miss the first event.

---

## 🚨 Possible Issues & Solutions

### Issue 1: Webhook Disabled at Stripe Level

**Check:**
1. In webhook details, look for "Status"
2. Is it "Enabled" or "Disabled"?

**Fix:**
- If disabled, click "Enable"

### Issue 2: Webhook Endpoint URL Wrong

**Check:**
- Copy the webhook URL from Stripe
- Paste in browser: `YOUR_WEBHOOK_URL` (remove /webhook)
- Does your app load?

**Fix:**
- Update webhook URL to correct Render domain

### Issue 3: Using Live Mode Keys with Test Mode Webhook

**Check:**
- Stripe Dashboard top right corner
- Environment variable `STRIPE_SECRET_KEY`
- Do they match? (both test or both live)

**Fix:**
- Make sure both are TEST or both are LIVE

### Issue 4: Webhook Signature Verification Failing Silently

**Check Render Logs:**
1. Go to Render Dashboard → Logs
2. Filter by time of payment
3. Look for ANY Stripe webhook logs

**Possible log messages:**
- "Invalid webhook signature" → Wrong secret
- "Webhook disabled" → Secret is "disabled"
- Nothing → Webhook not reaching your app

---

## 🔧 Nuclear Option: Recreate Webhook

If nothing else works:

1. **Delete existing webhook** in Stripe
2. **Create new webhook:**
   - URL: `https://provvypay-api.onrender.com/api/stripe/webhook`
   - Events: All 5 events you listed
   - Description: "ProvvyPay webhooks"
3. **Get new signing secret**
4. **Update in Render:** `STRIPE_WEBHOOK_SECRET=whsec_NEW_SECRET`
5. **Wait for redeployment**
6. **Test immediately**

---

## 📋 Immediate Action Plan

**Do these RIGHT NOW in order:**

### Step 1: Verify Payment Exists
1. Go to Stripe Test Payments
2. Find your payment
3. **Screenshot or note the Payment Intent ID** (starts with `pi_`)

### Step 2: Check Payment Events
1. Click on that payment
2. Go to "Events and logs"
3. **What events do you see?**
4. Click on `payment_intent.succeeded`
5. **Does it say webhooks were sent?**

### Step 3: Check Webhook Status
1. Go to Stripe Webhooks
2. Click your endpoint
3. Look at the very top - **Is it "Enabled"?**
4. **Copy the exact URL** - paste it here

### Step 4: Check Render Logs
1. Go to Render Logs
2. Search for the time when you made payment
3. **Do you see ANY logs mentioning "webhook" or "stripe"?**

### Step 5: Verify Keys Match
1. In Stripe, get your test publishable key
2. In Render, check `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. **Do they match?**

---

## 🆘 Report Back

Please provide these details:

1. **Payment Intent ID:** `pi_xxxxx` (from Stripe payment)
2. **Events on that payment:** What do you see in Events and logs?
3. **Webhook Status:** Enabled or Disabled?
4. **Webhook URL:** Exact URL from Stripe
5. **Render Logs:** Any webhook-related logs during payment time?
6. **Keys Match:** Does publishable key in Render match Stripe?

With this info, I can pinpoint the exact issue!

