# 🚨 URGENT: Stripe Webhook Not Working - Live Debugging

**Current Status:**
- ✅ Stripe payments processing successfully
- ❌ Invoice NOT updating to PAID
- ❌ NO webhook deliveries showing in Stripe Dashboard

---

## 🎯 Root Cause

**Stripe is NOT sending webhooks to your app**

This happens when:
1. Webhook endpoint doesn't have events configured
2. OR you're looking at the wrong Stripe mode (TEST vs LIVE)
3. OR webhook endpoint doesn't exist at all

---

## 🔍 IMMEDIATE DIAGNOSTIC STEPS

### Step 1: Find Your Recent Payment in Stripe

1. Go to https://dashboard.stripe.com/test/payments (make sure in TEST mode)
2. Find your most recent payment (the one you just made)
3. Click on it
4. Scroll down to **"Events and logs"** section

**QUESTION:** Do you see `payment_intent.succeeded` event there?

- ✅ YES → Payment succeeded, event was created by Stripe
- ❌ NO → Something else is wrong

---

### Step 2: Check Webhook Configuration

**CRITICAL CHECK:**

1. Go to https://dashboard.stripe.com/test/webhooks
2. **How many webhook endpoints do you see?**
   - 0 endpoints → Need to create one (see Step 3)
   - 1+ endpoints → Click on the one with your Render URL

3. If you have a webhook, look at **"Events to send"**

**What does it show?**

- "All events" → Should work (but not recommended)
- List of specific events → Does it include `payment_intent.succeeded`?
- "No events selected" → **THIS IS THE PROBLEM!**
- Blank/empty → **THIS IS THE PROBLEM!**

---

### Step 3: Fix - Add Events to Webhook

**If events are missing:**

1. In the webhook page, click **"..."** (three dots menu) → **"Update details"**
2. Scroll to **"Events to send"** section
3. Click **"+ Select events"** button
4. Search and select these 5 events:
   ```
   checkout.session.completed
   checkout.session.expired
   payment_intent.succeeded
   payment_intent.payment_failed
   payment_intent.canceled
   ```
5. Click **"Add events"** button
6. Click **"Update endpoint"** button at the bottom
7. **Verify:** You should now see these 5 events listed

---

### Step 4: Immediate Test

**Right after adding events:**

1. On the webhook page, click **"Send test webhook"**
2. Select: `payment_intent.succeeded`
3. Click **"Send test webhook"**

**Expected result:** Status **200 OK**

**Check "Recent deliveries":**
- Should see the test webhook you just sent
- Status should be green checkmark (200)

---

### Step 5: Test Real Payment

1. Create a NEW test payment link
2. Complete payment with: `4242 4242 4242 4242`
3. **Immediately check Stripe Dashboard → Webhooks → Your endpoint → Recent deliveries**

**You should see:**
- New delivery for `payment_intent.succeeded`
- Timestamp matching your payment time
- Status: 200 OK (green)

4. **Check Render Logs** at same time:
   - Go to Render Dashboard → Logs
   - Should see: "Processing Stripe webhook event"
   - Should see: "Payment confirmed via Stripe"

5. **Check payment link:**
   - Should update to PAID ✅

---

## 🆘 If Webhook Endpoint Doesn't Exist

**Create a new webhook:**

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click **"+ Add endpoint"**
3. Fill in:
   - **Endpoint URL:** `https://your-actual-app-name.onrender.com/api/stripe/webhook`
   - **Description:** "Payment webhooks"
   - **Version:** Latest
4. Click **"Select events"**
5. Add these 5 events:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
6. Click **"Add events"**
7. Click **"Add endpoint"**

**Get the signing secret:**

8. On the webhook page, scroll to **"Signing secret"**
9. Click **"Reveal"**
10. Copy the secret (starts with `whsec_`)

**Update Render:**

11. Go to Render Dashboard → Your Service → Environment
12. Find `STRIPE_WEBHOOK_SECRET`
13. Update value to the secret you copied
14. Click "Save Changes"
15. Wait 2-3 minutes for redeployment

---

## 📊 Quick Status Check

**Answer these questions:**

1. **In Stripe Dashboard → Test mode → Webhooks:**
   - How many endpoints do you see?
   - What's the endpoint URL?
   - How many events are configured? (should be 5)

2. **When you click "Send test webhook":**
   - What status code do you get?
   - Does it appear in "Recent deliveries"?

3. **In Render Environment:**
   - What's the value of `STRIPE_WEBHOOK_SECRET`?
   - Is it still "disabled" or a real `whsec_` secret?

4. **When you make a payment:**
   - Does it appear in Stripe Payments?
   - Does it appear in Stripe Webhook "Recent deliveries"?
   - Do you see logs in Render?

---

## 🎯 Most Likely Issue

Based on "no event deliveries found":

**99% chance:** Webhook endpoint exists but has NO EVENTS configured

**Fix:** Add the 5 events listed above to your webhook endpoint

**Why this happens:**
- When you create a webhook, events are NOT automatically selected
- You must explicitly choose which events to receive
- Without events selected, Stripe creates payment events but doesn't send them to your webhook

---

## 🔬 Verification Command

Run this to check your current configuration:

```bash
node scripts/test-webhook-config.js
```

This will tell you:
- If STRIPE_WEBHOOK_SECRET is set correctly
- If it's still "disabled"
- If the endpoint is reachable

---

## ⚡ Expected Timeline

Once events are added:
- ⏱️ **Immediate:** Test webhook should work
- ⏱️ **Immediate:** New payments should trigger webhooks
- ⏱️ **10 seconds:** Invoice should update to PAID after payment
- ⏱️ **No redeployment needed** (if webhook secret is already correct)

---

## 📞 Tell Me

Please check and report:

1. **Go to Stripe Dashboard → Test Webhooks → Your endpoint**
   - Screenshot or tell me what's under "Events to send"
   
2. **Click "Send test webhook" → Select `payment_intent.succeeded`**
   - What response code do you get?
   
3. **After sending test webhook, check "Recent deliveries"**
   - Do you see anything now?

This will tell me exactly what's wrong! 🎯

