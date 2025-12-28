# Getting Started with Provvypay

## 🚀 Quick Start (5 minutes)

### Prerequisites

- Node.js 20+
- PostgreSQL database (or Supabase account)
- npm or yarn

### 1. Install Dependencies

```bash
cd src
npm install
```

### 2. Configure Environment

```bash
# Copy example environment file
cp env.local .env.local

# Edit .env.local with your credentials
```

**Minimum required variables:**
```bash
DATABASE_URL="postgresql://user:password@localhost:5432/provvypay"
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

### 3. Initialize Database

```bash
# Generate Prisma Client
npm run db:generate

# Run migrations
npm run db:migrate

# (Optional) Seed with test data
npm run db:seed
```

### 4. Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000 🎉

## 📖 What's Already Built

### ✅ Sprint 0: Infrastructure
- Next.js 15 with App Router
- TypeScript configuration
- Tailwind CSS + Shadcn UI (54 components)
- Supabase authentication
- Sentry error tracking
- Rate limiting
- Structured logging

### ✅ Sprint 1: Database & Validation
- **10 Database Tables:**
  - organizations, merchant_settings, payment_links
  - payment_events, fx_snapshots
  - ledger_accounts, ledger_entries
  - xero_connections, xero_syncs
  - audit_logs (immutable)

- **Comprehensive Validation:**
  - 40+ Zod schemas
  - 25+ custom validators
  - Type-safe API middleware
  - Currency, Hedera, email, phone validation
  - Double-entry balance validation

## 🛠️ Development Workflow

### Working with the Database

```bash
# Make changes to prisma/schema.prisma, then:
npm run db:migrate        # Create and apply migration

# Generate TypeScript types
npm run db:generate

# View data in GUI
npm run db:studio

# Reset everything (⚠️ dangerous)
npm run db:reset
```

### Creating API Routes

Use the validation middleware for type-safe routes:

```typescript
// app/api/payment-links/route.ts
import { NextResponse } from 'next/server';
import { withValidation, CreatePaymentLinkSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';

export const POST = withValidation(
  { body: CreatePaymentLinkSchema },
  async ({ body }) => {
    const link = await prisma.paymentLink.create({
      data: {
        ...body,
        shortCode: generateShortCode(),
      },
    });
    
    return NextResponse.json(link, { status: 201 });
  }
);
```

### Adding Validation

```typescript
import { validators } from '@/lib/validations';

// Currency validation
if (!validators.validateCurrencyCode(currency)) {
  throw new Error('Invalid currency');
}

// Generate short code
const code = validators.generateShortCode(); // 'Ab3De5fG'

// Validate Hedera account
if (!validators.validateHederaAccountId(accountId)) {
  throw new Error('Invalid Hedera account ID');
}

// Check ledger balance
const balance = validators.validateLedgerBalance(entries);
if (!balance.valid) {
  throw new Error(`Debits (${balance.debitTotal}) != Credits (${balance.creditTotal})`);
}
```

### Using UI Components

```typescript
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function MyPage() {
  return (
    <Card>
      <CardHeader>Payment Link</CardHeader>
      <CardContent>
        <Input placeholder="Amount" type="number" />
        <Button>Create Link</Button>
      </CardContent>
    </Card>
  );
}
```

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API routes
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home page
├── components/
│   └── ui/                 # Shadcn components
├── lib/
│   ├── validations/        # ⭐ Validation system
│   ├── db/                 # Database utilities
│   ├── auth/               # Authentication
│   ├── prisma.ts           # Prisma client
│   └── logger.ts           # Logging
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── migrations/         # Database migrations
└── middleware.ts           # Global middleware
```

## 🎯 Common Tasks

### Add a New Database Table

1. **Edit `prisma/schema.prisma`:**
```prisma
model MyNewTable {
  id        String   @id @default(uuid()) @db.Uuid
  name      String   @db.VarChar(255)
  createdAt DateTime @default(now()) @map("created_at")
  
  @@map("my_new_table")
}
```

2. **Create migration:**
```bash
npm run db:migrate
```

3. **Generate types:**
```bash
npm run db:generate
```

### Add Validation Schema

Create in `lib/validations/schemas.ts`:

```typescript
export const CreateMyEntitySchema = z.object({
  name: z.string().min(1).max(255),
  amount: z.number().positive(),
  currency: currencyCodeSchema,
});

export type CreateMyEntity = z.infer<typeof CreateMyEntitySchema>;
```

### Add Custom Validator

Add to `lib/validations/validators.ts`:

```typescript
export const validateMyField = (value: string): boolean => {
  // Your validation logic
  return /^[A-Z]{3}$/.test(value);
};
```

### Create Protected API Route

```typescript
import { withValidation } from '@/lib/validations';
import { createClient } from '@/lib/supabase/server';

export const GET = withValidation(
  { query: PaginationSchema },
  async ({ query, request }) => {
    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Fetch data
    const data = await prisma.myTable.findMany({
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    
    return NextResponse.json(data);
  }
);
```

## 📚 Key Documentation

| Document | Purpose |
|----------|---------|
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | Overall project status |
| [VALIDATION_QUICK_REF.md](VALIDATION_QUICK_REF.md) | Validation quick reference |
| [lib/validations/README.md](lib/validations/README.md) | Full validation guide |
| [SPRINT1_COMPLETE.md](SPRINT1_COMPLETE.md) | Sprint 1 detailed report |
| [prd.md](prd.md) | Product requirements |
| [todo.md](todo.md) | Implementation roadmap |

## 🔍 Useful Commands

### Database

```bash
npm run db:studio          # Open Prisma Studio (GUI)
npm run db:generate        # Generate Prisma Client
npm run db:migrate         # Create and run migration
npm run db:seed            # Seed test data
```

### Development

```bash
npm run dev                # Start dev server
npm run build              # Build for production
npm run lint               # Run linter
```

### Prisma Studio

Prisma Studio provides a GUI for your database:

```bash
npm run db:studio
```

Opens at http://localhost:5555

## 🧪 Testing Your Setup

### 1. Test Database Connection

```typescript
// Create: app/api/test-db/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const count = await prisma.organization.count();
  return NextResponse.json({ organizations: count });
}
```

Visit: http://localhost:3000/api/test-db

### 2. Test Validation

```typescript
// Create: app/api/test-validation/route.ts
import { NextResponse } from 'next/server';
import { validators } from '@/lib/validations';

export async function GET() {
  return NextResponse.json({
    currency: validators.validateCurrencyCode('AUD'),
    hedera: validators.validateHederaAccountId('0.0.12345'),
    shortCode: validators.generateShortCode(),
  });
}
```

### 3. Test Protected Route

```typescript
// Already exists: app/api/example-protected/route.ts
```

Visit: http://localhost:3000/api/example-protected

## 💡 Tips & Best Practices

### 1. Use Type Imports

```typescript
// ✅ Good
import type { CreatePaymentLink } from '@/lib/validations';

// ❌ Bad - importing runtime value when you only need type
import { CreatePaymentLink } from '@/lib/validations';
```

### 2. Always Validate User Input

```typescript
// ✅ Good
export const POST = withValidation(
  { body: CreatePaymentLinkSchema },
  async ({ body }) => {
    // body is validated and typed
  }
);

// ❌ Bad - no validation
export async function POST(request: NextRequest) {
  const body = await request.json();
  // body is unknown, unvalidated
}
```

### 3. Use Prisma Transactions

```typescript
// For multiple related database operations
await prisma.$transaction([
  prisma.paymentLink.create({ data: linkData }),
  prisma.paymentEvent.create({ data: eventData }),
]);
```

### 4. Use Idempotency Keys

```typescript
import { validators } from '@/lib/validations';

const idempotencyKey = validators.generateIdempotencyKey(
  paymentLinkId,
  'PAYMENT_CONFIRMED'
);

await prisma.ledgerEntry.create({
  data: { ...entry, idempotencyKey },
});
```

### 5. Log Important Events

```typescript
import { logger } from '@/lib/logger';

logger.info('Payment link created', {
  linkId: link.id,
  amount: link.amount,
  currency: link.currency,
});
```

## 🚨 Common Issues

### Database Connection Error

**Error:** `Can't reach database server`

**Solution:**
```bash
# Check DATABASE_URL in .env.local
# Ensure PostgreSQL is running
# Test connection:
psql $DATABASE_URL
```

### Prisma Client Not Generated

**Error:** `Cannot find module '@prisma/client'`

**Solution:**
```bash
npm run db:generate
```

### Migration Failed

**Error:** `Migration failed to apply`

**Solution:**
```bash
# Reset database (⚠️ deletes all data)
npm run db:reset

# Or manually fix and retry
npm run db:migrate
```

### TypeScript Errors

**Error:** Type errors after schema changes

**Solution:**
```bash
# Regenerate Prisma types
npm run db:generate

# Restart TypeScript server in VS Code
# Cmd+Shift+P > "TypeScript: Restart TS Server"
```

## 🎓 Learning Resources

### Next.js 15
- [App Router Docs](https://nextjs.org/docs/app)
- [Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

### Prisma
- [Prisma Docs](https://www.prisma.io/docs)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)

### Zod
- [Zod Documentation](https://zod.dev)

### Shadcn UI
- [Components](https://ui.shadcn.com/docs/components)

## 🤝 Getting Help

1. Check documentation in `/docs`
2. Review [PRD](prd.md) for requirements
3. Check [todo.md](todo.md) for implementation plan
4. Review validation guide: [lib/validations/README.md](lib/validations/README.md)

## 🎉 You're Ready!

You now have:
- ✅ A fully configured Next.js 15 application
- ✅ PostgreSQL database with migrations
- ✅ Comprehensive validation system
- ✅ Type-safe API routes
- ✅ 54 UI components
- ✅ Authentication ready
- ✅ Monitoring & logging

**Next Steps:**
1. Start building Sprint 2 features
2. Create dashboard layout
3. Build organization management UI
4. Implement payment link creation

Happy coding! 🚀













