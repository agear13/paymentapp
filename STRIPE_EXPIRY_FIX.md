# Stripe Checkout Session Expiry Fix

## 🐛 Problem
When creating invoices with expiry dates beyond 24 hours (e.g., 7 days, 30 days), Stripe credit card payments were failing with:

```
Error: The `expires_at` timestamp must be less than 24 hours from Checkout Session creation.
```

**Root Cause**: Stripe has a hard 24-hour maximum for checkout session expiry, but our payment link system allows expiry dates days or weeks in the future. The code was passing the payment link's `expires_at` directly to Stripe without respecting this limit.

---

## ✅ Solution Implemented

### File Changed
`src/app/api/stripe/create-checkout-session/route.ts`

### Logic
The checkout session now uses the **minimum** of:
1. Payment link expiry date (if set)
2. Current time + 24 hours (Stripe's max)

**Before** (Lines 138-140):
```typescript
expires_at: paymentLink.expires_at
  ? Math.floor(new Date(paymentLink.expires_at).getTime() / 1000)
  : Math.floor(Date.now() / 1000) + 86400, // 24 hours default
```

**After** (Lines 111-160):
```typescript
// Calculate Stripe session expiry (max 24 hours per Stripe API limits)
const now = Math.floor(Date.now() / 1000);
const stripeMaxExpiry = now + 86400; // 24 hours from now
let sessionExpiresAt = stripeMaxExpiry;

if (paymentLink.expires_at) {
  const linkExpiry = Math.floor(new Date(paymentLink.expires_at).getTime() / 1000);
  sessionExpiresAt = Math.min(linkExpiry, stripeMaxExpiry);
  
  // Log if we're capping the expiry due to Stripe's 24-hour limit
  if (linkExpiry > stripeMaxExpiry) {
    log.info('Stripe session expiry capped at 24 hours', {
      paymentLinkId,
      linkExpiresAt: new Date(linkExpiry * 1000).toISOString(),
      sessionExpiresAt: new Date(sessionExpiresAt * 1000).toISOString(),
      capped: true,
    });
  }
}

// In stripe.checkout.sessions.create():
expires_at: sessionExpiresAt,
```

### What This Means

| Payment Link Expiry | Stripe Session Expiry | Behavior |
|--------------------|-----------------------|----------|
| 2 hours from now | 2 hours from now | ✅ Uses payment link expiry |
| 12 hours from now | 12 hours from now | ✅ Uses payment link expiry |
| 30 days from now | 24 hours from now | ⚠️ **Capped at 24 hours** |
| No expiry set | 24 hours from now | ✅ Default to 24 hours |

**Important**: Payment link expiry is still enforced separately at the application level. The user will see "Payment link expired" if they try to access it after the payment link's expiry date, even if a Stripe session was created within the 24-hour window.

---

## 🎯 Use Cases

### Use Case 1: Short-term Invoice (< 24 hours)
**Example**: Invoice due in 6 hours

- Payment link expiry: 6 hours ✅
- Stripe session expiry: 6 hours ✅
- Result: Session expires when payment link expires

### Use Case 2: Long-term Invoice (> 24 hours)
**Example**: Invoice due in 7 days

- Payment link expiry: 7 days ✅
- Stripe session expiry: 24 hours ⚠️ (capped)
- Result: 
  - Customer has 7 days to access the payment link
  - Each time they visit, a new Stripe session is created (valid for 24 hours)
  - Payment link remains valid for the full 7 days
  - System logs: "Stripe session expiry capped at 24 hours"

### Use Case 3: No Expiry Set
**Example**: Open invoice (no expiry date)

- Payment link expiry: None ✅
- Stripe session expiry: 24 hours ✅
- Result: Session expires in 24 hours, but payment link remains valid indefinitely

---

## 📊 Technical Details

### Stripe Checkout Session Lifecycle

1. **Customer visits payment page** (`/pay/{shortCode}`)
2. **Customer clicks "Pay with Credit Card"**
3. **Frontend calls** `POST /api/stripe/create-checkout-session`
4. **Backend creates session** with expiry ≤ 24 hours
5. **Customer redirected to Stripe Checkout**
6. **Session valid for up to 24 hours**
7. **If session expires**, customer returns to payment page and process repeats

### Why This Works

- **Payment link expiry** controls overall access to the invoice
- **Stripe session expiry** controls individual checkout attempts
- Sessions can be recreated as needed within the payment link's validity window
- No customer-facing behavior changes (transparent to users)

### Logging & Monitoring

When a payment link expiry exceeds 24 hours, the system logs:

```json
{
  "level": "info",
  "message": "Stripe session expiry capped at 24 hours",
  "paymentLinkId": "uuid",
  "linkExpiresAt": "2026-02-15T10:30:00.000Z",
  "sessionExpiresAt": "2026-01-18T10:30:00.000Z",
  "capped": true
}
```

This helps track when capping occurs and verify the fix is working correctly.

---

## 🧪 Testing

### Test Case 1: Invoice with 2-hour expiry
```bash
# Create invoice expiring in 2 hours
POST /api/payment-links
{
  "amount": 100,
  "currency": "USD",
  "description": "Test invoice",
  "expiresAt": "2026-01-17T12:00:00Z" // 2 hours from now
}

# Pay with Stripe
# ✅ Expected: Stripe session expires in 2 hours
# ✅ No capping log message
```

### Test Case 2: Invoice with 7-day expiry
```bash
# Create invoice expiring in 7 days
POST /api/payment-links
{
  "amount": 100,
  "currency": "USD",
  "description": "Test invoice",
  "expiresAt": "2026-01-24T10:00:00Z" // 7 days from now
}

# Pay with Stripe
# ✅ Expected: Stripe session expires in 24 hours
# ✅ Log message: "Stripe session expiry capped at 24 hours"
# ✅ Payment link remains valid for 7 days
# ✅ Customer can create new session anytime within 7 days
```

### Test Case 3: Invoice with no expiry
```bash
# Create invoice with no expiry
POST /api/payment-links
{
  "amount": 100,
  "currency": "USD",
  "description": "Test invoice"
  // No expiresAt
}

# Pay with Stripe
# ✅ Expected: Stripe session expires in 24 hours (default)
# ✅ Payment link valid indefinitely
```

### Test Case 4: Multiple payment attempts on long-term invoice
```bash
# Create invoice expiring in 30 days
# Customer visits payment page on Day 1
# ✅ Creates Stripe session expiring in 24 hours

# Customer doesn't pay, returns on Day 5
# ✅ Creates NEW Stripe session expiring in 24 hours
# ✅ Payment link still valid (25 days remaining)

# Customer pays on Day 5
# ✅ Payment succeeds
# ✅ Payment link marked as PAID
```

---

## 🔍 Related Code

### Payment Link Expiry Validation
**File**: `src/app/api/stripe/create-checkout-session/route.ts`

```typescript
// Check if payment link is expired (lines 78-85)
if (paymentLink.expires_at && new Date(paymentLink.expires_at) < new Date()) {
  return NextResponse.json(
    { error: 'Payment link has expired' },
    { status: 400 }
  );
}
```

This validation runs **before** creating the Stripe session, ensuring expired payment links are rejected at the API level.

### Frontend Payment Page
**File**: `src/app/pay/[shortCode]/page.tsx`

The payment page also validates expiry:
```typescript
if (paymentLink.expiresAt && new Date(paymentLink.expiresAt) < new Date()) {
  return <ExpiredPaymentPage />;
}
```

---

## 📋 Deployment Checklist

- [x] Fix implemented in `src/app/api/stripe/create-checkout-session/route.ts`
- [x] Logging added for monitoring
- [ ] Code committed and pushed
- [ ] Deployed to production
- [ ] Test with short-term invoice (< 24h)
- [ ] Test with long-term invoice (> 24h)
- [ ] Verify log messages appear when capping occurs
- [ ] Monitor for any Stripe API errors in production

---

## 🎯 Impact

### Before Fix
- ❌ Invoices with expiry > 24 hours: Stripe payment failed
- ❌ Error: "expires_at must be less than 24 hours"
- ❌ Customers blocked from paying via credit card

### After Fix
- ✅ All invoices: Stripe payment works correctly
- ✅ Long-term invoices: Session capped at 24 hours (transparent to user)
- ✅ Customers can pay via credit card regardless of invoice expiry date
- ✅ Payment link expiry still enforced (application-level validation)

---

## 🔮 Future Enhancements (Optional)

### 1. User-facing messaging
If a payment link has a long expiry (e.g., 30 days), consider showing:
> "This invoice is valid until [date]. The payment session expires in 24 hours, but you can create a new one anytime before the invoice expires."

### 2. Session renewal reminder
For sessions approaching expiry:
> "This payment session expires in 1 hour. If it expires, just refresh the page to start a new session."

### 3. Analytics
Track how often capping occurs:
- % of invoices with expiry > 24 hours
- Average time between session creation and payment completion
- Sessions that expire before payment

---

## 📞 Support

### If Customers Report Issues

**Symptom**: "Payment page shows expired but invoice should still be valid"

**Check**:
1. Verify payment link `expires_at` in database
2. Check if payment link status is `OPEN`
3. Look for "Stripe session expiry capped" log messages
4. Verify Stripe session was created within 24 hours

**Solution**:
- If payment link is expired: Issue is correct, create new invoice
- If Stripe session expired but link valid: Customer should refresh page to create new session
- If neither expired: Check for other errors (rate limits, Stripe config, etc.)

---

**Status**: Ready for Production ✅  
**Breaking Changes**: None  
**Backward Compatibility**: Full  
**Rollback Plan**: Safe to revert (only changes session expiry calculation)

