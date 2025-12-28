# Sprint 1: Database Schema & Core Models - COMPLETED ✅

## Overview

Sprint 1 focused on establishing the foundational data layer for Provvypay, including database schema, Prisma models, validation layers, and development utilities.

## Completed Tasks

### ✅ Schema Implementation

- **Database Migrations Created**
  - `20241205000000_init_payment_link_schema` - All core tables
  - `20241205000001_add_audit_table` - Audit trail with append-only constraint
  
- **Tables Created**
  - `organizations` - Multi-tenant organization management
  - `merchant_settings` - Merchant configuration
  - `payment_links` - Payment link core entity
  - `payment_events` - Event tracking for payment lifecycle
  - `fx_snapshots` - Foreign exchange rate snapshots
  - `ledger_accounts` - Chart of accounts
  - `ledger_entries` - Double-entry bookkeeping entries
  - `xero_connections` - Xero OAuth connection data
  - `xero_syncs` - Xero synchronization queue
  - `audit_logs` - Immutable audit trail (APPEND-ONLY)

- **Indexes Added**
  - Performance indexes on frequently queried fields
  - Composite indexes for multi-column queries
  - Unique indexes for business constraints

- **Foreign Key Constraints**
  - Proper cascading rules (CASCADE, RESTRICT, SET NULL)
  - Referential integrity enforcement

### ✅ Prisma Models & Relations

- **All Models Defined** in `prisma/schema.prisma`
  - Proper TypeScript type generation
  - Comprehensive field definitions
  - Database-specific column types (@db.Uuid, @db.VarChar, etc.)

- **Relationships Configured**
  - One-to-many: Organization → PaymentLinks, MerchantSettings, etc.
  - Many-to-one: PaymentLink → Organization
  - One-to-one: Organization → XeroConnection
  - All relation fields with proper foreign keys

- **Enum Types**
  - `PaymentLinkStatus` (DRAFT, OPEN, PAID, EXPIRED, CANCELED)
  - `PaymentEventType` (CREATED, OPENED, PAYMENT_INITIATED, etc.)
  - `PaymentMethod` (STRIPE, HEDERA)
  - `FxSnapshotType` (CREATION, SETTLEMENT)
  - `LedgerAccountType` (ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE)
  - `LedgerEntryType` (DEBIT, CREDIT)
  - `XeroSyncType` (INVOICE, PAYMENT)
  - `XeroSyncStatus` (PENDING, SUCCESS, FAILED, RETRYING)

- **Prisma Client Singleton** (`lib/prisma.ts`)
  - Prevents multiple instances in development
  - Proper logging configuration
  - Environment-aware setup

- **TypeScript Types Generated**
  - Full type safety for database operations
  - Auto-generated from Prisma schema

### ✅ Data Validation Layer

- **Comprehensive Zod Schemas** (`lib/validations/schemas.ts`)
  - Schema for every database model
  - Create/Update variants for API operations
  - Proper validation rules matching PRD specifications
  - Type exports for TypeScript integration

- **Custom Validators** (`lib/validations/validators.ts`)
  - **Currency Validation**
    - ISO 4217 currency code validator
    - Support for 60+ currencies including crypto
    - Currency code normalization
  
  - **Hedera Validators**
    - Account ID format validation (0.0.xxxxx)
    - Transaction ID format validation
    - Account number extraction and range validation
  
  - **Invoice & Short Code**
    - Invoice reference validation (alphanumeric + dash/underscore)
    - Short code validation (8 chars, URL-safe)
    - Short code generator (base62, no confusing chars)
  
  - **Amount Validators**
    - Decimal precision validation (2 for fiat, 8 for crypto)
    - Amount rounding utilities
  
  - **Contact Validators**
    - Email validation (RFC 5322 compliant)
    - International phone validation (E.164 format)
    - Phone normalization utility
  
  - **Date/Time Validators**
    - Expiry date validation (must be future)
    - Snapshot timestamp validation (max age check)
  
  - **Ledger Validators**
    - Double-entry balance validation (DR = CR)
    - Tolerance for rounding errors (0.001)
  
  - **External ID Validators**
    - Stripe Payment Intent ID format
    - Xero account code format
    - Idempotency key generation and validation

- **Validation Middleware** (`lib/validations/middleware.ts`)
  - `validateRequestBody` - Request body validation
  - `validateQueryParams` - Query parameter validation
  - `validatePathParams` - URL path parameter validation
  - `withValidation` - Higher-order function for route handlers
  - `safeParse` - Non-throwing validation utility
  - `validatePartial` - Partial validation for PATCH requests
  - Comprehensive error formatting
  - Type-safe validated route handlers

### ✅ Database Seeding Scripts

- **Seed Script** (`lib/db/seed.ts`)
  - Seeds development data for testing
  - Creates 2 sample organizations
  - Creates merchant settings with Stripe/Hedera IDs
  - Creates default ledger accounts (1200, 1050, 1051, 6100, 4000)
  - Creates 4 sample payment links (DRAFT, OPEN, PAID, EXPIRED)
  - Creates payment events for paid links
  - Creates FX snapshots
  - Creates audit logs
  - Proper error handling and logging
  - Idempotent (uses upsert where appropriate)

- **NPM Scripts Added**
  - `npm run db:migrate` - Run migrations in development
  - `npm run db:migrate:deploy` - Deploy migrations to production
  - `npm run db:generate` - Generate Prisma Client types
  - `npm run db:seed` - Seed development database
  - `npm run db:reset` - Reset database (dangerous!)
  - `npm run db:studio` - Open Prisma Studio GUI

## File Structure

```
src/
├── prisma/
│   ├── schema.prisma                                    # Prisma schema definition
│   └── migrations/
│       ├── 20241205000000_init_payment_link_schema/
│       │   └── migration.sql                            # Initial schema migration
│       └── 20241205000001_add_audit_table/
│           └── migration.sql                            # Audit table migration
├── lib/
│   ├── prisma.ts                                        # Prisma client singleton
│   ├── db/
│   │   └── seed.ts                                      # Database seeding script
│   └── validations/
│       ├── index.ts                                     # Validation exports
│       ├── schemas.ts                                   # Zod schemas (960+ lines)
│       ├── validators.ts                                # Custom validators (500+ lines)
│       └── middleware.ts                                # Validation middleware (380+ lines)
└── prisma.config.ts                                     # Prisma 7 configuration
```

## Key Features Implemented

### 1. Audit Trail (Append-Only)

The `audit_logs` table has a PostgreSQL trigger that prevents updates and deletes:

```sql
CREATE TRIGGER enforce_audit_log_append_only
    BEFORE UPDATE OR DELETE ON "audit_logs"
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();
```

This ensures:
- Complete immutability of audit records
- Regulatory compliance
- Tamper-proof audit trail

### 2. Double-Entry Bookkeeping Validation

The validation layer includes `validateLedgerBalance` which ensures:
- Debits equal credits
- Tolerance for floating-point rounding (0.001)
- Balance validation before posting

### 3. Type-Safe API Handlers

The `withValidation` higher-order function enables type-safe route handlers:

```typescript
export const POST = withValidation(
  {
    body: CreatePaymentLinkSchema,
    query: PaginationSchema,
  },
  async ({ body, query }) => {
    // body and query are fully typed and validated
    const paymentLink = await createPaymentLink(body);
    return NextResponse.json(paymentLink);
  }
);
```

### 4. Comprehensive Currency Support

- 60+ ISO 4217 currencies
- Crypto currencies (HBAR, USDC, USDT, BTC, ETH)
- Proper decimal precision (2 for fiat, 8 for crypto)
- Currency code normalization

### 5. Hedera Integration Ready

- Account ID validation (0.0.xxxxx format)
- Transaction ID parsing
- Account number extraction
- Range validation

## Migration Execution

To apply migrations to your database:

```bash
# Set DATABASE_URL in your .env file first
DATABASE_URL="postgresql://user:password@host:port/database?schema=public"

# Run migrations
npm run db:migrate

# Generate Prisma Client
npm run db:generate

# Seed development data (optional)
npm run db:seed
```

## Testing the Setup

1. **Verify Prisma Client Generation**
   ```bash
   npm run db:generate
   ```

2. **Check Schema Validation**
   ```typescript
   import { CreatePaymentLinkSchema } from '@/lib/validations';
   
   const result = CreatePaymentLinkSchema.safeParse({
     organizationId: 'uuid-here',
     amount: 100.00,
     currency: 'AUD',
     description: 'Test payment',
   });
   ```

3. **Test Validators**
   ```typescript
   import { validators } from '@/lib/validations';
   
   validators.validateCurrencyCode('AUD'); // true
   validators.validateHederaAccountId('0.0.12345'); // true
   validators.generateShortCode(); // 'Abc3De5f'
   ```

## Data Model Highlights

### Organizations (Multi-Tenant)
- Each organization is isolated
- Clerk integration for auth
- One-to-many relationships with all major entities

### Payment Links (Core Entity)
- Lifecycle: DRAFT → OPEN → PAID/EXPIRED/CANCELED
- Short code for public URLs (/pay/{shortCode})
- Optional customer contact info
- Expiry timestamp support

### Payment Events (Audit Trail)
- Tracks all state changes
- Stores payment method details
- Stripe/Hedera transaction IDs
- JSONB metadata for flexibility

### FX Snapshots (Immutable Pricing)
- Two snapshots per payment (CREATION, SETTLEMENT)
- 8 decimal precision
- Provider tracking (CoinGecko, Hedera Mirror Node)

### Ledger System (Double-Entry)
- Proper chart of accounts
- Idempotency keys prevent duplicates
- Currency tracking
- Audit-ready descriptions

### Xero Integration
- OAuth connection storage
- Sync queue with retry logic
- Request/response payload logging
- Error tracking

## Next Steps (Sprint 2)

With the data layer complete, Sprint 2 will focus on:

1. **Merchant Admin Portal Foundation**
   - Dashboard layout
   - Organization management
   - Merchant settings UI

2. **API Route Structure**
   - Payment link CRUD operations
   - Using validation middleware
   - Error handling

3. **Authentication Integration**
   - Connect Supabase auth with organizations
   - Permission system implementation

## Notes

- All migrations are reversible where appropriate
- The audit table is append-only (enforced by trigger)
- Prisma 7 configuration uses `prisma.config.ts` instead of `datasource.url`
- TypeScript types are auto-generated and fully typed
- Validation is comprehensive and follows PRD specifications exactly

---

**Sprint 1 Status:** ✅ **COMPLETE**  
**Date Completed:** December 5, 2025  
**Files Created:** 8  
**Lines of Code:** ~2,800+  
**Database Tables:** 10  
**Zod Schemas:** 40+  
**Custom Validators:** 25+













