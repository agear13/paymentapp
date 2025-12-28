# Provvypay Project Status

## 🎯 Project Overview

**Provvypay** is a unified payment link application that combines Stripe (fiat) and Hedera (crypto) payments with automated Xero synchronization and double-entry bookkeeping.

**Target Users:** SMB owners, accountants, multi-rail merchants in Australia and Indonesia.

## 📊 Overall Progress

| Sprint | Status | Completion | Last Updated |
|--------|--------|------------|--------------|
| **Sprint 0** | ✅ Complete | 100% | Prior |
| **Sprint 1** | ✅ Complete | 100% | Dec 5, 2025 |
| **Sprint 2** | ⏳ Not Started | 0% | - |

### Sprint Breakdown

**Sprint 0: Project Setup & Infrastructure** ✅
- Next.js 15 + TypeScript + Tailwind CSS
- PostgreSQL + Prisma ORM
- Supabase Authentication
- Shadcn UI Components (54 components)
- Logging & Monitoring (Sentry)
- Rate Limiting

**Sprint 1: Database Schema & Core Models** ✅
- 10 database tables with migrations
- Comprehensive Prisma models
- Zod validation schemas (40+)
- Custom validators (25+)
- Type-safe validation middleware
- Database seeding scripts

**Sprint 2: Merchant Admin Portal - Foundation** ⏳
- Dashboard layout
- Organization management
- Merchant settings UI

## 🗂️ Project Structure

```
src/
├── app/                          # Next.js 15 App Router
│   ├── api/                      # API routes
│   │   ├── example-protected/    # Example protected endpoint
│   │   └── health/               # Health check
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page
├── components/
│   └── ui/                       # Shadcn UI components (54 total)
├── lib/
│   ├── api/
│   │   └── middleware.ts         # API middleware
│   ├── auth/                     # Authentication utilities
│   │   ├── errors.ts
│   │   ├── middleware.ts
│   │   ├── permissions.ts
│   │   └── session.ts
│   ├── db/
│   │   └── seed.ts               # Database seeding
│   ├── monitoring/
│   │   └── sentry.ts             # Error tracking
│   ├── supabase/                 # Supabase client
│   │   ├── client.ts
│   │   ├── middleware.ts
│   │   └── server.ts
│   ├── validations/              # ⭐ NEW in Sprint 1
│   │   ├── schemas.ts            # Zod schemas (960 lines)
│   │   ├── validators.ts         # Custom validators (500 lines)
│   │   ├── middleware.ts         # Validation middleware (380 lines)
│   │   ├── index.ts              # Exports
│   │   └── README.md             # Documentation
│   ├── logger.ts                 # Structured logging
│   ├── prisma.ts                 # Prisma client singleton
│   └── rate-limit.ts             # Rate limiting
├── prisma/                       # ⭐ NEW in Sprint 1
│   ├── schema.prisma             # Database schema
│   └── migrations/
│       ├── 20241205000000_init_payment_link_schema/
│       │   └── migration.sql     # Core tables
│       └── 20241205000001_add_audit_table/
│           └── migration.sql     # Audit log
├── docs/
│   └── SPRINT1_SUMMARY.md        # Sprint 1 summary
├── middleware.ts                 # Global middleware
├── prisma.config.ts              # Prisma 7 config
├── SPRINT0_COMPLETE.md           # Sprint 0 docs
├── SPRINT1_COMPLETE.md           # ⭐ Sprint 1 docs
├── VALIDATION_QUICK_REF.md       # ⭐ Quick reference
├── PROJECT_STATUS.md             # This file
├── todo.md                       # Implementation plan
├── prd.md                        # Product requirements
└── .cursorrules                  # AI assistant rules
```

## 🗄️ Database Schema

### Core Tables (10)

1. **organizations** - Multi-tenant organization management
2. **merchant_settings** - Merchant configuration (Stripe, Hedera IDs)
3. **payment_links** - Payment link core entity
4. **payment_events** - Event tracking for payment lifecycle
5. **fx_snapshots** - Foreign exchange rate snapshots (immutable)
6. **ledger_accounts** - Chart of accounts for double-entry
7. **ledger_entries** - Ledger postings with idempotency
8. **xero_connections** - Xero OAuth connections
9. **xero_syncs** - Xero sync queue with retry logic
10. **audit_logs** - Immutable audit trail (APPEND-ONLY)

### Key Features

- **Audit Trail:** PostgreSQL trigger prevents updates/deletes
- **Idempotency:** Prevents duplicate ledger entries
- **Double-Entry:** DR must equal CR (validated)
- **FX Snapshots:** Captured at creation and settlement
- **Cascading:** Proper foreign key relationships

## 🛡️ Validation System

### Available Schemas (40+)

**Entity Operations:**
- CreateOrganizationSchema
- CreateMerchantSettingsSchema / UpdateMerchantSettingsSchema
- CreatePaymentLinkSchema / UpdatePaymentLinkSchema
- CreatePaymentEventSchema
- CreateFxSnapshotSchema
- CreateLedgerAccountSchema
- CreateLedgerEntrySchema / CreateLedgerEntriesSchema (with balance check)
- CreateXeroSyncSchema
- CreateAuditLogSchema

**Utility Schemas:**
- PaginationSchema
- PaymentLinkFiltersSchema
- PaymentLinkStatusResponseSchema

### Custom Validators (25+)

**Currency:** ISO 4217 validation (60+ currencies including crypto)  
**Hedera:** Account ID & transaction ID validation  
**Short Codes:** URL-safe 8-char generation  
**Amounts:** Decimal precision (2 for fiat, 8 for crypto)  
**Contact:** Email & phone validation  
**Ledger:** Double-entry balance validation  
**Idempotency:** Key generation and validation

### Type-Safe Middleware

```typescript
export const POST = withValidation(
  { body: CreatePaymentLinkSchema },
  async ({ body }) => {
    // body is fully typed and validated!
    return NextResponse.json(await createLink(body));
  }
);
```

## 📦 NPM Scripts

### Development
```bash
npm run dev           # Start development server
npm run build         # Build for production
npm run start         # Start production server
npm run lint          # Run ESLint
```

### Database
```bash
npm run db:generate          # Generate Prisma Client
npm run db:migrate           # Run migrations (dev)
npm run db:migrate:deploy    # Deploy migrations (prod)
npm run db:seed              # Seed development data
npm run db:reset             # Reset database
npm run db:studio            # Open Prisma Studio
```

## 🔧 Environment Variables

Required variables in `.env.local`:

```bash
# Database
DATABASE_URL="postgresql://..."

# Supabase
NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""

# Stripe
STRIPE_SECRET_KEY=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
STRIPE_WEBHOOK_SECRET=""

# Hedera
HEDERA_ACCOUNT_ID="0.0.xxxxx"
HEDERA_PRIVATE_KEY=""
NEXT_PUBLIC_HEDERA_NETWORK="mainnet"

# Xero
XERO_CLIENT_ID=""
XERO_CLIENT_SECRET=""
XERO_REDIRECT_URI=""

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"

# Monitoring
SENTRY_DSN=""
LOG_LEVEL="info"

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS="100"
RATE_LIMIT_WINDOW_MS="900000"
```

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [prd.md](prd.md) | Product Requirements Document |
| [todo.md](todo.md) | Sprint-by-sprint implementation plan |
| [SPRINT0_COMPLETE.md](SPRINT0_COMPLETE.md) | Sprint 0 completion report |
| [SPRINT1_COMPLETE.md](SPRINT1_COMPLETE.md) | Sprint 1 detailed report |
| [docs/SPRINT1_SUMMARY.md](docs/SPRINT1_SUMMARY.md) | Sprint 1 executive summary |
| [VALIDATION_QUICK_REF.md](VALIDATION_QUICK_REF.md) | Quick reference for validation |
| [lib/validations/README.md](lib/validations/README.md) | Full validation guide |

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd src
npm install
```

### 2. Set Up Environment
```bash
cp env.local .env.local
# Edit .env.local with your credentials
```

### 3. Set Up Database
```bash
npm run db:generate
npm run db:migrate
npm run db:seed  # Optional: seed with test data
```

### 4. Start Development Server
```bash
npm run dev
```

Visit http://localhost:3000

## 🧪 Testing

### Verify Prisma Client
```typescript
import { prisma } from '@/lib/prisma';

const orgs = await prisma.organization.findMany();
console.log(orgs);
```

### Test Validation
```typescript
import { CreatePaymentLinkSchema, validators } from '@/lib/validations';

// Schema validation
const result = CreatePaymentLinkSchema.safeParse(data);

// Custom validators
validators.validateCurrencyCode('AUD');        // true
validators.generateShortCode();                // 'Ab3De5fG'
validators.validateHederaAccountId('0.0.12345'); // true
```

### Test API Route
```typescript
// app/api/test/route.ts
import { withValidation, CreatePaymentLinkSchema } from '@/lib/validations';

export const POST = withValidation(
  { body: CreatePaymentLinkSchema },
  async ({ body }) => {
    return NextResponse.json({ success: true, data: body });
  }
);
```

## 📈 Metrics

| Metric | Value |
|--------|-------|
| **Total Files** | 100+ |
| **Lines of Code** | 5,000+ |
| **UI Components** | 54 (Shadcn) |
| **Database Tables** | 10 |
| **Zod Schemas** | 40+ |
| **Custom Validators** | 25+ |
| **API Routes** | 2 (health, example) |
| **Migrations** | 2 |
| **Test Coverage** | TBD |

## 🏗️ Architecture

### Tech Stack

**Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS  
**Backend:** Next.js API Routes, Prisma ORM  
**Database:** PostgreSQL (Supabase)  
**Auth:** Supabase Auth  
**Payments:** Stripe (fiat), Hedera (crypto)  
**Accounting:** Xero API  
**Monitoring:** Sentry  
**UI:** Shadcn + Radix UI  
**Validation:** Zod

### Design Patterns

- **Repository Pattern:** Prisma models
- **Singleton Pattern:** Prisma client
- **Middleware Pattern:** Validation, auth, rate limiting
- **Double-Entry Bookkeeping:** Ledger system
- **Event Sourcing:** Payment events
- **Idempotency:** Unique keys for operations

## 🔐 Security

- ✅ PCI DSS compliant (via Stripe)
- ✅ Input validation (Zod schemas)
- ✅ SQL injection prevention (Prisma ORM)
- ✅ CSRF protection
- ✅ Rate limiting
- ✅ Audit trail (immutable)
- ✅ Encrypted tokens (Xero)
- ✅ Type safety (TypeScript)

## 🎯 Next Steps

### Immediate (Sprint 2)

1. Create dashboard layout
2. Build organization management UI
3. Implement merchant settings forms
4. Create payment link CRUD API routes

### Short Term (Sprints 3-5)

1. Payment link creation UI
2. Public pay page
3. Stripe integration
4. Hedera wallet integration

### Medium Term (Sprints 6-10)

1. FX pricing engine
2. Double-entry ledger service
3. Xero OAuth flow
4. Xero sync queue

## 🤝 Contributing

Follow the existing patterns:

1. **Validation:** Use Zod schemas + `withValidation` middleware
2. **Database:** Define in Prisma schema, create migration
3. **Types:** Import from `@/lib/validations` or Prisma
4. **API Routes:** Use App Router conventions
5. **UI:** Use Shadcn components
6. **Logging:** Use structured logger
7. **Error Handling:** Return proper HTTP status codes

## 📞 Support

- **Documentation:** See `/docs` and README files
- **PRD:** [prd.md](prd.md) for requirements
- **Todo:** [todo.md](todo.md) for implementation plan

---

**Last Updated:** December 5, 2025  
**Current Sprint:** Sprint 1 Complete ✅  
**Next Sprint:** Sprint 2 - Merchant Admin Portal Foundation  
**Status:** On Track 🚀













