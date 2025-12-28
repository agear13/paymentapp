# Stripe Integration - Quick Reference Card

## 🚀 Quick Start

```bash
# 1. Install dependencies (already done ✅)
npm install stripe @stripe/stripe-js

# 2. Configure environment
# Add to .env.local:
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# 3. Start webhook forwarding (local dev)
stripe listen --forward-to localhost:3000/api/stripe/webhook

# 4. Start dev server
npm run dev
```

## 📁 File Structure

```
src/
├── lib/stripe/
│   ├── client.ts           # Stripe SDK singleton + utilities
│   └── webhook.ts          # Webhook verification + helpers
│
├── app/api/stripe/
│   ├── create-payment-intent/route.ts    # Create PaymentIntent
│   ├── create-checkout-session/route.ts  # Create Checkout Session
│   └── webhook/route.ts                  # Process webhooks
│
├── app/(public)/pay/[shortCode]/
│   ├── success/page.tsx    # Success confirmation
│   └── canceled/page.tsx   # Cancellation page
│
└── components/public/
    └── stripe-payment-option.tsx  # Stripe payment UI
```

## 🔑 Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `STRIPE_SECRET_KEY` | Server-side API key | `sk_test_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client-side key | `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature | `whsec_...` |
| `NEXT_PUBLIC_APP_URL` | App base URL | `http://localhost:3000` |

## 🎯 API Endpoints

### Create Checkout Session (Primary Method)
```typescript
POST /api/stripe/create-checkout-session
Body: { paymentLinkId: "uuid" }
Response: { sessionId: "cs_xxx", url: "https://checkout.stripe.com/..." }
```

### Create PaymentIntent (For Embedded Forms)
```typescript
POST /api/stripe/create-payment-intent
Body: { paymentLinkId: "uuid" }
Response: { clientSecret: "pi_xxx_secret_xxx", paymentIntentId: "pi_xxx" }
```

### Webhook Handler
```typescript
POST /api/stripe/webhook
Headers: { "stripe-signature": "t=xxx,v1=xxx" }
Events: payment_intent.*, checkout.session.*
Response: { received: true, processed: true }
```

## 💳 Test Cards

| Purpose | Card Number | Result |
|---------|-------------|--------|
| **Success** | 4242 4242 4242 4242 | Payment succeeds |
| **Decline** | 4000 0000 0000 0002 | Card declined |
| **Insufficient** | 4000 0000 0000 9995 | Insufficient funds |
| **3D Secure** | 4000 0025 0000 3155 | Requires authentication |

**All test cards:**
- Expiry: Any future date
- CVC: Any 3 digits
- ZIP: Any 5 digits

## 🔄 Payment Flow (Quick)

```
1. Customer visits /pay/{shortCode}
   └─> Fetches payment link data

2. Selects Stripe payment
   └─> Clicks "Pay" button

3. POST /api/stripe/create-checkout-session
   └─> Returns Stripe Checkout URL

4. Redirects to Stripe Checkout
   └─> Customer enters card details

5. Stripe processes payment
   ├─> Success: Webhook fires (payment_intent.succeeded)
   │   └─> Updates payment_links.status = PAID
   │   └─> Creates payment_event (PAYMENT_CONFIRMED)
   │   └─> Redirects to /success page
   │
   └─> Cancel: Redirects to /canceled page
```

## 📊 Database Tables

### payment_events
```sql
event_type: 'PAYMENT_INITIATED' | 'PAYMENT_CONFIRMED' | 'PAYMENT_FAILED'
payment_method: 'STRIPE'
stripe_payment_intent_id: String?
amount_received: Decimal?
currency_received: String?
metadata: JSON (stripe_event_id, etc.)
```

### payment_links
```sql
status: 'OPEN' | 'PAID' | 'EXPIRED' | 'CANCELED'
stripe_payment_intent_id: Via payment_events
```

## 🛠️ Utility Functions

### Client (`lib/stripe/client.ts`)
```typescript
// Convert to smallest currency unit
toSmallestUnit(100.00, 'USD') → 10000 (cents)
toSmallestUnit(10000, 'JPY') → 10000 (yen, no conversion)

// Convert from smallest unit
fromSmallestUnit(10000, 'USD') → 100.00
fromSmallestUnit(10000, 'JPY') → 10000

// Error handling
handleStripeError(error) → { message, code, statusCode }

// Idempotency
generateIdempotencyKey(paymentLinkId) → "pi_uuid_timestamp"
```

### Webhook (`lib/stripe/webhook.ts`)
```typescript
// Verify signature
verifyWebhookSignature(payload, signature) → Stripe.Event | null

// Check if processed
isEventProcessed(eventId, prisma) → boolean

// Extract metadata
extractPaymentLinkId(metadata) → string | null
```

## 🔐 Security Checklist

- ✅ Webhook signature verification
- ✅ Idempotency protection
- ✅ Rate limiting (100 req/15min)
- ✅ Metadata validation
- ✅ PCI compliance (Stripe-hosted)
- ✅ HTTPS enforced
- ✅ Error messages sanitized

## 🧪 Testing Commands

```bash
# Start webhook forwarding
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger test events
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
stripe trigger checkout.session.completed

# Test API endpoint
curl -X POST http://localhost:3000/api/stripe/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{"paymentLinkId": "uuid-here"}'

# View Stripe logs
stripe logs tail
```

## 📝 Common Tasks

### Create Test Payment Link
```sql
INSERT INTO payment_links (
  id, organization_id, short_code, status, 
  amount, currency, description, expires_at
) VALUES (
  gen_random_uuid(), 'org-id', 'TEST1234', 'OPEN',
  100.00, 'USD', 'Test Payment', 
  NOW() + INTERVAL '24 hours'
);
```

### Configure Merchant for Stripe
```sql
UPDATE merchant_settings 
SET stripe_account_id = 'acct_test_123' 
WHERE organization_id = 'org-id';
```

### Check Payment Status
```sql
SELECT status FROM payment_links WHERE short_code = 'TEST1234';
```

### View Payment Events
```sql
SELECT event_type, payment_method, created_at 
FROM payment_events 
WHERE payment_link_id = (
  SELECT id FROM payment_links WHERE short_code = 'TEST1234'
)
ORDER BY created_at DESC;
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Webhook not working | Check webhook secret, use Stripe CLI for local dev |
| Payment not updating | Verify webhook signature, check logs |
| Checkout expired | Create new session (24hr default) |
| Card declined | Use different test card or check Stripe Dashboard |
| Rate limit hit | Wait or adjust limits in `lib/rate-limit.ts` |

## 🔗 Important URLs

| Resource | URL |
|----------|-----|
| **Stripe Dashboard** | https://dashboard.stripe.com |
| **API Keys** | https://dashboard.stripe.com/apikeys |
| **Webhooks** | https://dashboard.stripe.com/webhooks |
| **Payments** | https://dashboard.stripe.com/payments |
| **Events** | https://dashboard.stripe.com/events |
| **Docs** | https://stripe.com/docs |
| **Testing** | https://stripe.com/docs/testing |

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| `SPRINT6_STRIPE_INTEGRATION.md` | Complete implementation guide |
| `SPRINT6_TESTING_GUIDE.md` | Detailed testing procedures |
| `STRIPE_SETUP_CHECKLIST.md` | Setup steps for dev/prod |
| `STRIPE_PAYMENT_FLOW.md` | Visual flow diagrams |
| `STRIPE_QUICK_REFERENCE.md` | This document |

## 🎯 Key Points

1. **Checkout vs PaymentIntent**
   - Checkout: Hosted page (implemented ✅)
   - PaymentIntent: Embedded form (future)

2. **Webhook Security**
   - Always verify signature
   - Check idempotency
   - Validate metadata

3. **Currency Handling**
   - Most currencies: multiply by 100
   - Zero-decimal (JPY, KRW): use as-is

4. **Error Handling**
   - Client: toast notifications
   - Server: log + user-friendly message
   - Retry: 3 attempts with backoff

5. **Status Flow**
   - OPEN → PAID (success)
   - OPEN → EXPIRED (time)
   - OPEN → CANCELED (manual)

## ⚡ Quick Wins

```typescript
// Create checkout session
const response = await fetch('/api/stripe/create-checkout-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ paymentLinkId })
});
const { url } = await response.json();
window.location.href = url;

// Handle webhook
const event = await stripe.webhooks.constructEvent(
  body, signature, webhookSecret
);
if (event.type === 'payment_intent.succeeded') {
  // Update payment link to PAID
}

// Convert currency
const cents = toSmallestUnit(100.00, 'USD'); // → 10000
const dollars = fromSmallestUnit(10000, 'USD'); // → 100.00
```

## 🏁 Next Steps

- [ ] Test with real bank account (test mode)
- [ ] Configure production keys
- [ ] Register production webhook
- [ ] Deploy to staging
- [ ] Test end-to-end
- [ ] Deploy to production
- [ ] Monitor first transactions

---

**Sprint:** 6 ✅ Complete  
**Version:** 1.0  
**Last Updated:** December 5, 2025

For detailed information, see the full documentation in `docs/SPRINT6_STRIPE_INTEGRATION.md`













