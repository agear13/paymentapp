# Provvypay Code Style Guide

**Version:** 1.0  
**Last Updated:** December 16, 2025  
**Target Audience:** All Contributors

---

## 📋 Table of Contents

1. [General Principles](#general-principles)
2. [TypeScript Style](#typescript-style)
3. [React & Components](#react--components)
4. [API Routes](#api-routes)
5. [Database & Prisma](#database--prisma)
6. [Naming Conventions](#naming-conventions)
7. [File Organization](#file-organization)
8. [Comments & Documentation](#comments--documentation)
9. [Error Handling](#error-handling)
10. [Testing](#testing)

---

## 🎯 General Principles

### 1. Code Should Be Self-Documenting

Write code that is clear and obvious. Use descriptive names and simple logic.

```typescript
// ✅ Good: Clear intent
function calculateTotalWithTax(subtotal: number, taxRate: number): number {
  return subtotal * (1 + taxRate);
}

// ❌ Bad: Unclear purpose
function calc(a: number, b: number): number {
  return a * (1 + b);
}
```

### 2. Favor Readability Over Cleverness

```typescript
// ✅ Good: Clear and readable
function isPaymentPaid(status: PaymentLinkStatus): boolean {
  return status === PaymentLinkStatus.PAID;
}

// ❌ Bad: Too clever, harder to read
const isPaid = (s: string) => s === 'PAID';
```

### 3. DRY (Don't Repeat Yourself)

Extract repeated logic into reusable functions.

```typescript
// ✅ Good: Reusable function
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount);
}

const price1 = formatCurrency(100, 'USD');
const price2 = formatCurrency(200, 'AUD');

// ❌ Bad: Duplicated code
const price1 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
}).format(100);

const price2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'AUD'
}).format(200);
```

### 4. Keep Functions Small and Focused

Each function should do one thing well.

```typescript
// ✅ Good: Single responsibility
async function createPaymentLink(data: CreatePaymentRequest) {
  const validated = validatePaymentRequest(data);
  const shortCode = generateShortCode();
  const fxSnapshots = await captureFxSnapshots(validated);
  const payment = await saveToDatabase(validated, shortCode, fxSnapshots);
  return payment;
}

// ❌ Bad: Too many responsibilities
async function create(data: any) {
  // 100 lines of mixed validation, generation, fetching, saving...
}
```

---

## 📘 TypeScript Style

### 1. Always Use Explicit Types

```typescript
// ✅ Good: Explicit types
interface PaymentRequest {
  amount: number;
  currency: string;
  description: string;
}

function createPayment(request: PaymentRequest): Promise<Payment> {
  // ...
}

// ❌ Bad: Implicit any
function createPayment(request) {
  // ...
}
```

### 2. Use Type Inference When Obvious

```typescript
// ✅ Good: Type inference
const name = 'John Doe'; // string (inferred)
const age = 30;          // number (inferred)
const isActive = true;   // boolean (inferred)

// ❌ Bad: Redundant type annotation
const name: string = 'John Doe';
const age: number = 30;
const isActive: boolean = true;
```

### 3. Use Interfaces for Objects, Types for Unions

```typescript
// ✅ Good: Interface for object structure
interface User {
  id: string;
  email: string;
  name: string;
}

// ✅ Good: Type for union
type PaymentStatus = 'DRAFT' | 'OPEN' | 'PAID' | 'EXPIRED' | 'CANCELED';

// ✅ Good: Type for complex types
type ApiResponse<T> = {
  data: T;
  error?: string;
};
```

### 4. Avoid `any`, Use `unknown` Instead

```typescript
// ✅ Good: Use unknown and type guard
function processData(data: unknown): ProcessedData {
  if (isValidData(data)) {
    return transform(data);
  }
  throw new Error('Invalid data');
}

function isValidData(data: unknown): data is ValidData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'field' in data
  );
}

// ❌ Bad: Using any
function processData(data: any) {
  return data.transform();
}
```

### 5. Use Enums for Fixed Sets of Values

```typescript
// ✅ Good: Enum matches Prisma schema
enum PaymentStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  PAID = 'PAID',
  EXPIRED = 'EXPIRED',
  CANCELED = 'CANCELED'
}

// ✅ Good: Use enum in code
function isTerminalStatus(status: PaymentStatus): boolean {
  return status === PaymentStatus.EXPIRED || 
         status === PaymentStatus.CANCELED;
}

// ❌ Bad: Magic strings
function isTerminalStatus(status: string): boolean {
  return status === 'EXPIRED' || status === 'CANCELED';
}
```

### 6. Use Strict Null Checks

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true
  }
}

// ✅ Good: Handle null/undefined
function getUserName(user: User | null): string {
  return user?.name ?? 'Anonymous';
}

// ❌ Bad: Assume non-null
function getUserName(user: User): string {
  return user.name; // Crashes if user is null
}
```

---

## ⚛️ React & Components

### 1. Use Functional Components

```typescript
// ✅ Good: Functional component
interface PaymentCardProps {
  payment: Payment;
  onCancel?: () => void;
}

export function PaymentCard({ payment, onCancel }: PaymentCardProps) {
  return (
    <div className="p-4 border rounded">
      <h3>{payment.description}</h3>
      <p>{formatCurrency(payment.amount, payment.currency)}</p>
      {onCancel && (
        <button onClick={onCancel}>Cancel</button>
      )}
    </div>
  );
}

// ❌ Bad: Class component (avoid)
export class PaymentCard extends React.Component<PaymentCardProps> {
  render() {
    return <div>...</div>;
  }
}
```

### 2. Props Interface Naming

```typescript
// ✅ Good: ComponentName + Props
interface PaymentCardProps {
  payment: Payment;
  onCancel?: () => void;
}

export function PaymentCard(props: PaymentCardProps) {
  // ...
}

// ❌ Bad: Generic or unclear names
interface Props {
  // ...
}

interface IPaymentCard {
  // ...
}
```

### 3. Destructure Props

```typescript
// ✅ Good: Destructure in parameter
export function PaymentCard({ payment, onCancel }: PaymentCardProps) {
  return <div>{payment.amount}</div>;
}

// ❌ Bad: Use props.x
export function PaymentCard(props: PaymentCardProps) {
  return <div>{props.payment.amount}</div>;
}
```

### 4. Use Custom Hooks for Logic

```typescript
// ✅ Good: Extract logic to custom hook
function usePaymentStatus(paymentId: string) {
  const [status, setStatus] = useState<PaymentStatus>();
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchStatus = async () => {
      const data = await getPaymentStatus(paymentId);
      setStatus(data.status);
      setLoading(false);
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [paymentId]);
  
  return { status, loading };
}

// Usage
export function PaymentStatusDisplay({ paymentId }: Props) {
  const { status, loading } = usePaymentStatus(paymentId);
  
  if (loading) return <Spinner />;
  return <StatusBadge status={status} />;
}

// ❌ Bad: Logic in component
export function PaymentStatusDisplay({ paymentId }: Props) {
  const [status, setStatus] = useState<PaymentStatus>();
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // 50 lines of polling logic...
  }, [paymentId]);
  
  if (loading) return <Spinner />;
  return <StatusBadge status={status} />;
}
```

### 5. Memoize Expensive Computations

```typescript
// ✅ Good: Memoize expensive calculation
export function PaymentList({ payments }: Props) {
  const total = useMemo(() => {
    return payments.reduce((sum, p) => sum + p.amount, 0);
  }, [payments]);
  
  return <div>Total: {total}</div>;
}

// ❌ Bad: Calculate on every render
export function PaymentList({ payments }: Props) {
  const total = payments.reduce((sum, p) => sum + p.amount, 0);
  return <div>Total: {total}</div>;
}
```

### 6. Component File Structure

```typescript
// PaymentCard.tsx

// 1. Imports (grouped)
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils/currency';
import type { Payment } from '@/types';

// 2. Type definitions
interface PaymentCardProps {
  payment: Payment;
  onCancel?: (id: string) => void;
}

// 3. Helper functions (if not extracted)
function canCancel(payment: Payment): boolean {
  return payment.status === 'OPEN';
}

// 4. Component
export function PaymentCard({ payment, onCancel }: PaymentCardProps) {
  const [loading, setLoading] = useState(false);
  
  const handleCancel = useCallback(async () => {
    setLoading(true);
    await onCancel?.(payment.id);
    setLoading(false);
  }, [payment.id, onCancel]);
  
  return (
    <div className="payment-card">
      <h3>{payment.description}</h3>
      <p>{formatCurrency(payment.amount, payment.currency)}</p>
      {canCancel(payment) && (
        <Button onClick={handleCancel} disabled={loading}>
          Cancel
        </Button>
      )}
    </div>
  );
}
```

---

## 🔌 API Routes

### 1. Use Zod for Validation

```typescript
// ✅ Good: Zod validation
import { z } from 'zod';

const CreatePaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  description: z.string().min(1).max(200)
});

export async function POST(request: Request) {
  const body = await request.json();
  
  const result = CreatePaymentSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: 'Validation failed', details: result.error },
      { status: 400 }
    );
  }
  
  // Use validated data
  const payment = await createPayment(result.data);
  return Response.json(payment, { status: 201 });
}

// ❌ Bad: Manual validation
export async function POST(request: Request) {
  const body = await request.json();
  
  if (!body.amount || body.amount <= 0) {
    return Response.json({ error: 'Invalid amount' }, { status: 400 });
  }
  
  if (!body.currency || body.currency.length !== 3) {
    return Response.json({ error: 'Invalid currency' }, { status: 400 });
  }
  
  // ... more manual checks
}
```

### 2. Consistent Error Responses

```typescript
// ✅ Good: Consistent error format
interface ErrorResponse {
  error: string;
  details?: unknown;
  code?: string;
}

function errorResponse(
  error: string,
  status: number,
  details?: unknown
): Response {
  return Response.json(
    { error, details } as ErrorResponse,
    { status }
  );
}

export async function GET(request: Request) {
  try {
    const data = await fetchData();
    return Response.json({ data });
  } catch (error) {
    console.error('Fetch error:', error);
    return errorResponse('Failed to fetch data', 500);
  }
}

// ❌ Bad: Inconsistent error format
export async function GET(request: Request) {
  try {
    const data = await fetchData();
    return Response.json({ data });
  } catch (error) {
    return Response.json({ message: 'Error' }, { status: 500 });
  }
}
```

### 3. Use Proper HTTP Status Codes

```typescript
// ✅ Good: Appropriate status codes
export async function GET(request: Request) {
  const payment = await getPayment(id);
  
  if (!payment) {
    return Response.json(
      { error: 'Payment not found' },
      { status: 404 }
    );
  }
  
  return Response.json({ data: payment }, { status: 200 });
}

export async function POST(request: Request) {
  const payment = await createPayment(data);
  return Response.json({ data: payment }, { status: 201 });
}

export async function PUT(request: Request) {
  const payment = await updatePayment(id, data);
  return Response.json({ data: payment }, { status: 200 });
}

export async function DELETE(request: Request) {
  await deletePayment(id);
  return new Response(null, { status: 204 });
}
```

### 4. Extract Business Logic

```typescript
// ✅ Good: Business logic in service layer
// src/lib/payment-link/payment-link-service.ts
export async function createPaymentLink(
  data: CreatePaymentRequest
): Promise<PaymentLink> {
  // Business logic here
  const shortCode = generateShortCode();
  const fxSnapshots = await captureFxSnapshots(data);
  
  return await prisma.payment_links.create({
    data: {
      ...data,
      short_code: shortCode,
      fx_snapshots: {
        create: fxSnapshots
      }
    }
  });
}

// src/app/api/payment-links/route.ts
export async function POST(request: Request) {
  const body = await request.json();
  const result = CreatePaymentSchema.safeParse(body);
  
  if (!result.success) {
    return errorResponse('Validation failed', 400, result.error);
  }
  
  const payment = await createPaymentLink(result.data);
  return Response.json({ data: payment }, { status: 201 });
}

// ❌ Bad: Business logic in route
export async function POST(request: Request) {
  const body = await request.json();
  
  // 100 lines of business logic in route handler...
  const shortCode = Math.random().toString(36).substring(7);
  const fxSnapshots = await fetch('...');
  // ...
}
```

---

## 🗄️ Database & Prisma

### 1. Use Transactions for Multi-Step Operations

```typescript
// ✅ Good: Use transaction
async function confirmPayment(paymentLinkId: string) {
  await prisma.$transaction(async (tx) => {
    // 1. Update payment link
    await tx.payment_links.update({
      where: { id: paymentLinkId },
      data: { status: 'PAID' }
    });
    
    // 2. Create payment event
    await tx.payment_events.create({
      data: {
        payment_link_id: paymentLinkId,
        event_type: 'PAYMENT_CONFIRMED'
      }
    });
    
    // 3. Create ledger entries
    await tx.ledger_entries.createMany({
      data: [
        { /* debit entry */ },
        { /* credit entry */ }
      ]
    });
  });
}

// ❌ Bad: No transaction (can fail partially)
async function confirmPayment(paymentLinkId: string) {
  await prisma.payment_links.update({ /* ... */ });
  await prisma.payment_events.create({ /* ... */ });
  await prisma.ledger_entries.createMany({ /* ... */ });
}
```

### 2. Use Selective Field Loading

```typescript
// ✅ Good: Only select needed fields
const payment = await prisma.payment_links.findUnique({
  where: { id },
  select: {
    id: true,
    amount: true,
    currency: true,
    status: true,
    description: true
  }
});

// ❌ Bad: Fetch all fields
const payment = await prisma.payment_links.findUnique({
  where: { id }
});
```

### 3. Use Cursor-Based Pagination

```typescript
// ✅ Good: Cursor-based pagination (efficient)
async function listPayments(cursor?: string, limit = 20) {
  return await prisma.payment_links.findMany({
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { created_at: 'desc' }
  });
}

// ❌ Bad: Offset pagination (slow for large datasets)
async function listPayments(page: number, limit = 20) {
  return await prisma.payment_links.findMany({
    skip: page * limit,
    take: limit,
    orderBy: { created_at: 'desc' }
  });
}
```

### 4. Handle Unique Constraint Violations

```typescript
// ✅ Good: Handle Prisma errors
import { Prisma } from '@prisma/client';

async function createPaymentLink(data: CreatePaymentRequest) {
  try {
    return await prisma.payment_links.create({ data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // Unique constraint violation
        throw new Error('Payment link with this code already exists');
      }
    }
    throw error;
  }
}

// ❌ Bad: Don't catch Prisma errors
async function createPaymentLink(data: CreatePaymentRequest) {
  return await prisma.payment_links.create({ data });
  // Prisma error bubbles up as generic error
}
```

---

## 📛 Naming Conventions

### 1. Files

```
// Components (PascalCase)
PaymentCard.tsx
CreatePaymentDialog.tsx
StatusBadge.tsx

// Utilities (kebab-case)
format-currency.ts
generate-short-code.ts
validate-email.ts

// API Routes (kebab-case)
route.ts (in app/api/payment-links/)
[id]/route.ts

// Services (kebab-case)
payment-link-service.ts
xero-sync-service.ts
ledger-service.ts

// Types (PascalCase or kebab-case)
payment-types.ts
xero-types.ts
```

### 2. Variables & Functions

```typescript
// camelCase for variables and functions
const paymentLink = await getPaymentLink(id);
const isValid = validatePayment(payment);
const formattedAmount = formatCurrency(amount, currency);

// PascalCase for classes and components
class PaymentLinkService {}
function PaymentCard() {}

// SCREAMING_SNAKE_CASE for constants
const MAX_RETRY_ATTEMPTS = 5;
const API_BASE_URL = 'https://api.example.com';
const STRIPE_WEBHOOK_TIMEOUT_MS = 30000;
```

### 3. TypeScript Types

```typescript
// PascalCase for interfaces and types
interface PaymentLink {}
type PaymentStatus = 'DRAFT' | 'OPEN' | 'PAID';

// Suffix for specific types
interface PaymentCardProps {}      // Component props
interface CreatePaymentRequest {}  // API request
interface PaymentResponse {}       // API response
type PaymentEventType = 'CREATED' | 'CONFIRMED';

// Avoid Hungarian notation
// ✅ Good
interface User {
  id: string;
  name: string;
}

// ❌ Bad
interface IUser {
  strId: string;
  strName: string;
}
```

---

## 📁 File Organization

### Project Structure

```
src/
├── app/                        # Next.js app router
│   ├── api/                   # API routes
│   │   ├── payment-links/
│   │   │   ├── route.ts       # POST, GET /api/payment-links
│   │   │   └── [id]/
│   │   │       └── route.ts   # GET, PUT, DELETE /api/payment-links/[id]
│   │   └── webhooks/
│   │       ├── stripe/
│   │       │   └── route.ts
│   │       └── resend/
│   │           └── route.ts
│   ├── (dashboard)/           # Dashboard pages (protected)
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── payments/
│   │       └── page.tsx
│   └── pay/                   # Public payment pages
│       └── [shortCode]/
│           └── page.tsx
├── components/                 # React components
│   ├── ui/                    # Base UI components (shadcn)
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── payment/               # Payment-specific components
│   │   ├── PaymentCard.tsx
│   │   └── PaymentStatusBadge.tsx
│   └── layout/                # Layout components
│       ├── Navbar.tsx
│       └── Sidebar.tsx
├── lib/                       # Business logic & utilities
│   ├── db/                    # Database utilities
│   │   ├── prisma.ts
│   │   └── seed.ts
│   ├── payment-link/          # Payment link domain
│   │   ├── payment-link-service.ts
│   │   ├── short-code-generator.ts
│   │   └── state-machine.ts
│   ├── fx/                    # FX snapshot domain
│   │   ├── fx-snapshot-service.ts
│   │   └── rate-providers.ts
│   ├── ledger/                # Ledger domain
│   │   ├── ledger-service.ts
│   │   └── balance-validator.ts
│   ├── xero/                  # Xero integration
│   │   ├── xero-client.ts
│   │   └── xero-sync-service.ts
│   └── utils/                 # Shared utilities
│       ├── currency.ts
│       ├── validation.ts
│       └── date.ts
├── hooks/                     # Custom React hooks
│   ├── usePaymentStatus.ts
│   └── useIsMobile.ts
├── types/                     # TypeScript types
│   ├── payment.ts
│   └── xero.ts
├── prisma/                    # Database schema
│   ├── schema.prisma
│   └── migrations/
└── __tests__/                 # Tests
    ├── integration/
    └── performance/
```

---

## 💬 Comments & Documentation

### 1. When to Comment

```typescript
// ✅ Good: Explain WHY, not WHAT
// Use exponential backoff to avoid overwhelming Xero API
// which has a rate limit of 60 requests per minute
const retryDelays = [60000, 300000, 900000, 3600000, 21600000];

// ✅ Good: Document complex logic
// FX snapshots are captured at two points:
// 1. CREATION: When payment link is created (for display)
// 2. SETTLEMENT: When payment is confirmed (for accounting)
// This ensures accurate FX rates for revenue recognition
async function captureFxSnapshots(/* ... */) {
  // ...
}

// ❌ Bad: State the obvious
// Loop through payments
for (const payment of payments) {
  // Add amount to total
  total += payment.amount;
}
```

### 2. JSDoc for Public APIs

```typescript
/**
 * Creates a new payment link with FX snapshots.
 * 
 * @param data - Payment link creation data
 * @returns Promise resolving to created payment link with snapshots
 * @throws {ValidationError} If input data is invalid
 * @throws {DatabaseError} If database operation fails
 * 
 * @example
 * ```typescript
 * const payment = await createPaymentLink({
 *   organizationId: 'org-123',
 *   amount: 100.00,
 *   currency: 'USD',
 *   description: 'Invoice #1234'
 * });
 * ```
 */
export async function createPaymentLink(
  data: CreatePaymentRequest
): Promise<PaymentLink> {
  // ...
}
```

### 3. TODO Comments

```typescript
// TODO(username): Add support for partial payments
// See: https://github.com/provvypay/provvypay/issues/123
function processPayment(/* ... */) {
  // ...
}

// FIXME: This calculation is incorrect for leap years
function calculateDaysUntilExpiry(/* ... */) {
  // ...
}

// HACK: Temporary workaround for Xero API bug
// Remove when Xero fixes issue on their end (ETA: Q1 2026)
if (isXeroApiError(error)) {
  // ...
}
```

---

## ⚠️ Error Handling

### 1. Use Try-Catch for Async Operations

```typescript
// ✅ Good: Handle errors
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payment = await createPayment(body);
    return Response.json({ data: payment });
  } catch (error) {
    console.error('Payment creation failed:', error);
    
    if (error instanceof ValidationError) {
      return Response.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ❌ Bad: No error handling
export async function POST(request: Request) {
  const body = await request.json();
  const payment = await createPayment(body);
  return Response.json({ data: payment });
}
```

### 2. Custom Error Classes

```typescript
// ✅ Good: Custom error classes
export class ValidationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} with ID ${id} not found`);
    this.name = 'NotFoundError';
  }
}

// Usage
if (!payment) {
  throw new NotFoundError('Payment', id);
}

// ❌ Bad: Generic errors
if (!payment) {
  throw new Error('Not found');
}
```

### 3. Log Errors with Context

```typescript
// ✅ Good: Log with context
try {
  await syncToXero(paymentId);
} catch (error) {
  console.error('Xero sync failed', {
    paymentId,
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString()
  });
  throw error;
}

// ❌ Bad: Minimal logging
try {
  await syncToXero(paymentId);
} catch (error) {
  console.log('Error');
  throw error;
}
```

---

## 🧪 Testing

### 1. Test File Naming

```
// Component tests (same directory)
src/components/PaymentCard.tsx
src/components/__tests__/PaymentCard.test.tsx

// Service tests
src/lib/payment-link/payment-link-service.ts
src/lib/payment-link/__tests__/payment-link-service.test.ts

// Integration tests
src/__tests__/integration/payment-flow.test.ts
```

### 2. Test Structure

```typescript
describe('PaymentLinkService', () => {
  describe('createPaymentLink', () => {
    it('should create payment link with valid data', async () => {
      // Arrange
      const data = {
        organizationId: 'org-123',
        amount: 100.00,
        currency: 'USD',
        description: 'Test payment'
      };
      
      // Act
      const result = await createPaymentLink(data);
      
      // Assert
      expect(result.id).toBeDefined();
      expect(result.amount).toBe(100.00);
      expect(result.status).toBe('DRAFT');
    });
    
    it('should reject negative amounts', async () => {
      // Arrange
      const data = {
        organizationId: 'org-123',
        amount: -10.00,
        currency: 'USD',
        description: 'Test'
      };
      
      // Act & Assert
      await expect(createPaymentLink(data))
        .rejects
        .toThrow('Amount must be positive');
    });
  });
});
```

---

## 🔧 ESLint Configuration

```javascript
// eslint.config.mjs
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
```

---

## 📖 Related Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [Contributing Guidelines](./CONTRIBUTING.md)
- [Local Development Setup](./LOCAL_DEV_SETUP.md)

---

**Last Updated:** December 16, 2025  
**Maintained By:** Provvypay Engineering Team







