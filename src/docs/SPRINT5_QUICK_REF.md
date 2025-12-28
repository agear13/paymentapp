# Sprint 5: Public Pay Page - Quick Reference

**Route:** `/pay/[shortCode]`  
**API:** `/api/public/pay/[shortCode]`  
**Status:** ✅ Production Ready

---

## Quick Links

- **Main Page:** `app/(public)/pay/[shortCode]/page.tsx`
- **API Endpoint:** `app/api/public/pay/[shortCode]/route.ts`
- **Components:** `components/public/*.tsx`
- **Full Documentation:** `SPRINT5_COMPLETE.md`

---

## Usage Examples

### Testing Payment Page Locally

```bash
# Visit a payment page
http://localhost:3000/pay/ABC12345

# The page will:
# 1. Validate short code format
# 2. Fetch payment link from API
# 3. Check status and expiry
# 4. Display appropriate UI
```

### API Response Structure

```typescript
GET /api/public/pay/[shortCode]

Response {
  data: {
    id: string;
    shortCode: string;
    status: 'OPEN' | 'PAID' | 'EXPIRED' | 'CANCELED';
    amount: string;
    currency: string;
    description: string;
    invoiceReference: string | null;
    expiresAt: string | null;
    merchant: {
      name: string;
    };
    availablePaymentMethods: {
      stripe: boolean;
      hedera: boolean;
    };
    fxSnapshot: {...} | null;
    lastEvent: {...} | null;
  }
}
```

---

## Component Quick Reference

### State Components

```tsx
// 404 - Invalid short code
<PaymentLinkNotFound shortCode="ABC12345" />

// Expired payment link
<PaymentLinkExpired paymentLink={data} />

// Canceled by merchant
<PaymentLinkCanceled paymentLink={data} />

// Already paid
<PaymentLinkPaid paymentLink={data} />
```

### Payment UI Components

```tsx
// Main payment interface (OPEN status)
<PaymentPageContent paymentLink={data} />

// Individual components
<PaymentProgressIndicator currentStep="select_method" />
<MerchantBranding merchantName="Acme Corp" />
<PaymentAmountDisplay amount="150.00" currency="AUD" description="..." />
<PaymentMethodSelector availablePaymentMethods={{stripe: true, hedera: true}} />
```

---

## Status Flow

```
User visits /pay/ABC12345
         ↓
API validates short code
         ↓
     [Invalid] → PaymentLinkNotFound (404)
         ↓
     [Valid] → Fetch payment link
         ↓
   Check status & expiry
         ↓
  ┌──────┴──────┐
  ↓             ↓
DRAFT      Auto-expire if past expiresAt
  ↓             ↓
  404     OPEN → EXPIRED
         ↓
    Route to state component:
    • OPEN → PaymentPageContent
    • EXPIRED → PaymentLinkExpired
    • CANCELED → PaymentLinkCanceled
    • PAID → PaymentLinkPaid
```

---

## Payment Method Selection

### Available Methods Check

Payment methods shown based on `merchantSettings`:
- **Stripe:** Requires `stripeAccountId`
- **Hedera:** Requires `hederaAccountId`

### Selection States

```tsx
// Not selected - White background, border-slate-200
// Hovered - border-blue-300, shadow-sm
// Selected - border-blue-600, bg-blue-50, shadow-md
// Disabled - opacity-60, cursor-not-allowed
```

### Keyboard Navigation

- `Tab` - Move between payment methods
- `Enter/Space` - Select payment method
- `Shift+Tab` - Move backwards

---

## Styling Guide

### Color Themes

**Stripe Option:**
- Primary: `blue-600`
- Background: `blue-50`
- Hover: `blue-300`

**Hedera Option:**
- Primary: `purple-600`
- Background: `purple-50`
- Hover: `purple-300`

**States:**
- Success: `green-600`
- Warning: `amber-600`
- Error: `red-600`
- Neutral: `slate-600`

### Responsive Breakpoints

```css
/* Mobile first (default) */
padding: 1rem;

/* Small screens and up (640px+) */
sm:padding: 1.5rem;
sm:inline (show labels);

/* Medium screens and up (768px+) */
md:padding: 2rem;

/* Large screens and up (1024px+) */
lg:max-w-2xl;
```

---

## Accessibility Checklist

✅ Keyboard Navigation
- All interactive elements focusable
- Logical tab order
- Enter/Space activation

✅ Screen Readers
- ARIA labels on all controls
- Proper role attributes
- Alt text on icons (via aria-label)

✅ Visual
- Focus rings visible
- Color contrast meets WCAG AA
- Text scalable

✅ Semantic HTML
- Proper heading hierarchy
- Button vs div distinction
- Form semantics

---

## Testing Commands

### Manual Testing

```bash
# 1. Start dev server
npm run dev

# 2. Create a test payment link in dashboard
# (Generates short code like "XYZ789AB")

# 3. Visit payment page
# http://localhost:3000/pay/XYZ789AB

# 4. Test states by changing link status in database
```

### Database Status Updates (for testing)

```sql
-- Set to EXPIRED
UPDATE payment_links SET status = 'EXPIRED' WHERE short_code = 'ABC12345';

-- Set to CANCELED
UPDATE payment_links SET status = 'CANCELED' WHERE short_code = 'ABC12345';

-- Set to PAID
UPDATE payment_links SET status = 'PAID' WHERE short_code = 'ABC12345';

-- Back to OPEN
UPDATE payment_links SET status = 'OPEN' WHERE short_code = 'ABC12345';
```

---

## Common Issues & Solutions

### Issue: 404 on valid short code
**Solution:** Check database - link might be in DRAFT status (not publicly accessible)

### Issue: Payment methods disabled
**Solution:** Check merchantSettings table for stripeAccountId and hederaAccountId

### Issue: Auto-expiry not working
**Solution:** API checks expiry on every request and updates status automatically

### Issue: Styling looks different in production
**Solution:** Ensure Tailwind purge settings don't remove used classes

---

## Integration with Other Sprints

### Sprint 3 (Payment Link Creation)
- Creates links with short codes
- Sets initial status to DRAFT
- Generates QR codes pointing to `/pay/[shortCode]`

### Sprint 4 (Dashboard)
- Merchants can view payment link
- Copy URL button copies `/pay/[shortCode]` URL
- "View Public Page" opens payment page in new tab

### Sprint 6 (Stripe Integration) - TODO
- StripePaymentOption will trigger PaymentIntent creation
- Redirect to Stripe Checkout
- Handle webhook confirmation

### Sprint 8 (Hedera Integration) - TODO
- HederaPaymentOption will show wallet connect
- Display crypto amount calculation
- Monitor transactions

---

## Environment Variables

None required for Sprint 5 (public pages only).

Stripe and Hedera integrations (Sprints 6-8) will need:
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_HEDERA_NETWORK`
- etc.

---

## File Locations

```
src/
├── app/
│   ├── (public)/
│   │   ├── layout.tsx
│   │   └── pay/
│   │       └── [shortCode]/
│   │           └── page.tsx
│   └── api/
│       └── public/
│           └── pay/
│               └── [shortCode]/
│                   └── route.ts
└── components/
    └── public/
        ├── payment-page-content.tsx
        ├── payment-amount-display.tsx
        ├── merchant-branding.tsx
        ├── payment-progress-indicator.tsx
        ├── payment-method-selector.tsx
        ├── stripe-payment-option.tsx
        ├── hedera-payment-option.tsx
        ├── payment-link-not-found.tsx
        ├── payment-link-expired.tsx
        ├── payment-link-canceled.tsx
        └── payment-link-paid.tsx
```

---

## Performance Tips

1. **Image Optimization:** When adding merchant logos, use Next.js `<Image>` component
2. **Font Loading:** System fonts used by default for fast loading
3. **Bundle Size:** Components are client-side only where needed
4. **Caching:** API responses are dynamic (no caching) to ensure status accuracy

---

## Security Notes

✅ **Rate Limiting:** Public API is rate limited  
✅ **Validation:** Short code format validated  
✅ **Data Sanitization:** Only public data exposed  
✅ **No Auth Bypass:** DRAFT links return 404  
✅ **XSS Protection:** All user input escaped  

---

**Need help?** See full documentation in `SPRINT5_COMPLETE.md`













