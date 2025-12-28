# Sprint 5: Public Pay Page - Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Customer Browser                          │
│                                                              │
│  https://provvypay.com/pay/ABC12345                        │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            │ HTTP GET
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Next.js App Router                              │
│                                                              │
│  Route: app/(public)/pay/[shortCode]/page.tsx               │
│  - Extracts shortCode from URL params                       │
│  - Fetches data from public API                             │
│  - Renders appropriate component based on status            │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            │ Internal API Call
                            ↓
┌─────────────────────────────────────────────────────────────┐
│         Public API Endpoint (No Auth)                        │
│                                                              │
│  Route: /api/public/pay/[shortCode]                         │
│  - Validates short code format                              │
│  - Queries database for payment link                        │
│  - Auto-expires if past expiresAt                           │
│  - Returns sanitized public data                            │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            │ Prisma Query
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL Database                             │
│                                                              │
│  Tables:                                                     │
│  - payment_links (main data)                                │
│  - organizations (merchant info)                            │
│  - merchant_settings (payment methods)                      │
│  - payment_events (status history)                          │
│  - fx_snapshots (exchange rates)                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Tree

```
PaymentPage (Main Route Component)
│
├─ [Loading State]
│   └─ Loader2 spinner + "Loading payment details..."
│
├─ [Not Found State]
│   └─ PaymentLinkNotFound
│       ├─ FileQuestion icon
│       ├─ "Payment Link Not Found" message
│       ├─ Short code display
│       └─ Help text
│
├─ [Expired State]
│   └─ PaymentLinkExpired
│       ├─ Clock icon (amber)
│       ├─ Expiry time (relative)
│       ├─ Payment details card
│       └─ "Contact merchant" CTA
│
├─ [Canceled State]
│   └─ PaymentLinkCanceled
│       ├─ XCircle icon (red)
│       ├─ Cancellation message
│       ├─ Payment details card
│       └─ "Contact merchant" CTA
│
├─ [Paid State]
│   └─ PaymentLinkPaid
│       ├─ CheckCircle2 icon (green)
│       ├─ Payment confirmation
│       ├─ Payment details with date/method
│       └─ Thank you message
│
└─ [Open State - Active Payment]
    └─ PaymentPageContent
        ├─ PaymentProgressIndicator
        │   ├─ Step 1: Select Method (active)
        │   ├─ Step 2: Processing
        │   └─ Step 3: Complete
        │
        ├─ Card Header
        │   └─ MerchantBranding
        │       ├─ Building2 icon
        │       ├─ Merchant name
        │       └─ "Secure Payment Request"
        │
        ├─ Card Content
        │   ├─ PaymentAmountDisplay
        │   │   ├─ Currency label
        │   │   ├─ Large amount ($150.00)
        │   │   ├─ Description
        │   │   └─ Invoice reference (optional)
        │   │
        │   └─ PaymentMethodSelector
        │       ├─ StripePaymentOption
        │       │   ├─ CreditCard icon (blue)
        │       │   ├─ "Credit / Debit Card"
        │       │   ├─ Feature badges
        │       │   ├─ Hover state
        │       │   ├─ Selected state (checkmark)
        │       │   └─ Disabled state (if unavailable)
        │       │
        │       └─ HederaPaymentOption
        │           ├─ Wallet icon (purple)
        │           ├─ "Crypto Wallet" + Web3 badge
        │           ├─ Feature badges
        │           ├─ Hover state
        │           ├─ Selected state (checkmark)
        │           └─ Disabled state (if unavailable)
        │
        └─ Security Footer
            ├─ Lock icon + "Secure Payment"
            └─ Shield icon + "PCI Compliant"
```

---

## Data Flow

### 1. Page Load Flow

```
User visits URL
     ↓
Extract shortCode from params
     ↓
Set loadingState = 'loading'
     ↓
Fetch /api/public/pay/[shortCode]
     ↓
┌────────────────┐
│ API Processing │
├────────────────┤
│ 1. Validate    │
│ 2. Query DB    │
│ 3. Check expiry│
│ 4. Update if   │
│    expired     │
│ 5. Get merchant│
│    settings    │
│ 6. Return data │
└───────┬────────┘
        │
        ↓
   [Response OK?]
        │
    ┌───┴───┐
   Yes      No
    │        │
    ↓        ↓
Set data   Set not_found
    │
    ↓
Check status
    │
    ├─ DRAFT → Not Found
    ├─ OPEN → PaymentPageContent
    ├─ EXPIRED → PaymentLinkExpired
    ├─ CANCELED → PaymentLinkCanceled
    └─ PAID → PaymentLinkPaid
```

### 2. Payment Method Selection Flow

```
User hovers over payment option
     ↓
onHoverStart() called
     ↓
Set hoveredMethod state
     ↓
Border color changes (blue/purple-300)
Shadow appears
     ↓
User clicks option
     ↓
onSelect() called
     ↓
Set selectedMethod state
     ↓
Visual changes:
  - Border: blue/purple-600
  - Background: blue/purple-50
  - Checkmark appears
  - Info panel shows below
     ↓
[Ready for Sprint 6/8]
Create PaymentIntent (Stripe)
    or
Connect Wallet (Hedera)
```

---

## State Management

### Component State (useState)

```typescript
// PaymentPage (main route)
const [loadingState, setLoadingState] = useState<LoadingState>('loading');
const [paymentLink, setPaymentLink] = useState<PaymentLinkData | null>(null);

// PaymentPageContent
const [currentStep, setCurrentStep] = useState<PaymentStep>('select_method');
const [selectedMethod, setSelectedMethod] = useState<'stripe' | 'hedera' | null>(null);

// PaymentMethodSelector
const [hoveredMethod, setHoveredMethod] = useState<'stripe' | 'hedera' | null>(null);
```

### Server State (Database)

```typescript
// Payment Link Status (enum)
type Status = 'DRAFT' | 'OPEN' | 'PAID' | 'EXPIRED' | 'CANCELED';

// Transitions
DRAFT → OPEN (when merchant publishes)
OPEN → EXPIRED (auto, when past expiresAt)
OPEN → CANCELED (manual, by merchant)
OPEN → PAID (when payment confirmed)

// Status Check Priority
1. Check if DRAFT → 404
2. Check if expired but still OPEN → update to EXPIRED
3. Return current status
```

---

## API Contract

### Endpoint

```
GET /api/public/pay/[shortCode]
```

### Request

```typescript
// No body, no headers required (public endpoint)
// Rate limited by IP address
```

### Response: Success (200)

```typescript
{
  data: {
    id: string;                    // Payment link UUID
    shortCode: string;             // 8-char code
    status: PaymentLinkStatus;     // Current status
    amount: string;                // "150.00"
    currency: string;              // "AUD"
    description: string;           // Invoice description
    invoiceReference: string | null;
    expiresAt: string | null;      // ISO 8601 timestamp
    createdAt: string;             // ISO 8601 timestamp
    merchant: {
      name: string;                // Display name
    };
    availablePaymentMethods: {
      stripe: boolean;             // Has stripeAccountId
      hedera: boolean;             // Has hederaAccountId
    };
    fxSnapshot: FxSnapshot | null; // Latest CREATION snapshot
    lastEvent: PaymentEvent | null; // Most recent event
  }
}
```

### Response: Not Found (404)

```typescript
{
  error: "Payment link not found",
  code: "NOT_FOUND"
}
```

### Response: Invalid Format (400)

```typescript
{
  error: "Invalid short code format"
}
```

### Response: Rate Limited (429)

```typescript
{
  error: "Rate limit exceeded"
}
```

---

## Security Architecture

### Public Access Control

```
┌─────────────────────────────────────┐
│     Payment Link Status             │
├─────────────────────────────────────┤
│ DRAFT   → 404 (not public)          │
│ OPEN    → Show payment page ✓       │
│ PAID    → Show confirmation ✓       │
│ EXPIRED → Show expired message ✓    │
│ CANCELED→ Show canceled message ✓   │
└─────────────────────────────────────┘
```

### Rate Limiting Strategy

```typescript
// Limit: 100 requests per minute per IP
// Type: 'public' (less strict than 'api')
// Storage: Upstash Redis

if (requestCount > limit) {
  return 429;
}
```

### Data Exposure

```
Exposed (Public):
✓ amount, currency, description
✓ merchant display name
✓ invoice reference
✓ expiry date
✓ status, dates
✓ available payment methods (boolean)

Hidden (Private):
✗ organizationId
✗ merchant email/phone
✗ stripeAccountId (actual value)
✗ hederaAccountId (actual value)
✗ internal IDs
✗ customer email/phone (if set)
```

---

## Responsive Design Breakpoints

```css
/* Mobile (< 640px) */
- Full width cards
- Stack elements vertically
- Hide progress labels
- Larger touch targets (48px min)
- Single column layout

/* Tablet (640px - 1024px) */
- Max width: 28rem (448px)
- Show progress labels
- Two-column possible for some elements
- Standard padding

/* Desktop (> 1024px) */
- Max width: 42rem (672px)
- Centered layout
- Optimal reading width
- Enhanced hover states
```

---

## Accessibility Features

### Keyboard Navigation

```
Tab Order:
1. Payment method option 1 (Stripe)
2. Payment method option 2 (Hedera)
3. (Future: Payment button)

Actions:
- Tab/Shift+Tab: Navigate
- Enter/Space: Select
- Esc: (Future: Close modals)
```

### Screen Reader Support

```html
<!-- Progress Indicator -->
<div role="progressbar" aria-valuenow="1" aria-valuemin="1" aria-valuemax="3">

<!-- Payment Method Selector -->
<div role="radiogroup" aria-label="Payment method selection">
  
  <!-- Individual Options -->
  <button 
    role="radio" 
    aria-checked="true"
    aria-disabled="false"
    aria-label="Pay with credit or debit card via Stripe"
    tabIndex="0"
  >
```

### Focus Management

```css
/* Visible focus rings */
.focus:outline-none
.focus:ring-2
.focus:ring-blue-500
.focus:ring-offset-2

/* Focus-visible for mouse users */
.focus-visible:ring-blue-500
```

---

## Performance Optimizations

### Client-Side Rendering

```typescript
// Only client components that need interactivity
'use client';

// Server components for static content (future)
// Server-side rendering for initial load (future)
```

### API Optimization

```typescript
// Single query with includes
const paymentLink = await prisma.paymentLink.findUnique({
  where: { shortCode },
  include: {
    organization: { select: { id: true, name: true } },
    paymentEvents: { orderBy: { createdAt: 'desc' }, take: 5 },
    fxSnapshots: { where: { snapshotType: 'CREATION' }, take: 1 },
  },
});

// Separate query for merchant settings (only if link found)
const merchantSettings = await prisma.merchantSettings.findFirst({...});
```

### Bundle Size

```
Components are tree-shakeable
Lucide icons imported individually
Tailwind purges unused CSS
No heavy dependencies
```

---

## Error Handling

### Client-Side Errors

```typescript
try {
  const response = await fetch(`/api/public/pay/${shortCode}`);
  if (!response.ok) {
    if (response.status === 404) {
      setLoadingState('not_found');
    } else {
      setLoadingState('error');
    }
    return;
  }
  setPaymentLink(result.data);
  setLoadingState('found');
} catch (error) {
  console.error('Failed to fetch payment link:', error);
  setLoadingState('error');
}
```

### Server-Side Errors

```typescript
try {
  // ... API logic
} catch (error: any) {
  log.api.error(
    { error: error.message, shortCode },
    'Failed to fetch public payment link'
  );
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

---

## Future Enhancements (Not in Sprint 5)

### Sprint 6 Integration
- Stripe PaymentIntent creation
- Stripe Checkout redirect
- Success/cancel return handling

### Sprint 8 Integration
- HashPack wallet connection
- Crypto amount display
- Transaction monitoring

### Sprint 9 Integration
- Real-time status polling (3s interval)
- Automatic UI updates
- Payment confirmation flow

### Additional Features (Post-MVP)
- QR code display on page
- Multiple language support
- Custom merchant branding (colors, logos)
- Payment receipt download
- Email receipt sending
- Share payment link functionality

---

## Monitoring & Logging

### Logged Events

```typescript
// Successful fetch
log.api.info({
  shortCode,
  paymentLinkId,
  status,
}, 'Public payment link fetched');

// Not found
log.api.warn({ shortCode }, 'Payment link not found');

// Error
log.api.error({
  error,
  shortCode,
}, 'Failed to fetch public payment link');
```

### Metrics to Track (Future)

- Page load time
- API response time
- Conversion rate (view → payment)
- Payment method selection distribution
- Error rate by status code
- Mobile vs desktop usage

---

This architecture provides a solid foundation for the public payment experience, with clear separation of concerns, strong type safety, and excellent user experience across all devices and accessibility needs.













