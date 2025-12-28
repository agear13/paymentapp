# Stripe Webhook Setup Guide

**Complete guide for setting up and testing Stripe webhooks locally and in production**

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Environment Variables](#environment-variables)
4. [Testing Webhooks Locally](#testing-webhooks-locally)
5. [Supported Webhook Events](#supported-webhook-events)
6. [Production Deployment](#production-deployment)
7. [Troubleshooting](#troubleshooting)
8. [Security Best Practices](#security-best-practices)

---

## 🔧 Prerequisites

Before setting up webhooks, ensure you have:

- ✅ **Stripe Account** - [Sign up](https://dashboard.stripe.com/register) (free)
- ✅ **Stripe CLI installed** - [Download](https://stripe.com/docs/stripe-cli)
- ✅ **Node.js 18+** and **npm/pnpm/yarn**
- ✅ **Payment Link App running locally** (`npm run dev`)

---

## 🚀 Local Development Setup

### Step 1: Install Stripe CLI

#### macOS (via Homebrew)
```bash
brew install stripe/stripe-cli/stripe
```

#### Windows (via Scoop)
```powershell
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
```

#### Linux
```bash
# Download and extract
wget https://github.com/stripe/stripe-cli/releases/download/v1.19.5/stripe_1.19.5_linux_x86_64.tar.gz
tar -xvf stripe_1.19.5_linux_x86_64.tar.gz

# Move to PATH
sudo mv stripe /usr/local/bin/
```

#### Verify Installation
```bash
stripe --version
# Should output: stripe version 1.19.x
```

### Step 2: Login to Stripe CLI

```bash
stripe login
```

This will:
1. Open your browser
2. Ask you to authorize the CLI
3. Generate a persistent token

### Step 3: Install Dependencies

```bash
cd src
npm install
```

This installs the Stripe Node SDK (`stripe@^17.7.0`) which is required for webhook verification.

---

## 🔐 Environment Variables

### Required Variables for Webhooks

Your `.env.local` file **MUST** include these Stripe variables:

```bash
# ─── STRIPE (Required for webhooks) ────────────────────────────────────
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

### How to Get Your Keys

#### 1. Publishable Key & Secret Key

From [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys):

1. Go to **Developers** → **API Keys**
2. Copy **Publishable key** → Add to `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. Copy **Secret key** → Add to `STRIPE_SECRET_KEY`

**⚠️ Use TEST keys for development** (`pk_test_...` and `sk_test_...`)

#### 2. Webhook Secret (Local Development)

For local development, you'll get this from the Stripe CLI (see next section).

For production webhooks, you'll get this from the Stripe Dashboard (see [Production Deployment](#production-deployment)).

---

## 🧪 Testing Webhooks Locally

### Method 1: Using npm Script (Recommended)

We've created a convenient script for you:

```bash
# Terminal 1: Start your Next.js app
npm run dev

# Terminal 2: Start Stripe webhook listener
npm run stripe:listen
```

The `stripe:listen` script will:
- Forward webhooks from Stripe to `http://localhost:3000/api/stripe/webhook`
- Display a webhook signing secret (starts with `whsec_`)

### Method 2: Manual Stripe CLI Command

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### Copy the Webhook Secret

When you run the listener, you'll see output like:

```
> Ready! Your webhook signing secret is whsec_abc123xyz... (^C to quit)
```

**Copy that `whsec_...` secret and add it to your `.env.local`:**

```bash
STRIPE_WEBHOOK_SECRET="whsec_abc123xyz..."
```

**Important:** Restart your Next.js dev server after updating `.env.local`

```bash
# Stop (Ctrl+C) and restart
npm run dev
```

### Trigger Test Events

With both terminals running (dev server + webhook listener), trigger test events:

#### Test Payment Intent Success
```bash
stripe trigger payment_intent.succeeded
```

#### Test Checkout Session Completed
```bash
stripe trigger checkout.session.completed
```

#### Test Payment Failed
```bash
stripe trigger payment_intent.payment_failed
```

### Verify Webhook Reception

Check your app logs (Terminal 1) for:

```
[INFO] Webhook signature verified - eventId: evt_...
[INFO] Webhook event processed successfully - eventType: payment_intent.succeeded
```

---

## 📡 Supported Webhook Events

Our webhook handler processes these Stripe events:

| Event Type | Description | Handler Action |
|------------|-------------|----------------|
| **`payment_intent.succeeded`** | Payment completed successfully | ✅ Update payment link to `PAID`<br>✅ Record payment event<br>✅ Store transaction details |
| **`payment_intent.payment_failed`** | Payment attempt failed | ⚠️ Create failure event<br>⚠️ Log error details<br>⚠️ Keep link as `OPEN` |
| **`payment_intent.canceled`** | Payment intent was canceled | ❌ Record cancellation event<br>❌ Log cancellation reason |
| **`checkout.session.completed`** | Checkout session finished | ✅ Update payment link to `PAID`<br>✅ Record session details<br>✅ Store customer info |
| **`checkout.session.expired`** | Checkout session expired | ⏱️ Log expiration<br>⏱️ Link remains `OPEN` |

### Webhook Route Details

- **Endpoint:** `/api/stripe/webhook`
- **Method:** `POST`
- **Authentication:** Stripe signature verification (no API key needed)
- **Idempotency:** Events are only processed once (tracked by `stripeEventId`)

---

## 🌐 Production Deployment

### Step 1: Create Production Webhook in Stripe

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Enter your production URL:
   ```
   https://your-domain.com/api/stripe/webhook
   ```
4. Select events to listen to:
   - ✅ `payment_intent.succeeded`
   - ✅ `payment_intent.payment_failed`
   - ✅ `payment_intent.canceled`
   - ✅ `checkout.session.completed`
   - ✅ `checkout.session.expired`
5. Click **Add endpoint**

### Step 2: Copy Production Webhook Secret

After creating the endpoint:

1. Click on your new endpoint
2. Click **Reveal** under **Signing secret**
3. Copy the `whsec_...` secret
4. Add it to your production environment variables

**Vercel Example:**
```bash
vercel env add STRIPE_WEBHOOK_SECRET production
# Paste the whsec_... value when prompted
```

**Other Platforms:**
Add `STRIPE_WEBHOOK_SECRET=whsec_...` to your production environment variables.

### Step 3: Test Production Webhook

After deploying:

1. Go to your Stripe endpoint page
2. Click **Send test webhook**
3. Select `payment_intent.succeeded`
4. Click **Send test webhook**
5. Verify response shows `200 OK`

---

## 🔍 Troubleshooting

### Issue: "Missing Stripe signature header"

**Cause:** Webhook request missing `stripe-signature` header

**Solution:**
- Ensure you're using Stripe CLI or actual Stripe webhooks
- Don't manually call the endpoint (it requires Stripe's signature)

### Issue: "Invalid signature"

**Cause:** Incorrect or missing `STRIPE_WEBHOOK_SECRET`

**Solution:**
1. Copy the correct webhook secret from Stripe CLI or Dashboard
2. Update `.env.local` with the new secret
3. **Restart your Next.js server** (environment variables load at startup)

```bash
# Stop and restart
npm run dev
```

### Issue: "Webhook event already processed"

**Cause:** Duplicate event (this is normal and safe)

**Solution:** This is expected behavior - our idempotency check prevents duplicate processing. No action needed.

### Issue: Payment link not updating to PAID

**Possible Causes:**
1. Missing `payment_link_id` in Stripe metadata
2. Database connection issue
3. Payment link ID doesn't exist

**Debugging:**
```bash
# Check logs for payment_link_id
grep "payment_link_id" .next/server/app/api/stripe/webhook/route.js

# Check database
npm run db:studio
# Look for PaymentEvents table to see if events are being recorded
```

### Issue: Webhook timing out

**Cause:** Long database operations or network issues

**Solution:**
- Ensure database is accessible
- Check database query performance
- Consider using background jobs for heavy processing

---

## 🔒 Security Best Practices

### ✅ DO:

1. **Always verify webhook signatures**
   - Our implementation does this automatically
   - Never skip signature verification

2. **Use environment variables for secrets**
   ```bash
   # ✅ Good
   STRIPE_WEBHOOK_SECRET="whsec_..."
   
   # ❌ Bad - hardcoded in code
   const secret = "whsec_...";
   ```

3. **Implement idempotency**
   - Our webhook checks `stripeEventId` to prevent duplicate processing
   - Always use Stripe's `event.id` for deduplication

4. **Use different webhook secrets for different environments**
   - Local development: From Stripe CLI
   - Staging: From Stripe Dashboard staging webhook
   - Production: From Stripe Dashboard production webhook

5. **Keep `.env.local` in `.gitignore`**
   - ✅ Already configured in this project
   - Never commit secrets to Git

### ❌ DON'T:

1. **Don't expose webhook secrets publicly**
   - Never log webhook secrets
   - Never commit `.env.local` to version control
   - Never share secrets in chat/email

2. **Don't skip signature verification**
   ```typescript
   // ❌ Bad - accepting unverified webhooks
   const event = await request.json();
   
   // ✅ Good - verifying signature
   const event = await verifyWebhookSignature(body, signature);
   ```

3. **Don't use production keys in development**
   - Always use TEST keys (`pk_test_...`, `sk_test_...`)
   - Only use live keys in production

4. **Don't expose error details to clients**
   - Our implementation logs full errors server-side
   - Returns generic errors to client

---

## 📚 Additional Resources

### Stripe Documentation
- [Webhook Guide](https://stripe.com/docs/webhooks)
- [Webhook Signatures](https://stripe.com/docs/webhooks/signatures)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Event Types](https://stripe.com/docs/api/events/types)

### Project Documentation
- [Stripe Quick Reference](./src/docs/STRIPE_QUICK_REFERENCE.md)
- [Stripe Setup Checklist](./src/docs/STRIPE_SETUP_CHECKLIST.md)
- [Payment Flow Documentation](./src/docs/STRIPE_PAYMENT_FLOW.md)

### Testing Tools
- [Stripe Test Cards](https://stripe.com/docs/testing#cards)
- [Webhook Testing](https://stripe.com/docs/webhooks/test)
- [Stripe CLI Commands](https://stripe.com/docs/cli/commands)

---

## 🎯 Quick Reference Commands

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS

# Login to Stripe
stripe login

# Start local webhook listener
npm run stripe:listen

# Trigger test events
stripe trigger payment_intent.succeeded
stripe trigger checkout.session.completed
stripe trigger payment_intent.payment_failed

# View webhook logs
stripe logs tail

# List all webhook endpoints
stripe webhook-endpoints list

# Test webhook endpoint
stripe webhook-endpoints create \
  --url https://your-domain.com/api/stripe/webhook \
  --enabled-events payment_intent.succeeded,checkout.session.completed
```

---

## ✅ Verification Checklist

Before going live with webhooks:

- [ ] Stripe CLI installed and authenticated
- [ ] `STRIPE_SECRET_KEY` added to `.env.local`
- [ ] `STRIPE_WEBHOOK_SECRET` added to `.env.local`
- [ ] `.env.local` is in `.gitignore` (confirmed ✅)
- [ ] `npm install` completed successfully
- [ ] `npm run dev` starts without errors
- [ ] `npm run stripe:listen` forwards webhooks successfully
- [ ] Test events trigger successfully (`stripe trigger payment_intent.succeeded`)
- [ ] Webhook logs show successful processing
- [ ] Payment links update to `PAID` status after webhook
- [ ] Production webhook endpoint created in Stripe Dashboard
- [ ] Production webhook secret added to production environment variables
- [ ] Production webhooks tested and returning `200 OK`

---

## 🆘 Support

If you encounter issues:

1. **Check logs:** Look at Next.js console output for detailed error messages
2. **Verify setup:** Run through this guide step-by-step
3. **Test with CLI:** Use `stripe trigger` to send test events
4. **Check Stripe Dashboard:** View webhook delivery attempts and errors
5. **Review code:** See `src/app/api/stripe/webhook/route.ts` for implementation details

---

**Last Updated:** December 2025  
**Status:** ✅ Production Ready  
**Webhook Route:** `/api/stripe/webhook`

---

**⚠️ CRITICAL SECURITY REMINDER:**

**NEVER commit your `.env.local` file to Git!**

The `.gitignore` file already excludes it, but always verify before committing:

```bash
git status
# Should NOT show .env.local
```

If you accidentally commit secrets, immediately:
1. Rotate all API keys in Stripe Dashboard
2. Remove the commit from Git history
3. Update environment variables everywhere

