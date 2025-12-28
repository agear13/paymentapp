# Contributing to Provvypay

Thank you for your interest in contributing to Provvypay! This document provides guidelines and instructions for contributing to the project.

---

## 📋 Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [Commit Guidelines](#commit-guidelines)
6. [Pull Request Process](#pull-request-process)
7. [Testing Requirements](#testing-requirements)
8. [Documentation](#documentation)
9. [Issue Reporting](#issue-reporting)

---

## 🤝 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors. We expect:

- **Respect:** Treat all contributors with respect and empathy
- **Collaboration:** Work together constructively
- **Inclusivity:** Welcome contributions from everyone
- **Professionalism:** Maintain professional communication

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Trolling or insulting/derogatory remarks
- Publishing others' private information
- Any conduct that could reasonably be considered inappropriate

---

## 🚀 Getting Started

### Prerequisites

1. **Read the Documentation**
   - [Architecture Overview](./ARCHITECTURE.md)
   - [Local Development Setup](./LOCAL_DEV_SETUP.md)
   - [Code Style Guide](./CODE_STYLE_GUIDE.md)

2. **Set Up Your Environment**
   - Node.js 18+ installed
   - Git configured
   - IDE set up (VS Code recommended)
   - Local development environment running

3. **Fork the Repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/provvypay.git
   cd provvypay
   
   # Add upstream remote
   git remote add upstream https://github.com/provvypay/provvypay.git
   ```

4. **Install Dependencies**
   ```bash
   npm install
   ```

5. **Set Up Environment**
   ```bash
   # Copy environment template
   cp .env.example .env.local
   
   # Configure your local environment variables
   # See LOCAL_DEV_SETUP.md for details
   ```

---

## 🔄 Development Workflow

### 1. Create a Feature Branch

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create a feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### Branch Naming Convention

- `feature/` - New features (e.g., `feature/add-refund-support`)
- `fix/` - Bug fixes (e.g., `fix/payment-validation-error`)
- `docs/` - Documentation only (e.g., `docs/update-api-reference`)
- `refactor/` - Code refactoring (e.g., `refactor/payment-service`)
- `test/` - Test additions/fixes (e.g., `test/add-hedera-payment-tests`)
- `chore/` - Maintenance tasks (e.g., `chore/update-dependencies`)

### 2. Make Your Changes

```bash
# Make your changes
# ... code, code, code ...

# Run linting
npm run lint

# Run tests
npm test

# Check TypeScript
npx tsc --noEmit
```

### 3. Commit Your Changes

See [Commit Guidelines](#commit-guidelines) below.

### 4. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 5. Create a Pull Request

See [Pull Request Process](#pull-request-process) below.

---

## 💻 Coding Standards

### TypeScript Best Practices

#### 1. Use Strong Typing
```typescript
// ✅ Good
interface PaymentRequest {
  amount: number;
  currency: string;
  description: string;
}

function createPayment(request: PaymentRequest): Promise<Payment> {
  // ...
}

// ❌ Bad
function createPayment(request: any): any {
  // ...
}
```

#### 2. Use Enums for Fixed Values
```typescript
// ✅ Good
enum PaymentStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  PAID = 'PAID'
}

// ❌ Bad
const status: string = 'OPEN'; // Magic string
```

#### 3. Avoid `any` Type
```typescript
// ✅ Good
function processData(data: unknown): ProcessedData {
  if (isValidData(data)) {
    return transformData(data);
  }
  throw new Error('Invalid data');
}

// ❌ Bad
function processData(data: any) {
  return data.transform();
}
```

### React Best Practices

#### 1. Use Functional Components
```typescript
// ✅ Good
export function PaymentCard({ payment }: PaymentCardProps) {
  return <div>{payment.amount}</div>;
}

// ❌ Bad (avoid class components)
export class PaymentCard extends React.Component {
  render() {
    return <div>{this.props.payment.amount}</div>;
  }
}
```

#### 2. Use Custom Hooks
```typescript
// ✅ Good
function usePaymentStatus(paymentId: string) {
  const [status, setStatus] = useState<PaymentStatus>();
  
  useEffect(() => {
    const pollStatus = async () => {
      const data = await fetchPaymentStatus(paymentId);
      setStatus(data.status);
    };
    
    const interval = setInterval(pollStatus, 3000);
    return () => clearInterval(interval);
  }, [paymentId]);
  
  return status;
}

// Usage
function PaymentPage({ paymentId }: Props) {
  const status = usePaymentStatus(paymentId);
  return <div>Status: {status}</div>;
}
```

#### 3. Memoize Expensive Computations
```typescript
// ✅ Good
const formattedAmount = useMemo(
  () => formatCurrency(amount, currency),
  [amount, currency]
);

// ❌ Bad (recalculates on every render)
const formattedAmount = formatCurrency(amount, currency);
```

### API Route Best Practices

#### 1. Use Zod for Validation
```typescript
import { z } from 'zod';

const CreatePaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  description: z.string().min(1).max(200)
});

export async function POST(request: Request) {
  const body = await request.json();
  
  // Validate
  const result = CreatePaymentSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: 'Validation failed', details: result.error },
      { status: 400 }
    );
  }
  
  // Process validated data
  const payment = await createPayment(result.data);
  return Response.json(payment);
}
```

#### 2. Use Proper HTTP Status Codes
```typescript
// 200 - Success
return Response.json({ data });

// 201 - Created
return Response.json({ data }, { status: 201 });

// 400 - Bad Request (client error)
return Response.json({ error: 'Invalid input' }, { status: 400 });

// 401 - Unauthorized
return Response.json({ error: 'Authentication required' }, { status: 401 });

// 403 - Forbidden
return Response.json({ error: 'Access denied' }, { status: 403 });

// 404 - Not Found
return Response.json({ error: 'Resource not found' }, { status: 404 });

// 500 - Internal Server Error
return Response.json({ error: 'Internal error' }, { status: 500 });
```

#### 3. Use Try-Catch for Error Handling
```typescript
export async function GET(request: Request) {
  try {
    const data = await fetchData();
    return Response.json({ data });
  } catch (error) {
    console.error('Error fetching data:', error);
    
    // Return user-friendly error
    return Response.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
```

### Database Best Practices

#### 1. Use Prisma Transactions
```typescript
// ✅ Good (atomic operation)
await prisma.$transaction(async (tx) => {
  const payment = await tx.payment_links.update({
    where: { id },
    data: { status: 'PAID' }
  });
  
  await tx.ledger_entries.createMany({
    data: [
      { /* debit entry */ },
      { /* credit entry */ }
    ]
  });
});

// ❌ Bad (non-atomic, can fail partially)
await prisma.payment_links.update({ /* ... */ });
await prisma.ledger_entries.createMany({ /* ... */ });
```

#### 2. Use Selective Field Loading
```typescript
// ✅ Good (only fetch needed fields)
const payment = await prisma.payment_links.findUnique({
  where: { id },
  select: {
    id: true,
    amount: true,
    currency: true,
    status: true
  }
});

// ❌ Bad (fetches all fields)
const payment = await prisma.payment_links.findUnique({
  where: { id }
});
```

#### 3. Use Indexes for Queries
```typescript
// If querying by organization_id and status frequently,
// ensure index exists in schema.prisma:
@@index([organization_id, status])
```

---

## 📝 Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat:** New feature
- **fix:** Bug fix
- **docs:** Documentation changes
- **style:** Code style changes (formatting, no logic change)
- **refactor:** Code refactoring
- **test:** Adding or updating tests
- **chore:** Maintenance tasks (dependencies, config)
- **perf:** Performance improvements

### Examples

```bash
# Feature
git commit -m "feat(payments): add AUDD token support"

# Bug fix
git commit -m "fix(ledger): correct balance calculation for crypto payments"

# Documentation
git commit -m "docs(api): update authentication guide"

# Refactor
git commit -m "refactor(xero): extract sync logic to service"

# Test
git commit -m "test(payments): add Hedera payment flow tests"
```

### Multi-line Commits

```bash
git commit -m "feat(notifications): add email notification system

- Integrate Resend for email delivery
- Add email templates for payment confirmed/failed
- Implement notification preferences
- Add email logs table for tracking

Closes #123"
```

---

## 🔀 Pull Request Process

### 1. Create Pull Request

1. Go to your fork on GitHub
2. Click "New Pull Request"
3. Select your branch
4. Fill out the PR template

### 2. PR Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Changes Made
- List key changes
- Be specific

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots for UI changes.

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added/updated
- [ ] All tests passing
```

### 3. PR Review Process

1. **Automated Checks** (must pass)
   - TypeScript compilation
   - ESLint (no errors)
   - Jest tests (all passing)
   - Build successful

2. **Code Review**
   - At least one approval required
   - Address reviewer feedback
   - Make requested changes

3. **Merge**
   - Squash and merge (preferred)
   - Delete branch after merge

### 4. What to Expect

- **Response Time:** Maintainers will review within 48 hours
- **Feedback:** Expect constructive feedback and suggestions
- **Revisions:** Be prepared to make changes
- **Approval:** At least one maintainer approval required

---

## 🧪 Testing Requirements

### Unit Tests Required

All new features must include unit tests:

```typescript
// Example: src/__tests__/payment-service.test.ts
import { createPaymentLink } from '@/lib/payment-link/payment-link-service';

describe('PaymentLinkService', () => {
  describe('createPaymentLink', () => {
    it('should create a payment link with valid data', async () => {
      const data = {
        organizationId: 'org-123',
        amount: 100.00,
        currency: 'USD',
        description: 'Test payment'
      };
      
      const result = await createPaymentLink(data);
      
      expect(result.id).toBeDefined();
      expect(result.amount).toBe(100.00);
      expect(result.status).toBe('DRAFT');
    });
    
    it('should reject negative amounts', async () => {
      const data = {
        organizationId: 'org-123',
        amount: -10.00,
        currency: 'USD',
        description: 'Test'
      };
      
      await expect(createPaymentLink(data)).rejects.toThrow(
        'Amount must be positive'
      );
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- payment-service.test.ts

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Test Coverage Requirements

- **Minimum:** 70% overall coverage
- **Critical paths:** 90%+ coverage (payment processing, ledger, Xero sync)
- **New code:** Should not decrease overall coverage

---

## 📖 Documentation

### When to Update Documentation

- New features → Update API docs, user guides
- Bug fixes → Update troubleshooting guides
- Architecture changes → Update ARCHITECTURE.md
- Database changes → Update DATABASE_SCHEMA.md
- API changes → Update API_DOCUMENTATION.md

### Documentation Style

- **Clear and concise:** Avoid jargon
- **Examples:** Include code examples
- **Screenshots:** Add for UI features
- **Version:** Note version when feature was added

### Inline Code Comments

```typescript
// ✅ Good: Explain WHY, not WHAT
// Use idempotency key to prevent duplicate postings when webhook is replayed
const idempotencyKey = `${paymentLinkId}-${timestamp}`;

// ❌ Bad: States the obvious
// Create idempotency key
const idempotencyKey = `${paymentLinkId}-${timestamp}`;
```

---

## 🐛 Issue Reporting

### Before Submitting an Issue

1. **Search existing issues** - Your issue may already be reported
2. **Check documentation** - Answer might be in docs
3. **Reproduce the bug** - Ensure it's reproducible

### Bug Report Template

```markdown
## Bug Description
Clear description of the bug.

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Environment
- OS: [e.g., macOS 14.0]
- Browser: [e.g., Chrome 120]
- Node version: [e.g., 18.17.0]
- Provvypay version: [e.g., 1.0.0]

## Screenshots
If applicable.

## Additional Context
Any other relevant information.
```

### Feature Request Template

```markdown
## Feature Description
Clear description of the proposed feature.

## Use Case
Why is this feature needed? Who will benefit?

## Proposed Solution
How should this feature work?

## Alternatives Considered
Any alternative approaches?

## Additional Context
Any other relevant information.
```

---

## 🏆 Recognition

Contributors will be recognized in:
- `CONTRIBUTORS.md` file
- Release notes (for significant contributions)
- GitHub contributors page

---

## ❓ Questions?

- **Documentation:** Check [docs](./README.md)
- **Slack/Discord:** Join our community (if available)
- **Email:** engineering@provvypay.com
- **GitHub Discussions:** Ask questions in Discussions tab

---

## 📜 License

By contributing to Provvypay, you agree that your contributions will be licensed under the same license as the project.

---

## 🙏 Thank You!

Your contributions make Provvypay better for everyone. We appreciate your time and effort!

---

**Last Updated:** December 16, 2025  
**Maintained By:** Provvypay Engineering Team







