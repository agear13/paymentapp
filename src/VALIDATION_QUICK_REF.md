# Validation Quick Reference

## Import Everything You Need

```typescript
import { 
  CreatePaymentLinkSchema,
  validators,
  withValidation 
} from '@/lib/validations';
```

## Validate API Routes (Most Common)

```typescript
// POST route with body validation
export const POST = withValidation(
  { body: CreatePaymentLinkSchema },
  async ({ body }) => {
    // body is typed and validated
    return NextResponse.json(await createPaymentLink(body));
  }
);

// GET route with query params
export const GET = withValidation(
  { query: PaginationSchema },
  async ({ query }) => {
    return NextResponse.json(await getLinks(query.page, query.limit));
  }
);

// With path params
export const GET = withValidation(
  { 
    params: z.object({ id: z.string().uuid() }),
    query: PaginationSchema
  },
  async ({ params, query }) => {
    return NextResponse.json(await getLink(params.id));
  }
);
```

## Quick Validators

```typescript
import { validators } from '@/lib/validations';

// Currency
validators.validateCurrencyCode('AUD');        // true
validators.normalizeCurrencyCode('aud');       // 'AUD'

// Hedera
validators.validateHederaAccountId('0.0.12345'); // true
validators.generateShortCode();                // 'Ab3De5fG'

// Amount
validators.validateAmount(100.50, 'USD');      // true
validators.roundAmount(100.12345, 'USD');      // 100.12

// Contact
validators.validateEmail('user@example.com');  // true
validators.normalizePhone('0412 345 678');     // '+610412345678'

// Ledger
validators.validateLedgerBalance([
  { entryType: 'DEBIT', amount: 100 },
  { entryType: 'CREDIT', amount: 100 }
]); // { valid: true, ... }

// Idempotency
validators.generateIdempotencyKey(linkId, 'PAYMENT_CONFIRMED');
```

## Available Schemas

### Create Operations
- `CreateOrganizationSchema`
- `CreateMerchantSettingsSchema`
- `CreatePaymentLinkSchema`
- `CreatePaymentEventSchema`
- `CreateFxSnapshotSchema`
- `CreateLedgerAccountSchema`
- `CreateLedgerEntrySchema`
- `CreateLedgerEntriesSchema` (with balance validation)
- `CreateXeroSyncSchema`
- `CreateAuditLogSchema`

### Update Operations
- `UpdateMerchantSettingsSchema`
- `UpdatePaymentLinkSchema`

### Utility Schemas
- `PaginationSchema` - page, limit
- `PaymentLinkFiltersSchema` - status, currency, dates, search
- `PaymentLinkStatusResponseSchema`

### Enums
- `PaymentLinkStatusSchema`
- `PaymentMethodSchema`
- `LedgerAccountTypeSchema`
- `LedgerEntryTypeSchema`

## Manual Validation

```typescript
import { safeParse } from '@/lib/validations';

const result = safeParse(data, CreatePaymentLinkSchema);
if (!result.success) {
  console.error(result.errors);
} else {
  await saveData(result.data);
}
```

## Error Response Format

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "amount", "message": "Amount must be positive" },
    { "field": "currency", "message": "Invalid currency code" }
  ]
}
```

## Supported Currencies

**Fiat:** USD, EUR, GBP, JPY, AUD, CAD, NZD, SGD, HKD, CHF, SEK, NOK, DKK, CNY, INR, IDR, and 40+ more

**Crypto:** HBAR, USDC, USDT, BTC, ETH

## Decimal Precision

- **Fiat:** 2 decimal places (100.50)
- **Crypto:** 8 decimal places (100.12345678)

## Database Scripts

```bash
npm run db:generate      # Generate Prisma Client
npm run db:migrate       # Run migrations (dev)
npm run db:seed          # Seed development data
npm run db:studio        # Open Prisma Studio
```

---

For full documentation, see: `lib/validations/README.md`













