# Payment Links - Quick Reference Guide

**Sprint 3 Implementation** | **Production Ready**

---

## 📋 Table of Contents
1. [API Endpoints](#api-endpoints)
2. [Component Usage](#component-usage)
3. [Utilities](#utilities)
4. [State Machine](#state-machine)
5. [Common Patterns](#common-patterns)

---

## API Endpoints

### List Payment Links
```typescript
GET /api/payment-links?organizationId={id}&status={status}&currency={currency}&search={query}&page={n}&limit={n}

Response: {
  data: PaymentLink[],
  pagination: { page, limit, total, totalPages }
}
```

### Create Payment Link
```typescript
POST /api/payment-links
Body: {
  organizationId: string,
  amount: number,
  currency: string,
  description: string,
  invoiceReference?: string,
  customerEmail?: string,
  customerPhone?: string,
  expiresAt?: string
}

Response: { data: PaymentLink, message: string }
```

### Get Payment Link Details
```typescript
GET /api/payment-links/{id}

Response: {
  data: PaymentLink & {
    paymentEvents: [],
    fxSnapshots: [],
    ledgerEntries: [],
    xeroSyncs: []
  }
}
```

### Update Payment Link (DRAFT only)
```typescript
PATCH /api/payment-links/{id}
Body: Partial<PaymentLink>

Response: { data: PaymentLink, message: string }
```

### Cancel Payment Link
```typescript
DELETE /api/payment-links/{id}

Response: { data: PaymentLink, message: string }
```

### Transition Status
```typescript
POST /api/payment-links/{id}/status
Body: { status: PaymentLinkStatus }

Response: { data: PaymentLink, message: string }
```

### Get QR Code
```typescript
GET /api/payment-links/{id}/qr-code?format={dataurl|png|svg}&download={true|false}&size={300}

Response: { data: { qrCode: string, shortCode: string } }
// OR binary image data (when format=png|svg)
```

---

## Component Usage

### Create Payment Link Dialog

```tsx
import { CreatePaymentLinkDialog } from '@/components/payment-links/create-payment-link-dialog';

<CreatePaymentLinkDialog
  organizationId="org-id"
  defaultCurrency="USD"
  onSuccess={(paymentLink) => {
    console.log('Created:', paymentLink);
  }}
  trigger={<Button>Create Link</Button>}
/>
```

### Payment Links Table

```tsx
import { PaymentLinksTable } from '@/components/payment-links/payment-links-table';

<PaymentLinksTable
  paymentLinks={paymentLinks}
  onViewDetails={(link) => setSelectedLink(link)}
  onCancel={(link) => handleCancel(link)}
  onRefresh={() => fetchPaymentLinks()}
/>
```

### Payment Links Filters

```tsx
import { PaymentLinksFilters } from '@/components/payment-links/payment-links-filters';

<PaymentLinksFilters
  filters={{ status: 'OPEN', currency: 'USD', search: '' }}
  onFiltersChange={(filters) => setFilters(filters)}
  onReset={() => setFilters({})}
/>
```

### Payment Link Detail Dialog

```tsx
import { PaymentLinkDetailDialog } from '@/components/payment-links/payment-link-detail-dialog';

<PaymentLinkDetailDialog
  paymentLink={selectedLink}
  open={dialogOpen}
  onOpenChange={setDialogOpen}
/>
```

### Currency Select

```tsx
import { CurrencySelect } from '@/components/payment-links/currency-select';

<CurrencySelect
  value="USD"
  onValueChange={(currency) => setCurrency(currency)}
  includeCrypto={false}
/>
```

---

## Utilities

### Short Code Generator

```typescript
import { generateUniqueShortCode, isValidShortCode, isShortCodeAvailable } from '@/lib/short-code';

// Generate unique code
const shortCode = await generateUniqueShortCode();
// Returns: "Abc12-_X"

// Validate format
const isValid = isValidShortCode("Test1234"); // true

// Check availability
const available = await isShortCodeAvailable("Test1234");
```

### QR Code Generator

```typescript
import {
  generateQRCodeDataUrl,
  generateQRCodeBuffer,
  generateQRCodeSVG,
  getPaymentLinkUrl,
  getQRCodeFilename
} from '@/lib/qr-code';

// Data URL for display
const dataUrl = await generateQRCodeDataUrl(shortCode, {
  size: 300,
  errorCorrectionLevel: 'M'
});

// Buffer for download
const buffer = await generateQRCodeBuffer(shortCode);

// SVG string
const svg = await generateQRCodeSVG(shortCode);

// Payment URL
const url = getPaymentLinkUrl(shortCode);
// Returns: "https://app.com/pay/Abc12-_X"

// Filename
const filename = getQRCodeFilename(shortCode, "INV-001");
// Returns: "qr-INV-001-Abc12-_X.png"
```

### Currency Formatting

```typescript
import { formatCurrency, getCurrencySymbol, getCurrencyName } from '@/components/payment-links/currency-select';

// Format amount
const formatted = formatCurrency(1234.56, 'USD');
// Returns: "$1,234.56"

// Get symbol
const symbol = getCurrencySymbol('EUR');
// Returns: "€"

// Get name
const name = getCurrencyName('GBP');
// Returns: "British Pound"
```

---

## State Machine

### Valid State Transitions

```
DRAFT
  ├─> OPEN
  └─> CANCELED

OPEN
  ├─> PAID
  ├─> EXPIRED
  └─> CANCELED

PAID (terminal)
EXPIRED (terminal)
CANCELED (terminal)
```

### State Machine Utilities

```typescript
import {
  isValidTransition,
  getValidNextStates,
  isTerminalState,
  transitionPaymentLinkStatus,
  checkAndUpdateExpiredStatus,
  batchUpdateExpiredLinks,
  isPaymentLinkEditable,
  isPaymentLinkCancelable
} from '@/lib/payment-link-state-machine';

// Check if transition is valid
const canTransition = isValidTransition('DRAFT', 'OPEN'); // true

// Get valid next states
const nextStates = getValidNextStates('OPEN');
// Returns: ['PAID', 'EXPIRED', 'CANCELED']

// Check if terminal
const isTerminal = isTerminalState('PAID'); // true

// Transition status (with validation)
const updated = await transitionPaymentLinkStatus(
  paymentLinkId,
  'OPEN',
  userId
);

// Check and update if expired
await checkAndUpdateExpiredStatus(paymentLinkId);

// Batch update expired links (background job)
const count = await batchUpdateExpiredLinks();

// Check if editable
const editable = isPaymentLinkEditable('DRAFT'); // true

// Check if cancelable
const cancelable = isPaymentLinkCancelable('OPEN'); // true
```

---

## Common Patterns

### Fetching Payment Links with Filters

```typescript
const fetchPaymentLinks = async (filters: PaymentLinkFilters) => {
  const params = new URLSearchParams({
    organizationId: 'org-id',
    page: '1',
    limit: '20',
    ...filters
  });

  const response = await fetch(`/api/payment-links?${params}`);
  const result = await response.json();
  
  return result.data;
};
```

### Creating a Payment Link

```typescript
const createPaymentLink = async (data: CreatePaymentLink) => {
  const response = await fetch('/api/payment-links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }
  
  return await response.json();
};
```

### Downloading QR Code

```typescript
const downloadQRCode = async (paymentLinkId: string, shortCode: string) => {
  const response = await fetch(
    `/api/payment-links/${paymentLinkId}/qr-code?format=png&download=true`
  );
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `qr-${shortCode}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};
```

### Canceling a Payment Link

```typescript
const cancelPaymentLink = async (paymentLinkId: string) => {
  const response = await fetch(`/api/payment-links/${paymentLinkId}`, {
    method: 'DELETE'
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }
  
  return await response.json();
};
```

### Copying Payment URL

```typescript
const copyPaymentUrl = (shortCode: string) => {
  const url = `${window.location.origin}/pay/${shortCode}`;
  
  navigator.clipboard.writeText(url);
  
  toast({
    title: 'URL Copied',
    description: 'Payment link URL copied to clipboard'
  });
};
```

---

## Status Badge Colors

```typescript
const getStatusBadgeVariant = (status: PaymentLinkStatus) => {
  switch (status) {
    case 'DRAFT':    return 'secondary';   // Gray
    case 'OPEN':     return 'default';     // Blue
    case 'PAID':     return 'success';     // Green
    case 'EXPIRED':  return 'outline';     // Outlined
    case 'CANCELED': return 'destructive'; // Red
  }
};
```

---

## TypeScript Types

### Payment Link

```typescript
interface PaymentLink {
  id: string;
  organizationId: string;
  shortCode: string;
  status: 'DRAFT' | 'OPEN' | 'PAID' | 'EXPIRED' | 'CANCELED';
  amount: number;
  currency: string;
  description: string;
  invoiceReference: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Create Payment Link

```typescript
interface CreatePaymentLink {
  organizationId: string;
  amount: number;
  currency: string;
  description: string;
  invoiceReference?: string;
  customerEmail?: string;
  customerPhone?: string;
  expiresAt?: Date | string;
}
```

### Payment Link Filters

```typescript
interface PaymentLinkFilters {
  status?: 'DRAFT' | 'OPEN' | 'PAID' | 'EXPIRED' | 'CANCELED';
  currency?: string;
  paymentMethod?: 'STRIPE' | 'HEDERA';
  startDate?: Date;
  endDate?: Date;
  search?: string;
}
```

---

## Environment Variables

```env
# Required for payment links
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# QR codes will use this URL as base
# Production example: "https://pay.provvypay.com"
```

---

## Permission Requirements

All payment link operations require appropriate permissions:

- **view_payment_links** - List and view payment links
- **create_payment_links** - Create new payment links
- **edit_payment_links** - Edit and transition status
- **cancel_payment_links** - Cancel payment links

---

## Best Practices

### 1. Always validate state transitions
```typescript
if (isValidTransition(currentStatus, newStatus)) {
  await transitionPaymentLinkStatus(id, newStatus, userId);
}
```

### 2. Check permissions before operations
```typescript
const canCreate = await hasPermission(
  userId,
  organizationId,
  'create_payment_links'
);
```

### 3. Handle errors gracefully
```typescript
try {
  await createPaymentLink(data);
} catch (error) {
  toast({
    title: 'Error',
    description: error.message,
    variant: 'destructive'
  });
}
```

### 4. Use optimistic updates
```typescript
// Update UI immediately
setPaymentLinks(prev => [...prev, newLink]);

// Then sync with server
await createPaymentLink(data);
```

### 5. Implement loading states
```typescript
const [isLoading, setIsLoading] = useState(false);

const handleSubmit = async () => {
  setIsLoading(true);
  try {
    await createPaymentLink(data);
  } finally {
    setIsLoading(false);
  }
};
```

---

## Troubleshooting

### QR Code Not Generating
- Check `NEXT_PUBLIC_APP_URL` is set
- Verify short code is valid (8 characters, URL-safe)
- Check API route is accessible

### State Transition Fails
- Verify current status allows transition
- Check terminal state not being modified
- Ensure user has edit permissions

### Payment Link Not Updating
- Confirm link is in DRAFT status
- Check user has edit permissions
- Verify organization ID matches

---

**Need more help?** Check the full documentation in `SPRINT3_COMPLETE.md`













