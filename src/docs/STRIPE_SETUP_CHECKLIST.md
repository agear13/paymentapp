# Stripe Setup Checklist

Quick reference for setting up Stripe integration in development and production.

## Development Setup

### 1. Install Dependencies ✅
```bash
npm install stripe @stripe/stripe-js
```

### 2. Get Stripe Test API Keys

1. Visit: https://dashboard.stripe.com/test/apikeys
2. Copy **Publishable key** (starts with `pk_test_`)
3. Click "Reveal test key" and copy **Secret key** (starts with `sk_test_`)

### 3. Configure Environment Variables

Add to `.env.local`:

```bash
# Stripe Test Keys
STRIPE_SECRET_KEY="sk_test_YOUR_KEY_HERE"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_YOUR_KEY_HERE"
STRIPE_WEBHOOK_SECRET="whsec_YOUR_WEBHOOK_SECRET_HERE"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Set Up Webhook (Local Development)

**Option A: Stripe CLI (Recommended)**

Install Stripe CLI:
```bash
# Windows (Scoop)
scoop install stripe

# Mac (Homebrew)
brew install stripe/stripe-cli/stripe
```

Setup forwarding:
```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook signing secret (starts with `whsec_`) and add to `.env.local`.

**Option B: Use Stripe Dashboard**
- For local testing, use Stripe CLI
- For deployed dev environment, register webhook URL in Stripe Dashboard

### 5. Configure Test Merchant

```sql
UPDATE merchant_settings 
SET stripe_account_id = 'acct_test_123' 
WHERE organization_id = 'your-org-id';
```

### 6. Restart Development Server

```bash
npm run dev
```

### 7. Test Payment Flow

1. Create test payment link
2. Visit `/pay/{shortCode}`
3. Select Stripe payment
4. Use test card: `4242 4242 4242 4242`
5. Verify success

---

## Production Setup

### 1. Get Production API Keys

1. Visit: https://dashboard.stripe.com/apikeys (not /test/)
2. Copy **Publishable key** (starts with `pk_live_`)
3. Click "Reveal live key" and copy **Secret key** (starts with `sk_live_`)

### 2. Configure Production Environment

Add to production environment variables:

```bash
STRIPE_SECRET_KEY="sk_live_YOUR_PRODUCTION_KEY"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_YOUR_PRODUCTION_KEY"
STRIPE_WEBHOOK_SECRET="whsec_YOUR_PRODUCTION_WEBHOOK_SECRET"
NEXT_PUBLIC_APP_URL="https://your-production-domain.com"
```

### 3. Register Production Webhook

1. Visit: https://dashboard.stripe.com/webhooks
2. Click **"+ Add endpoint"**
3. Enter endpoint URL: `https://your-domain.com/api/stripe/webhook`
4. Select **"Latest API version"**
5. Select events to listen for:
   - ✅ `payment_intent.succeeded`
   - ✅ `payment_intent.payment_failed`
   - ✅ `payment_intent.canceled`
   - ✅ `checkout.session.completed`
   - ✅ `checkout.session.expired`
6. Click **"Add endpoint"**
7. Click **"Reveal"** under "Signing secret"
8. Copy webhook secret (starts with `whsec_`)
9. Add to production environment as `STRIPE_WEBHOOK_SECRET`

### 4. Test Webhook Delivery

1. In Stripe Dashboard, go to your webhook
2. Click **"Send test webhook"**
3. Select `payment_intent.succeeded`
4. Click **"Send test webhook"**
5. Verify response is `200 OK`

### 5. Configure Production Merchants

For each organization:

```sql
UPDATE merchant_settings 
SET stripe_account_id = 'acct_REAL_STRIPE_ACCOUNT' 
WHERE organization_id = 'org-uuid';
```

### 6. Enable Webhook Monitoring

1. In Stripe Dashboard → Webhooks
2. Enable **"Send me an email when webhooks fail"**
3. Set up webhook retry strategy
4. Monitor webhook dashboard regularly

### 7. Production Verification

Test with **real bank account in test mode** first:

1. Use production keys but stay in test mode
2. Create test payment link
3. Process test payment
4. Verify webhook delivery
5. Check all events logged
6. Verify success page displays

### 8. Go Live

1. Verify Stripe account activated
2. Complete business verification
3. Set up payout schedule
4. Deploy with production keys
5. Monitor first transactions closely

---

## Security Checklist

- ✅ API keys stored in environment variables (not code)
- ✅ Webhook signature verification enabled
- ✅ HTTPS enforced on production
- ✅ Rate limiting enabled on endpoints
- ✅ Error messages don't leak sensitive data
- ✅ Logging doesn't include API keys
- ✅ Idempotency keys used for payment operations

---

## Monitoring Setup

### Stripe Dashboard Monitoring

1. **Payments:** https://dashboard.stripe.com/payments
   - Monitor successful payments
   - Watch for failures

2. **Events:** https://dashboard.stripe.com/events
   - Review API events
   - Check for errors

3. **Webhooks:** https://dashboard.stripe.com/webhooks
   - Monitor delivery success rate
   - Review failed deliveries

### Application Monitoring

Set up alerts for:
- Webhook processing failures
- Payment status update failures
- High error rates on payment endpoints
- Unusual payment patterns

---

## Test Cards Reference

### Successful Payments
- **Visa:** 4242 4242 4242 4242
- **Mastercard:** 5555 5555 5555 4444
- **Amex:** 3782 822463 10005

### Declined Payments
- **Generic decline:** 4000 0000 0000 0002
- **Insufficient funds:** 4000 0000 0000 9995
- **Lost card:** 4000 0000 0000 9987
- **Stolen card:** 4000 0000 0000 9979

### 3D Secure
- **Requires auth:** 4000 0025 0000 3155
- **Always succeeds:** 4000 0027 6000 3184

**For all test cards:**
- Expiry: Any future date
- CVC: Any 3 digits
- ZIP: Any 5 digits

---

## Troubleshooting

### Webhook Not Working

**Check:**
1. Webhook URL is correct and publicly accessible
2. Webhook secret matches environment variable
3. SSL certificate is valid
4. Firewall allows Stripe IPs
5. Endpoint returns 2xx status code

### Payment Not Completing

**Check:**
1. Merchant has `stripe_account_id` configured
2. Payment link is in OPEN status
3. Payment link hasn't expired
4. Stripe API keys are correct (test vs production)
5. Amount is valid for currency

### Webhook Signature Verification Fails

**Check:**
1. `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
2. Using correct environment (test vs production)
3. Request body not modified before verification
4. Using raw request body (not parsed JSON)

---

## Support Resources

- **Stripe Docs:** https://stripe.com/docs
- **API Reference:** https://stripe.com/docs/api
- **Testing Guide:** https://stripe.com/docs/testing
- **Webhook Guide:** https://stripe.com/docs/webhooks
- **Status Page:** https://status.stripe.com
- **Support:** https://support.stripe.com

---

## Quick Commands

```bash
# Test webhook locally
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger test event
stripe trigger payment_intent.succeeded

# View Stripe logs
stripe logs tail

# Test API request
curl https://api.stripe.com/v1/payment_intents \
  -u sk_test_YOUR_KEY: \
  -d amount=1000 \
  -d currency=usd

# Check webhook signature
stripe webhook verify \
  --payload "$(cat webhook.json)" \
  --signature "t=xxx,v1=xxx" \
  --secret whsec_YOUR_SECRET
```

---

**Setup Complete:** ☐ Development ☐ Production  
**Verified By:** ___________  
**Date:** ___________













