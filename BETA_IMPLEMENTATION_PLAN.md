# Beta Sandbox Implementation - Complete Plan

**Status:** Implementation in Progress  
**Target:** Render Deployment  
**Date:** January 7, 2026

---

## 🎯 Implementation Summary

This document outlines the complete implementation of a robust, isolated beta sandbox for Provvypay on Render, enabling distribution partners to self-signup, test payments (Stripe + Hedera), and verify data consistency across all views.

---

## ✅ Completed Components

### 1. Environment Configuration ✅
**File:** `src/lib/config/env.ts`

- Zod-based environment validation
- Feature flags: `ENABLE_HEDERA_STABLECOINS`, `ENABLE_BETA_OPS`, `ENABLE_XERO_SYNC`
- Auto-detection of beta mode (Stripe test keys OR Hedera testnet)
- Typed configuration export
- Admin email allowlist support

### 2. Database Idempotency ✅
**File:** `prisma/migrations/add_idempotency_constraints.sql`

Added columns and constraints:
- `payment_events.stripe_event_id` (unique)
- `payment_events.stripe_payment_intent_id`
- `payment_events.stripe_checkout_session_id`
- `payment_events.hedera_tx_id` (unique)
- `payment_events.correlation_id` (for distributed tracing)
- Unique constraint: one PAYMENT_CONFIRMED per payment_link
- Similar correlation_id fields on `ledger_entries` and `xero_syncs`

### 3. Beta User Setup Script ✅
**File:** `scripts/setup-beta-user.ts`

Already implemented with:
- Organization creation
- Merchant settings with test credentials
- Ledger account seeding
- Optional sample payment links
- CLI flags: `--email`, `--name`, `--org`, `--with-links`

### 4. Documentation ✅
**Files Created:**
- `BETA_TESTING_OVERVIEW.md` - Complete overview
- `BETA_DEPLOYMENT_CHECKLIST.md` - Deployment steps
- `BETA_TESTING_SETUP_GUIDE.md` - Technical reference (50+ pages)
- `BETA_TESTER_QUICK_START.md` - User-friendly guide
- `RENDER_SPECIFIC_NOTES.md` - Render platform specifics
- `README_BETA_TESTING.md` - Quick reference
- `BETA_TESTING_INDEX.md` - Navigation hub
- `beta-env-template.txt` - Environment variables template

---

## 🚧 Components to Implement

### 5. Enhanced Stripe Webhook Handler
**File:** `src/app/api/stripe/webhook/route.ts`

**Current State:** Good foundation exists
**Needed Enhancements:**
1. Add correlation ID generation and logging
2. Ensure idempotency using new `stripe_event_id` column
3. Add structured logging with all IDs
4. Ensure atomic payment confirmation pipeline
5. Use config module for feature flags

**Key Changes:**
```typescript
// Generate correlation ID
const correlationId = `stripe_${event.id}_${Date.now()}`;

// Log with all context
log.info({
  correlationId,
  eventId: event.id,
  eventType: event.type,
  paymentLinkId,
  organizationId,
  stripePaymentIntentId,
  checkoutSessionId,
}, 'Processing Stripe webhook');

// Check idempotency
const existing = await prisma.payment_events.findUnique({
  where: { stripe_event_id: event.id }
});

if (existing) {
  return NextResponse.json({ received: true, duplicate: true });
}

// Atomic transaction for payment confirmation
await prisma.$transaction(async (tx) => {
  // 1. Update payment_link
  // 2. Create payment_event with stripe_event_id
  // 3. Create ledger entries
  // 4. Create xero_sync (if enabled)
});
```

### 6. Enhanced Hedera Confirmation Endpoint
**File:** `src/app/api/hedera/confirm/route.ts` (NEW)

**Purpose:** Explicit confirmation endpoint for Hedera payments

```typescript
POST /api/hedera/confirm
Body: {
  paymentLinkId: string;
  txId: string;
  token: 'HBAR' | 'USDC' | 'USDT' | 'AUDD';
}

Response: {
  success: boolean;
  paymentLink?: PaymentLink;
  error?: string;
}
```

**Implementation:**
1. Verify transaction via mirror node
2. Check recipient matches merchant account
3. Validate amount within tolerance
4. Check idempotency (hedera_tx_id)
5. Atomic confirmation pipeline
6. Return updated payment link

### 7. Beta Ops Panel
**Files:**
- `src/app/(dashboard)/admin/beta-ops/page.tsx` (NEW)
- `src/app/(dashboard)/admin/beta-ops/layout.tsx` (NEW)
- `src/lib/beta-ops/queries.ts` (NEW)

**Features:**
- Admin-only access (check email allowlist OR role)
- Recent Stripe webhook events (last 50)
- Recent Hedera confirmations (last 50)
- Recent Xero sync attempts (last 50)
- Real-time status indicators
- Filter by organization
- Search by payment_link_id

**Access Control:**
```typescript
// Check if user is admin
const user = await getUser();
if (!config.features.betaOps) {
  return redirect('/dashboard');
}

if (!isAdminEmail(user.email) && user.role !== 'ADMIN') {
  return redirect('/dashboard');
}
```

### 8. Feature Flag UI Updates
**Files to Update:**
- `src/components/public/hedera-payment-option.tsx`
- `src/components/dashboard/settings/merchant-settings-form.tsx`

**Changes:**
```typescript
// Only show HBAR by default in beta
const availableTokens = config.features.hederaStablecoins
  ? ['HBAR', 'USDC', 'USDT', 'AUDD']
  : ['HBAR'];

// Add testnet indicator
{config.hedera.isTestnet && (
  <div className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
    ⚠️ Testnet Mode - Use test tokens only
    <a href="https://portal.hedera.com/faucet" target="_blank">
      Get testnet HBAR →
    </a>
  </div>
)}
```

### 9. Correlation ID Service
**File:** `src/lib/services/correlation.ts` (NEW)

```typescript
export function generateCorrelationId(
  source: 'stripe' | 'hedera' | 'xero',
  reference: string
): string {
  return `${source}_${reference}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function extractCorrelationContext(correlationId: string) {
  const [source, reference, timestamp] = correlationId.split('_');
  return { source, reference, timestamp: parseInt(timestamp) };
}
```

### 10. Payment Confirmation Service
**File:** `src/lib/services/payment-confirmation.ts` (NEW)

Unified payment confirmation pipeline:
```typescript
export async function confirmPayment(params: {
  paymentLinkId: string;
  provider: 'stripe' | 'hedera';
  providerRef: string; // event_id or tx_id
  amountReceived: number;
  currencyReceived: string;
  metadata?: Record<string, any>;
  correlationId: string;
}): Promise<void> {
  // 1. Check idempotency
  // 2. Validate payment link state
  // 3. Atomic transaction:
  //    - Update payment_link
  //    - Create payment_event
  //    - Create ledger entries
  //    - Create xero_sync (if enabled)
  // 4. Log success with correlation ID
}
```

---

## 📋 Implementation Checklist

### Phase 1: Core Infrastructure ✅
- [x] Environment configuration module
- [x] Database migration for idempotency
- [x] Beta user setup script
- [x] Documentation suite

### Phase 2: Payment Pipeline (IN PROGRESS)
- [ ] Enhanced Stripe webhook handler
- [ ] Hedera confirmation endpoint
- [ ] Unified payment confirmation service
- [ ] Correlation ID service
- [ ] Update existing Hedera flow to use new endpoint

### Phase 3: Beta Ops Panel
- [ ] Admin route and layout
- [ ] Query service for ops data
- [ ] UI components for ops panel
- [ ] Access control middleware

### Phase 4: UX Improvements
- [ ] Feature flag UI updates
- [ ] Testnet indicators
- [ ] HBAR-only mode in beta
- [ ] Helpful error messages

### Phase 5: Testing & Validation
- [ ] End-to-end Stripe payment test
- [ ] End-to-end Hedera payment test
- [ ] Idempotency tests
- [ ] Beta ops panel access test
- [ ] Feature flag tests

---

## 🔧 Environment Variables for Render Beta

```bash
# ============================================================================
# BETA ENVIRONMENT - RENDER DEPLOYMENT
# ============================================================================

# Application
NEXT_PUBLIC_APP_URL=https://provvypay-beta.onrender.com
NODE_ENV=production

# Database (separate beta database recommended)
DATABASE_URL=postgresql://...beta_db...
DIRECT_URL=postgresql://...beta_db...

# Supabase (can use separate beta project)
NEXT_PUBLIC_SUPABASE_URL=https://your-beta-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Stripe (TEST MODE - CRITICAL!)
STRIPE_SECRET_KEY=sk_test_xxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Hedera (TESTNET - CRITICAL!)
NEXT_PUBLIC_HEDERA_NETWORK=testnet
NEXT_PUBLIC_HEDERA_MIRROR_NODE_URL=https://testnet.mirrornode.hedera.com
NEXT_PUBLIC_HEDERA_USDC_TOKEN_ID=0.0.429274
NEXT_PUBLIC_HEDERA_USDT_TOKEN_ID=0.0.429275

# Xero (Developer App)
XERO_CLIENT_ID=your-dev-app-client-id
XERO_CLIENT_SECRET=your-dev-app-secret
XERO_REDIRECT_URI=https://provvypay-beta.onrender.com/api/xero/callback

# Security
ENCRYPTION_KEY=base64-encoded-key
SESSION_SECRET=base64-encoded-key

# Feature Flags
ENABLE_HEDERA_PAYMENTS=true
ENABLE_HEDERA_STABLECOINS=false
ENABLE_XERO_SYNC=true
ENABLE_BETA_OPS=true

# Admin Access
ADMIN_EMAIL_ALLOWLIST=your-email@example.com,beta-tester@example.com

# Optional: Redis, Email, Sentry
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
RESEND_API_KEY=...
SENTRY_DSN=...
```

---

## 🚀 Deployment Steps

### 1. Database Migration
```bash
# Run on Render shell or locally against beta DB
psql $DATABASE_URL < prisma/migrations/add_idempotency_constraints.sql

# Or use Prisma
npx prisma db push
```

### 2. Deploy to Render
1. Create new web service from `beta` branch
2. Add all environment variables above
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Wait for deployment

### 3. Configure Webhooks
```bash
# Stripe
URL: https://provvypay-beta.onrender.com/api/stripe/webhook
Events: checkout.session.completed, payment_intent.succeeded

# Xero
Redirect URI: https://provvypay-beta.onrender.com/api/xero/callback
```

### 4. Setup Beta User
```bash
# Run on Render shell or locally
npx tsx scripts/setup-beta-user.ts \
  --email beta@example.com \
  --name "Beta Tester" \
  --with-links
```

### 5. Verify
- [ ] Homepage loads
- [ ] Can sign up
- [ ] Can complete onboarding
- [ ] Can create payment link
- [ ] Stripe payment works
- [ ] Hedera payment works
- [ ] Data appears in all tabs
- [ ] Beta ops panel accessible

---

## 📊 Success Metrics

### Functional Requirements
- [x] Separate beta environment on Render
- [x] Stripe test mode only
- [x] Hedera testnet only
- [x] Xero demo company support
- [ ] Idempotent payment processing
- [ ] Correlation ID tracing
- [ ] Beta ops panel for debugging
- [ ] HBAR-only mode by default

### Data Consistency
- [ ] Payment appears in Payment Links table immediately
- [ ] Transaction recorded in Transactions tab
- [ ] Ledger entries created (double-entry)
- [ ] Xero sync queued (if enabled)
- [ ] No duplicate payments possible
- [ ] Correlation IDs link all records

### User Experience
- [ ] Self-service signup works
- [ ] Onboarding flow smooth
- [ ] Payment confirmation < 10 seconds
- [ ] Clear testnet indicators
- [ ] Helpful error messages
- [ ] Mobile-responsive

---

## 🐛 Known Issues & Mitigations

### Issue: Webhook Delivery on Render Free Tier
**Problem:** Free tier spins down after inactivity
**Solution:** Use Starter plan ($7/month) for beta testing

### Issue: Hedera Testnet Rate Limits
**Problem:** Mirror node may rate limit frequent queries
**Solution:** Implement exponential backoff (already done)

### Issue: Xero Demo Company Expiry
**Problem:** Demo companies may expire
**Solution:** Document renewal process for beta testers

---

## 📚 Next Steps

1. **Complete Phase 2** (Payment Pipeline)
   - Implement enhanced webhook handler
   - Create Hedera confirmation endpoint
   - Build unified confirmation service

2. **Complete Phase 3** (Beta Ops Panel)
   - Build admin UI
   - Implement query service
   - Add access control

3. **Testing**
   - End-to-end payment flows
   - Idempotency verification
   - Feature flag validation

4. **Documentation Updates**
   - Add operator runbook
   - Update tester quick start
   - Create troubleshooting guide

---

## 🎯 Timeline Estimate

- **Phase 2:** 4-6 hours
- **Phase 3:** 3-4 hours
- **Phase 4:** 2-3 hours
- **Phase 5:** 2-3 hours
- **Total:** 11-16 hours

---

**Status:** Ready for Phase 2 implementation  
**Next Action:** Implement enhanced Stripe webhook handler with correlation IDs

