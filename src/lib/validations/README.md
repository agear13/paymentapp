# Validation System Guide

## Overview

The Provvypay validation system provides comprehensive data validation using Zod schemas, custom validators, and type-safe middleware for API routes.

## Quick Start

### 1. Import What You Need

```typescript
import { 
  CreatePaymentLinkSchema,
  validateCurrencyCode,
  withValidation 
} from '@/lib/validations';
```

### 2. Validate Data with Zod Schemas

```typescript
import { CreatePaymentLinkSchema } from '@/lib/validations';

// Validate and get typed data
const result = CreatePaymentLinkSchema.safeParse(inputData);

if (!result.success) {
  console.error(result.error.errors);
} else {
  const validatedData = result.data; // Fully typed!
}
```

### 3. Use Custom Validators

```typescript
import { validators } from '@/lib/validations';

// Currency validation
validators.validateCurrencyCode('AUD'); // true
validators.normalizeCurrencyCode('aud'); // 'AUD'

// Hedera validation
validators.validateHederaAccountId('0.0.12345'); // true

// Generate short code
const code = validators.generateShortCode(); // 'Ab3De5fG'

// Validate amount with proper decimals
validators.validateAmount(100.50, 'USD'); // true (2 decimals ok)
validators.validateAmount(100.12345678, 'HBAR'); // true (8 decimals ok for crypto)
```

### 4. Create Type-Safe API Routes

```typescript
// app/api/payment-links/route.ts
import { NextResponse } from 'next/server';
import { withValidation, CreatePaymentLinkSchema } from '@/lib/validations';

export const POST = withValidation(
  {
    body: CreatePaymentLinkSchema,
  },
  async ({ body, request }) => {
    // body is fully typed and validated!
    // TypeScript knows the exact shape
    const paymentLink = await prisma.paymentLink.create({
      data: {
        ...body,
        shortCode: generateShortCode(),
      },
    });
    
    return NextResponse.json(paymentLink, { status: 201 });
  }
);
```

### 5. Validate Query Parameters

```typescript
import { withValidation, PaginationSchema, PaymentLinkFiltersSchema } from '@/lib/validations';

export const GET = withValidation(
  {
    query: PaginationSchema.merge(PaymentLinkFiltersSchema),
  },
  async ({ query }) => {
    // query.page, query.limit, query.status are all typed and validated
    const links = await prisma.paymentLink.findMany({
      where: { status: query.status },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    
    return NextResponse.json(links);
  }
);
```

## Available Schemas

### Core Entity Schemas

| Schema | Purpose | Key Validations |
|--------|---------|-----------------|
| `CreatePaymentLinkSchema` | Payment link creation | Amount > 0, max 2 decimals, description ≤ 200 chars |
| `UpdatePaymentLinkSchema` | Payment link updates | All fields optional, same validations |
| `CreateMerchantSettingsSchema` | Merchant setup | Valid currency code, Hedera ID format |
| `CreatePaymentEventSchema` | Event tracking | Valid event type, proper IDs |
| `CreateFxSnapshotSchema` | FX rate capture | Rate > 0, valid currency pair |
| `CreateLedgerEntrySchema` | Ledger posting | Amount > 0, valid entry type |
| `CreateLedgerEntriesSchema` | Batch posting | DR = CR validation |

### Enum Schemas

- `PaymentLinkStatusSchema` - DRAFT, OPEN, PAID, EXPIRED, CANCELED
- `PaymentMethodSchema` - STRIPE, HEDERA
- `LedgerAccountTypeSchema` - ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
- `LedgerEntryTypeSchema` - DEBIT, CREDIT
- `XeroSyncTypeSchema` - INVOICE, PAYMENT
- `XeroSyncStatusSchema` - PENDING, SUCCESS, FAILED, RETRYING

### Utility Schemas

- `PaginationSchema` - page (default 1), limit (default 20, max 100)
- `PaymentLinkFiltersSchema` - status, currency, payment method, date range, search

## Custom Validators

### Currency Validation

```typescript
import { validators } from '@/lib/validations';

// Check if valid
validators.validateCurrencyCode('AUD'); // true
validators.validateCurrencyCode('XYZ'); // false

// Normalize
validators.normalizeCurrencyCode('aud'); // 'AUD'
validators.normalizeCurrencyCode('invalid'); // null

// Supported currencies
validators.ISO_4217_CURRENCIES; // Array of all supported codes
```

### Hedera Validation

```typescript
// Account ID
validators.validateHederaAccountId('0.0.12345'); // true
validators.extractHederaAccountNumber('0.0.12345'); // 12345

// Transaction ID
validators.validateHederaTransactionId('0.0.12345@1234567.890'); // true
validators.parseHederaTransactionId('0.0.12345@1234567.890');
// { accountId: '0.0.12345', timestamp: '1234567.890' }
```

### Amount Validation

```typescript
// Validate with proper decimal places
validators.validateAmount(100.50, 'USD'); // true (2 decimals)
validators.validateAmount(100.123, 'USD'); // false (3 decimals)
validators.validateAmount(100.12345678, 'HBAR'); // true (8 decimals for crypto)

// Round to proper decimals
validators.roundAmount(100.12345, 'USD'); // 100.12
validators.roundAmount(100.12345678, 'HBAR'); // 100.12345678
```

### Contact Validation

```typescript
// Email
validators.validateEmail('user@example.com'); // true

// Phone
validators.validatePhone('+61412345678'); // true
validators.normalizePhone('0412 345 678'); // '+610412345678'
```

### Short Code & Invoice Reference

```typescript
// Generate URL-safe short code
validators.generateShortCode(); // 'Ab3De5fG' (8 chars, no confusing chars)

// Validate
validators.validateShortCode('ABCD1234'); // true

// Invoice reference
validators.validateInvoiceReference('INV-2024-001'); // true
validators.normalizeInvoiceReference('  INV-001  '); // 'INV-001'
```

### Ledger Validation

```typescript
const entries = [
  { entryType: 'DEBIT', amount: 100.00 },
  { entryType: 'CREDIT', amount: 100.00 },
];

const result = validators.validateLedgerBalance(entries);
// {
//   valid: true,
//   debitTotal: 100.00,
//   creditTotal: 100.00,
//   difference: 0
// }
```

### Idempotency Keys

```typescript
// Generate idempotency key
const key = validators.generateIdempotencyKey(
  'paymentLinkId',
  'PAYMENT_CONFIRMED',
  new Date()
);
// 'paymentLinkId:PAYMENT_CONFIRMED:2024-12-05T10:30:00.000Z'

// Validate
validators.validateIdempotencyKey(key); // true
```

## Validation Middleware Usage

### Basic Body Validation

```typescript
import { withValidation } from '@/lib/validations';

export const POST = withValidation(
  { body: CreatePaymentLinkSchema },
  async ({ body }) => {
    // body is typed and validated
    return NextResponse.json({ success: true });
  }
);
```

### Multiple Validation Sources

```typescript
export const GET = withValidation(
  {
    query: PaginationSchema,
    params: z.object({ id: z.string().uuid() }),
  },
  async ({ query, params }) => {
    // Both query and params are validated
    const link = await prisma.paymentLink.findUnique({
      where: { id: params.id },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    
    return NextResponse.json(link);
  }
);
```

### Error Handling

Validation errors automatically return HTTP 400 with details:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "amount",
      "message": "Amount must be positive"
    },
    {
      "field": "currency",
      "message": "Invalid currency code"
    }
  ]
}
```

### Manual Validation

```typescript
import { validateRequestBody, safeParse } from '@/lib/validations';

// In route handler
const result = await validateRequestBody(request, CreatePaymentLinkSchema);

if (!result.success) {
  return createValidationErrorResponse(result.errors!);
}

// Use validated data
const { data } = result;

// Or use safeParse for non-request data
const parseResult = safeParse(someData, CreatePaymentLinkSchema);
```

## Type Safety

All schemas export TypeScript types:

```typescript
import type { CreatePaymentLink, PaymentLink } from '@/lib/validations';

const createLink = async (data: CreatePaymentLink): Promise<PaymentLink> => {
  // TypeScript knows exact shape of data
  return await prisma.paymentLink.create({ data });
};
```

## Double-Entry Bookkeeping Example

```typescript
import { CreateLedgerEntriesSchema, validators } from '@/lib/validations';

const entries = [
  {
    paymentLinkId: 'uuid',
    ledgerAccountId: 'stripe-clearing-uuid',
    entryType: 'DEBIT',
    amount: 100.00,
    currency: 'AUD',
    description: 'Stripe settlement',
    idempotencyKey: 'unique-key',
  },
  {
    paymentLinkId: 'uuid',
    ledgerAccountId: 'accounts-receivable-uuid',
    entryType: 'CREDIT',
    amount: 100.00,
    currency: 'AUD',
    description: 'Payment received',
    idempotencyKey: 'unique-key',
  },
];

// Validate balance
const balanceCheck = validators.validateLedgerBalance(entries);
console.log(balanceCheck); // { valid: true, debitTotal: 100, creditTotal: 100, difference: 0 }

// Validate with schema (includes balance check)
const result = CreateLedgerEntriesSchema.safeParse(entries);
if (result.success) {
  // Post to ledger
  await prisma.ledgerEntry.createMany({ data: entries });
}
```

## Best Practices

### 1. Always Validate User Input

```typescript
// ❌ Bad - No validation
export async function POST(request: NextRequest) {
  const body = await request.json();
  const link = await prisma.paymentLink.create({ data: body });
  return NextResponse.json(link);
}

// ✅ Good - Validated
export const POST = withValidation(
  { body: CreatePaymentLinkSchema },
  async ({ body }) => {
    const link = await prisma.paymentLink.create({ data: body });
    return NextResponse.json(link);
  }
);
```

### 2. Use Type Exports

```typescript
// ✅ Import types from validation schemas
import type { CreatePaymentLink } from '@/lib/validations';

// Don't recreate types manually
```

### 3. Validate Before Database Operations

```typescript
// Always validate before touching the database
const result = CreatePaymentLinkSchema.safeParse(input);
if (!result.success) {
  return NextResponse.json({ errors: result.error }, { status: 400 });
}

await prisma.paymentLink.create({ data: result.data });
```

### 4. Use Custom Validators for Business Logic

```typescript
// Generate unique short codes
const shortCode = validators.generateShortCode();

// Validate Hedera addresses
if (!validators.validateHederaAccountId(hederaId)) {
  throw new Error('Invalid Hedera account ID');
}
```

### 5. Leverage Idempotency

```typescript
const idempotencyKey = validators.generateIdempotencyKey(
  paymentLinkId,
  'PAYMENT_CONFIRMED'
);

// Prevents duplicate ledger entries
await prisma.ledgerEntry.create({
  data: { ...entry, idempotencyKey },
});
```

## Testing

```typescript
import { describe, it, expect } from '@jest/globals';
import { validators, CreatePaymentLinkSchema } from '@/lib/validations';

describe('Payment Link Validation', () => {
  it('validates correct payment link data', () => {
    const data = {
      organizationId: '123e4567-e89b-12d3-a456-426614174000',
      amount: 100.00,
      currency: 'AUD',
      description: 'Test payment',
    };
    
    const result = CreatePaymentLinkSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
  
  it('rejects invalid currency', () => {
    const data = {
      organizationId: '123e4567-e89b-12d3-a456-426614174000',
      amount: 100.00,
      currency: 'INVALID',
      description: 'Test payment',
    };
    
    const result = CreatePaymentLinkSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
```

## Common Patterns

### Pagination with Filters

```typescript
const PaginatedPaymentLinksSchema = PaginationSchema.merge(
  PaymentLinkFiltersSchema
);

export const GET = withValidation(
  { query: PaginatedPaymentLinksSchema },
  async ({ query }) => {
    const { page, limit, status, currency, startDate, endDate } = query;
    
    const links = await prisma.paymentLink.findMany({
      where: {
        status,
        currency,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      skip: (page - 1) * limit,
      take: limit,
    });
    
    return NextResponse.json(links);
  }
);
```

### PATCH Requests (Partial Updates)

```typescript
export const PATCH = withValidation(
  {
    params: z.object({ id: z.string().uuid() }),
    body: UpdatePaymentLinkSchema, // Already a partial schema
  },
  async ({ params, body }) => {
    const updated = await prisma.paymentLink.update({
      where: { id: params.id },
      data: body,
    });
    
    return NextResponse.json(updated);
  }
);
```

## References

- [Zod Documentation](https://zod.dev)
- [Prisma Validation](https://www.prisma.io/docs/concepts/components/prisma-client/validation)
- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

---

For more examples, see the PRD and Sprint 1 documentation.













