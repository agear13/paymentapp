# Sprint 6 - Stripe Integration Testing Guide

## Quick Start Testing

### Prerequisites
1. ✅ Stripe dependencies installed (`stripe`, `@stripe/stripe-js`)
2. ✅ Environment variables configured
3. ✅ Database migrations applied
4. ✅ Development server running

### Step 1: Configure Environment

Create or update `.env.local`:

```bash
# Stripe Test Keys (from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY="sk_test_51..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..." # Get this from webhook setup

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Step 2: Set Up Test Merchant

Run in database or via Prisma Studio:

```sql
-- Update merchant settings with test Stripe account
UPDATE merchant_settings 
SET stripe_account_id = 'acct_test_123' 
WHERE organization_id = 'your-org-id';
```

### Step 3: Create Test Payment Link

```sql
-- Create a test payment link
INSERT INTO payment_links (
  id,
  organization_id,
  short_code,
  status,
  amount,
  currency,
  description,
  expires_at
) VALUES (
  gen_random_uuid(),
  'your-org-id',
  'TEST1234',
  'OPEN',
  100.00,
  'USD',
  'Test Payment - Stripe Integration',
  NOW() + INTERVAL '24 hours'
);
```

### Step 4: Test Payment Flow

#### A. Visit Payment Page
```
http://localhost:3000/pay/TEST1234
```

**Expected:**
- ✅ Payment page loads
- ✅ Amount displays correctly ($100.00)
- ✅ Stripe payment option is available
- ✅ Stripe card shows features

#### B. Select Stripe Payment
1. Click on the Stripe payment card
2. **Expected:**
   - ✅ Card highlights with blue border
   - ✅ "Pay $100.00" button appears
   - ✅ Button shows lock icon

#### C. Initiate Payment
1. Click "Pay $100.00" button
2. **Expected:**
   - ✅ Button shows loading state ("Redirecting to Stripe...")
   - ✅ Redirect to Stripe Checkout page
   - ✅ Checkout shows correct amount and merchant

#### D. Complete Payment
In Stripe Checkout, use test card:
```
Card Number: 4242 4242 4242 4242
Expiry: 12/34 (any future date)
CVC: 123 (any 3 digits)
ZIP: 12345 (any 5 digits)
```

1. Enter test card details
2. Click "Pay"
3. **Expected:**
   - ✅ Payment processes successfully
   - ✅ Redirect to success page
   - ✅ Success page shows payment details
   - ✅ Session ID displayed

#### E. Verify Database Updates
```sql
-- Check payment link status
SELECT status FROM payment_links WHERE short_code = 'TEST1234';
-- Expected: PAID

-- Check payment events
SELECT event_type, payment_method, stripe_payment_intent_id 
FROM payment_events 
WHERE payment_link_id = (SELECT id FROM payment_links WHERE short_code = 'TEST1234')
ORDER BY created_at DESC;
-- Expected: Two events
--   1. PAYMENT_CONFIRMED (from webhook)
--   2. PAYMENT_INITIATED (from checkout creation)
```

### Step 5: Test Cancellation Flow

#### Create Another Test Payment Link
```sql
INSERT INTO payment_links (
  id,
  organization_id,
  short_code,
  status,
  amount,
  currency,
  description,
  expires_at
) VALUES (
  gen_random_uuid(),
  'your-org-id',
  'TEST5678',
  'OPEN',
  50.00,
  'USD',
  'Test Payment - Cancel Flow',
  NOW() + INTERVAL '24 hours'
);
```

#### Test Cancellation
1. Visit `http://localhost:3000/pay/TEST5678`
2. Click Stripe payment option
3. Click "Pay $50.00"
4. In Stripe Checkout, click "← Back" (or close the window)
5. **Expected:**
   - ✅ Redirect to cancel page
   - ✅ Cancel page shows friendly message
   - ✅ "Try Again" button present
   - ✅ Payment link still OPEN (not paid)

### Step 6: Test Error Scenarios

#### A. Invalid Payment Link
Visit: `http://localhost:3000/pay/INVALID0`

**Expected:**
- ✅ Shows "Payment Link Not Found" page
- ✅ Error message displayed

#### B. Expired Payment Link
```sql
-- Create expired payment link
INSERT INTO payment_links (
  id,
  organization_id,
  short_code,
  status,
  amount,
  currency,
  description,
  expires_at
) VALUES (
  gen_random_uuid(),
  'your-org-id',
  'EXPIRED1',
  'OPEN',
  25.00,
  'USD',
  'Expired Payment Link',
  NOW() - INTERVAL '1 hour' -- Already expired
);
```

Visit: `http://localhost:3000/pay/EXPIRED1`

**Expected:**
- ✅ Shows "Payment Link Expired" page
- ✅ Expiration message displayed

#### C. Already Paid Payment Link
```sql
-- Update test link to PAID
UPDATE payment_links 
SET status = 'PAID' 
WHERE short_code = 'TEST1234';
```

Visit: `http://localhost:3000/pay/TEST1234`

**Expected:**
- ✅ Shows "Payment Already Completed" page
- ✅ Payment details displayed

#### D. Merchant Without Stripe
```sql
-- Remove Stripe account from merchant
UPDATE merchant_settings 
SET stripe_account_id = NULL 
WHERE organization_id = 'your-org-id';
```

Visit any payment link

**Expected:**
- ✅ Stripe payment option shows as unavailable
- ✅ Message: "Card payments not available from this merchant"

### Step 7: Test Webhook Processing

#### Option A: Using Stripe CLI (Recommended)

**Install Stripe CLI:**
```bash
# Windows (with Scoop)
scoop install stripe

# Mac (with Homebrew)
brew install stripe/stripe-cli/stripe

# Or download from https://stripe.com/docs/stripe-cli
```

**Setup Webhook Forwarding:**
```bash
# Login to Stripe
stripe login

# Forward webhooks to local endpoint
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Copy the webhook secret (starts with whsec_)
# Update STRIPE_WEBHOOK_SECRET in .env.local
```

**Trigger Test Events:**
```bash
# Test successful payment
stripe trigger payment_intent.succeeded

# Test failed payment
stripe trigger payment_intent.payment_failed

# Test checkout completion
stripe trigger checkout.session.completed
```

**Verify:**
- ✅ Events received by webhook endpoint
- ✅ Signature verification passes
- ✅ Events logged in database
- ✅ Payment status updated correctly

#### Option B: Stripe Dashboard Testing

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click your webhook endpoint
3. Click "Send test webhook"
4. Select event type: `payment_intent.succeeded`
5. Click "Send test webhook"

**Verify in logs:**
```bash
# Check server logs for webhook processing
# Should see: "Webhook signature verified"
# Should see: "Webhook event processed successfully"
```

### Step 8: Test Different Currencies

```sql
-- Create EUR payment link
INSERT INTO payment_links (
  id,
  organization_id,
  short_code,
  status,
  amount,
  currency,
  description,
  expires_at
) VALUES (
  gen_random_uuid(),
  'your-org-id',
  'TESTEURO',
  'OPEN',
  75.50,
  'EUR',
  'Test Payment - Euro',
  NOW() + INTERVAL '24 hours'
);

-- Create JPY payment link (zero-decimal currency)
INSERT INTO payment_links (
  id,
  organization_id,
  short_code,
  status,
  amount,
  currency,
  description,
  expires_at
) VALUES (
  gen_random_uuid(),
  'your-org-id',
  'TESTYEN',
  'OPEN',
  10000,
  'JPY',
  'Test Payment - Japanese Yen',
  NOW() + INTERVAL '24 hours'
);
```

**Test both payment links and verify:**
- ✅ EUR displays with € symbol
- ✅ JPY displays with ¥ symbol
- ✅ Amounts convert correctly in Stripe
- ✅ Payments process successfully

### Step 9: Test Card Declined Scenario

Use Stripe's declined test card:
```
Card Number: 4000 0000 0000 0002
Expiry: 12/34
CVC: 123
```

1. Create new test payment link
2. Initiate Stripe Checkout
3. Enter declined test card
4. Attempt payment

**Expected:**
- ✅ Stripe shows "Your card was declined" error
- ✅ Customer can try again
- ✅ Webhook fires: `payment_intent.payment_failed`
- ✅ Event logged in database
- ✅ Payment link remains OPEN

### Step 10: Test Rate Limiting

Run this script to test rate limiting:

```bash
# Make 10 rapid requests to create payment intent
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/stripe/create-payment-intent \
    -H "Content-Type: application/json" \
    -d '{"paymentLinkId": "test-uuid"}' &
done
wait
```

**Expected:**
- ✅ First requests succeed (up to rate limit)
- ✅ Subsequent requests return 429 (Rate limit exceeded)
- ✅ Rate limit resets after window expires

## API Testing with cURL

### Test PaymentIntent Creation

```bash
curl -X POST http://localhost:3000/api/stripe/create-payment-intent \
  -H "Content-Type: application/json" \
  -d '{
    "paymentLinkId": "your-payment-link-uuid"
  }'
```

**Expected Response:**
```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx"
}
```

### Test Checkout Session Creation

```bash
curl -X POST http://localhost:3000/api/stripe/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{
    "paymentLinkId": "your-payment-link-uuid"
  }'
```

**Expected Response:**
```json
{
  "sessionId": "cs_test_xxx",
  "url": "https://checkout.stripe.com/c/pay/cs_test_xxx"
}
```

### Test Webhook Endpoint (Manual)

```bash
# This will fail signature verification (expected)
curl -X POST http://localhost:3000/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: test" \
  -d '{
    "id": "evt_test",
    "type": "payment_intent.succeeded"
  }'
```

**Expected Response:**
```json
{
  "error": "Invalid signature"
}
```

## Monitoring & Debugging

### Check Server Logs

Look for these log entries:

**Successful PaymentIntent:**
```
[INFO] PaymentIntent created successfully
  paymentLinkId: xxx
  paymentIntentId: pi_xxx
  amount: 10000
  currency: USD
```

**Webhook Processing:**
```
[INFO] Webhook signature verified
  eventId: evt_xxx
  eventType: payment_intent.succeeded

[INFO] Payment confirmed via Stripe
  paymentLinkId: xxx
  paymentIntentId: pi_xxx
  amount: 10000
  currency: usd
```

### Check Stripe Dashboard

1. **Payments:** https://dashboard.stripe.com/test/payments
   - View all test payments
   - Check payment status
   - View customer details

2. **Events:** https://dashboard.stripe.com/test/events
   - See all API events
   - View webhook deliveries
   - Check event details

3. **Webhooks:** https://dashboard.stripe.com/test/webhooks
   - View webhook delivery status
   - Check failed deliveries
   - Retry failed webhooks

### Common Issues & Solutions

#### Webhook Not Working
**Problem:** Webhooks not being received

**Solutions:**
1. Check webhook URL is correct
2. Verify webhook secret matches `.env.local`
3. Use Stripe CLI for local testing
4. Check firewall/network settings
5. Review Stripe Dashboard webhook logs

#### Payment Not Updating Status
**Problem:** Payment completed but status not changing

**Solutions:**
1. Check webhook endpoint is receiving events
2. Verify signature verification passes
3. Check database for payment_events entries
4. Review server logs for errors
5. Ensure payment_link_id in metadata is correct

#### Checkout Redirect Fails
**Problem:** Can't redirect to Stripe Checkout

**Solutions:**
1. Check Stripe API keys are correct
2. Verify merchant has stripe_account_id configured
3. Check payment link is OPEN status
4. Verify payment link hasn't expired
5. Check browser console for errors

## Success Criteria Checklist

After completing all tests, verify:

- ✅ Can create payment links via dashboard
- ✅ Payment page displays correctly
- ✅ Stripe payment option selectable
- ✅ Checkout session creates successfully
- ✅ Redirect to Stripe Checkout works
- ✅ Test card payment processes
- ✅ Webhook receives events
- ✅ Payment status updates to PAID
- ✅ Success page displays
- ✅ Cancellation flow works
- ✅ Error pages display correctly
- ✅ Multiple currencies supported
- ✅ Card declined handled gracefully
- ✅ Rate limiting works
- ✅ Database events logged correctly

## Performance Testing

### Load Test (Optional)

Create multiple payment links and process payments:

```bash
# Create 10 payment links
for i in {1..10}; do
  # Insert payment link
  # Process payment
  # Verify status
done
```

**Expected:**
- ✅ All payments process successfully
- ✅ No race conditions
- ✅ Database updates atomic
- ✅ Webhooks process in order

## Production Readiness

Before deploying to production:

1. ✅ Replace test API keys with production keys
2. ✅ Update webhook URL to production domain
3. ✅ Test with real bank account (test mode first)
4. ✅ Verify SSL certificate valid
5. ✅ Enable webhook retry in Stripe Dashboard
6. ✅ Set up monitoring and alerts
7. ✅ Document incident response procedures
8. ✅ Train team on Stripe Dashboard

## Next Steps

After successful testing:

1. ✅ Mark Sprint 6 as complete
2. ✅ Update project status documentation
3. ✅ Begin Sprint 7 (Hedera Integration)
4. ✅ Schedule code review
5. ✅ Plan production deployment

---

## Testing Completion

**Date Tested:** ___________  
**Tested By:** ___________  
**All Tests Passed:** ☐ Yes ☐ No  
**Issues Found:** ___________  
**Notes:** ___________

**Ready for Production:** ☐ Yes ☐ No













