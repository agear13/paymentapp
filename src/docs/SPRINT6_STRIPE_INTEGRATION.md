# Sprint 6: Stripe Payment Integration - Complete ✅

## Overview
Complete Stripe payment integration enabling secure credit/debit card payments through Stripe Checkout and embedded payment forms.

## Implementation Status

### ✅ Stripe Setup
- **Installed Dependencies**
  - `stripe` - Server-side Stripe SDK
  - `@stripe/stripe-js` - Client-side Stripe.js library

- **Configuration**
  - Environment variables configured in `.env.local`:
    - `STRIPE_SECRET_KEY` - Server-side secret key
    - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Client-side publishable key
    - `STRIPE_WEBHOOK_SECRET` - Webhook signature verification

- **Utilities Created**
  - `lib/stripe/client.ts` - Stripe client singleton with error handling
  - `lib/stripe/webhook.ts` - Webhook signature verification utilities

### ✅ Core API Endpoints

#### 1. PaymentIntent Creation
**Endpoint:** `POST /api/stripe/create-payment-intent`

**Purpose:** Create a Stripe PaymentIntent for embedded payment forms (future use)

**Features:**
- Validates payment link status and expiration
- Converts amounts to smallest currency unit
- Adds metadata (payment_link_id, organization_id, short_code)
- Implements idempotency with retry logic
- Returns existing PaymentIntent if available
- Creates PAYMENT_INITIATED event

**Request:**
```json
{
  "paymentLinkId": "uuid-of-payment-link"
}
```

**Response:**
```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx"
}
```

#### 2. Checkout Session Creation
**Endpoint:** `POST /api/stripe/create-checkout-session`

**Purpose:** Create hosted Stripe Checkout session (primary payment method)

**Features:**
- Creates full Stripe Checkout session
- Configures line items with pricing
- Sets success/cancel return URLs
- Configures session expiration
- Links PaymentIntent metadata
- Pre-fills customer email if available

**Request:**
```json
{
  "paymentLinkId": "uuid-of-payment-link",
  "successUrl": "https://example.com/success" // optional
  "cancelUrl": "https://example.com/cancel" // optional
}
```

**Response:**
```json
{
  "sessionId": "cs_test_xxx",
  "url": "https://checkout.stripe.com/c/pay/cs_test_xxx"
}
```

#### 3. Webhook Handler
**Endpoint:** `POST /api/stripe/webhook`

**Purpose:** Process Stripe webhook events securely

**Events Handled:**
- `payment_intent.succeeded` - Mark payment link as PAID
- `payment_intent.payment_failed` - Log payment failure
- `payment_intent.canceled` - Log cancellation
- `checkout.session.completed` - Log checkout completion
- `checkout.session.expired` - Log checkout expiration

**Security:**
- Verifies Stripe signature on every request
- Implements idempotency checks to prevent duplicate processing
- Logs all events for audit trail

**Webhook URL (to register with Stripe):**
```
https://your-domain.com/api/stripe/webhook
```

### ✅ UI Components

#### 1. Stripe Payment Option (`components/public/stripe-payment-option.tsx`)
**Features:**
- Visual card for selecting Stripe payment
- Shows payment method features (instant processing, all currencies)
- "Pay Now" button that creates Checkout session
- Loading states during redirect
- Handles errors with toast notifications
- Disabled state when not available

#### 2. Success Page (`app/(public)/pay/[shortCode]/success/page.tsx`)
**Features:**
- Confirmation UI after successful payment
- Displays payment details (amount, invoice ref, merchant)
- Shows session ID from Stripe
- Receipt notification message
- Return home button

#### 3. Canceled Page (`app/(public)/pay/[shortCode]/canceled/page.tsx`)
**Features:**
- Friendly cancellation message
- Explains no charges were made
- "Try Again" button to return to payment page
- Help text for troubleshooting

### ✅ Helper Functions

#### Currency Conversion (`lib/stripe/client.ts`)
```typescript
toSmallestUnit(amount: number, currency: string): number
fromSmallestUnit(amount: number, currency: string): number
```
- Handles zero-decimal currencies (JPY, KRW, etc.)
- Converts to/from cents for standard currencies

#### Error Handling
```typescript
handleStripeError(error: any): { message: string; code?: string; statusCode: number }
```
- Provides user-friendly error messages
- Logs detailed error information
- Returns appropriate HTTP status codes

#### Idempotency
```typescript
generateIdempotencyKey(paymentLinkId: string, prefix: string): string
```
- Prevents duplicate PaymentIntent creation
- Uses timestamp + payment link ID

## Payment Flow

### Standard Checkout Flow
1. **Customer visits payment link** → `GET /api/public/pay/{shortCode}`
2. **Selects Stripe payment method** → UI highlights Stripe option
3. **Clicks "Pay Now"** → `POST /api/stripe/create-checkout-session`
4. **Redirects to Stripe Checkout** → Hosted payment page
5. **Completes payment** → Stripe processes payment
6. **Webhook fires** → `POST /api/stripe/webhook` (payment_intent.succeeded)
7. **Payment link updated** → Status → PAID
8. **Customer redirected** → Success page with confirmation

### Cancellation Flow
1. Customer clicks "Back" in Stripe Checkout
2. Redirected to cancel page
3. Can retry payment from cancel page

### Failure Flow
1. Payment fails (declined card, insufficient funds, etc.)
2. Webhook fired: `payment_intent.payment_failed`
3. Event logged in database
4. Customer can retry in Stripe Checkout

## Database Schema

### Payment Events
Stripe events are recorded in the `payment_events` table:

```prisma
model PaymentEvent {
  eventType: "PAYMENT_INITIATED" | "PAYMENT_CONFIRMED" | "PAYMENT_FAILED" | "CANCELED"
  paymentMethod: "STRIPE"
  stripePaymentIntentId: String?
  amountReceived: Decimal?
  currencyReceived: String?
  metadata: Json // Contains Stripe-specific data
}
```

### Metadata Examples

**Payment Initiated:**
```json
{
  "checkoutSessionId": "cs_test_xxx",
  "checkoutUrl": "https://checkout.stripe.com/...",
  "amount": 10000,
  "currency": "USD"
}
```

**Payment Confirmed:**
```json
{
  "stripeEventId": "evt_xxx",
  "stripeStatus": "succeeded",
  "paymentMethodTypes": ["card"],
  "receiptEmail": "customer@example.com"
}
```

**Payment Failed:**
```json
{
  "stripeEventId": "evt_xxx",
  "stripeStatus": "requires_payment_method",
  "lastPaymentError": {
    "code": "card_declined",
    "message": "Your card was declined."
  }
}
```

## Configuration

### Environment Variables
Required in `.env.local`:

```bash
# Stripe Keys (get from https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY="sk_test_xxx"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_xxx"

# Webhook Secret (get from webhook configuration)
STRIPE_WEBHOOK_SECRET="whsec_xxx"

# Application URL (for return URLs)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Stripe Dashboard Setup

1. **Get API Keys**
   - Visit: https://dashboard.stripe.com/apikeys
   - Copy Publishable key and Secret key
   - Add to `.env.local`

2. **Configure Webhook**
   - Visit: https://dashboard.stripe.com/webhooks
   - Click "Add endpoint"
   - URL: `https://your-domain.com/api/stripe/webhook`
   - Events to select:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `payment_intent.canceled`
     - `checkout.session.completed`
     - `checkout.session.expired`
   - Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

3. **Test Mode**
   - Use test keys (starting with `sk_test_` and `pk_test_`)
   - Test cards: https://stripe.com/docs/testing

### Merchant Settings
Merchants must configure their Stripe account ID:

```sql
UPDATE merchant_settings 
SET stripe_account_id = 'acct_xxx' 
WHERE organization_id = 'org-uuid';
```

## Testing

### Test Cards
Use these test cards in Stripe test mode:

**Success:**
- `4242 4242 4242 4242` - Visa
- `5555 5555 5555 4444` - Mastercard
- `3782 822463 10005` - American Express

**Decline:**
- `4000 0000 0000 0002` - Card declined

**3D Secure:**
- `4000 0025 0000 3155` - Requires authentication

### Testing Webhooks Locally

**Option 1: Stripe CLI**
```bash
# Install Stripe CLI
npm install -g stripe-cli

# Login to Stripe
stripe login

# Forward webhooks to local endpoint
stripe listen --forward-to localhost:3000/api/stripe/webhook

# This will give you a webhook secret starting with whsec_
# Add it to your .env.local as STRIPE_WEBHOOK_SECRET
```

**Option 2: Webhook Testing Dashboard**
- Visit: https://dashboard.stripe.com/test/webhooks
- Click on your webhook endpoint
- Click "Send test webhook"

### Manual Testing Flow

1. **Create Payment Link** (Dashboard)
   - Set status to OPEN
   - Configure merchant with Stripe account ID
   - Note the short code

2. **Visit Payment Page**
   ```
   http://localhost:3000/pay/{shortCode}
   ```

3. **Select Stripe Payment**
   - Click Stripe option card
   - Verify "Pay Now" button appears

4. **Complete Checkout**
   - Click "Pay Now"
   - Should redirect to Stripe Checkout
   - Enter test card: `4242 4242 4242 4242`
   - Expiry: any future date
   - CVC: any 3 digits
   - ZIP: any 5 digits
   - Click "Pay"

5. **Verify Success**
   - Should redirect to success page
   - Check payment link status: should be PAID
   - Check payment_events table for PAYMENT_INITIATED and PAYMENT_CONFIRMED events
   - Check webhook logs in Stripe Dashboard

6. **Test Cancellation**
   - Start new payment
   - Click "Back" in Stripe Checkout
   - Should see cancel page
   - Payment link should still be OPEN

### API Testing

**Test PaymentIntent Creation:**
```bash
curl -X POST http://localhost:3000/api/stripe/create-payment-intent \
  -H "Content-Type: application/json" \
  -d '{"paymentLinkId": "uuid-here"}'
```

**Test Checkout Session Creation:**
```bash
curl -X POST http://localhost:3000/api/stripe/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{"paymentLinkId": "uuid-here"}'
```

**Test Webhook (with Stripe CLI):**
```bash
stripe trigger payment_intent.succeeded
```

## Error Handling

### Client-Side Errors
- Network failures → Toast notification
- Invalid payment link → 404 page
- Expired payment link → Expired page
- Payment link already paid → Paid page

### Server-Side Errors
- Stripe API errors → Logged + user-friendly message returned
- Webhook signature verification failure → 401 response
- Database errors → 500 response + logged
- Rate limiting → 429 response

### Retry Logic
- PaymentIntent creation: 3 retries with exponential backoff
- Webhook processing: Stripe handles retries automatically
- Failed webhooks: Check Stripe Dashboard for retry status

## Security Features

1. **Webhook Signature Verification**
   - Every webhook validated with Stripe signature
   - Prevents unauthorized webhook calls

2. **Idempotency**
   - Prevents duplicate PaymentIntent creation
   - Prevents duplicate webhook processing

3. **Metadata Validation**
   - All PaymentIntents tagged with payment_link_id
   - Webhooks verify metadata before processing

4. **Rate Limiting**
   - Public API endpoints rate limited
   - Prevents abuse

5. **PCI Compliance**
   - Card data never touches our servers
   - Stripe handles all sensitive data

## Monitoring & Logging

### Log Events
All operations logged using `lib/logger.ts`:

```typescript
// Success logs
log.info({ paymentLinkId, paymentIntentId, amount, currency }, 'PaymentIntent created')
log.info({ paymentLinkId, sessionId }, 'Checkout session created')

// Warning logs
log.warn({ error, paymentIntentId }, 'Failed to retrieve PaymentIntent')

// Error logs
log.error({ error }, 'Failed to create PaymentIntent')
log.error({ eventId, eventType }, 'Webhook processing failed')
```

### Stripe Dashboard
Monitor in Stripe Dashboard:
- Payments: https://dashboard.stripe.com/payments
- Events: https://dashboard.stripe.com/events
- Webhooks: https://dashboard.stripe.com/webhooks

### Database Queries

**Check payment events:**
```sql
SELECT * FROM payment_events 
WHERE payment_link_id = 'uuid' 
ORDER BY created_at DESC;
```

**Check webhook processing:**
```sql
SELECT * FROM payment_events 
WHERE metadata->>'stripeEventId' IS NOT NULL 
ORDER BY created_at DESC;
```

## Future Enhancements

### Sprint 6 Complete ✅
All tasks implemented:
- ✅ Stripe SDK installed
- ✅ Client singleton created
- ✅ Webhook verification implemented
- ✅ Webhook endpoint created
- ✅ PaymentIntent API created
- ✅ Checkout session API created
- ✅ Success/cancel pages created
- ✅ Webhook event processors implemented
- ✅ UI integration complete

### Future Improvements (Post-Sprint 6)
- [ ] Embedded payment form (using PaymentIntent + Stripe Elements)
- [ ] Payment method storage for repeat customers
- [ ] Subscription payments
- [ ] Partial payments / payment plans
- [ ] Refund handling
- [ ] Dispute management
- [ ] Multi-currency support with dynamic exchange rates
- [ ] Apple Pay / Google Pay support
- [ ] Bank account payments (ACH)
- [ ] Invoice generation and emailing

## Troubleshooting

### Webhook Not Receiving Events
1. Check webhook URL is correct in Stripe Dashboard
2. Verify webhook secret matches `.env.local`
3. Check Stripe Dashboard webhook logs for delivery failures
4. For local testing, use Stripe CLI to forward events

### Payment Not Updating Status
1. Check webhook endpoint is publicly accessible
2. Verify webhook signature verification is passing
3. Check database for payment_events entries
4. Review server logs for errors

### Checkout Session Expired
- Default expiration: 24 hours
- Matches payment link expiration if set
- Create new session to retry payment

### PaymentIntent Reuse
- Existing PaymentIntents reused if in valid state
- States reused: `requires_payment_method`, `requires_confirmation`, `requires_action`
- New PaymentIntent created if existing one is `succeeded`, `canceled`, or `failed`

## API Reference

### Stripe Client Functions

```typescript
// lib/stripe/client.ts
export const stripe: Stripe // Singleton instance
export const webhookSecret: string
export function handleStripeError(error: any): ErrorResponse
export function toSmallestUnit(amount: number, currency: string): number
export function fromSmallestUnit(amount: number, currency: string): number
export function generateIdempotencyKey(paymentLinkId: string, prefix?: string): string
```

### Webhook Functions

```typescript
// lib/stripe/webhook.ts
export async function verifyWebhookSignature(payload: string | Buffer, signature: string): Promise<Stripe.Event | null>
export async function isEventProcessed(eventId: string, prisma: any): Promise<boolean>
export function extractPaymentLinkId(metadata?: Stripe.Metadata | null): string | null
export function extractOrganizationId(metadata?: Stripe.Metadata | null): string | null
```

## Sprint 6 Summary

**Status:** ✅ Complete

**Lines of Code Added:** ~1,500

**Files Created:**
- 2 utility files
- 3 API endpoints
- 2 result pages
- 2 updated UI components

**Test Coverage:**
- Manual testing completed
- Webhook testing with Stripe CLI
- Error scenarios handled

**Production Ready:** ✅ Yes (with proper environment configuration)

**Next Steps:** Proceed to Sprint 7 (Hedera Integration)













