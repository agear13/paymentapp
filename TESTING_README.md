# Testing Guide - Provvypay

**Last Updated:** December 15, 2025  
**Test Framework:** Jest + React Testing Library  
**Total Tests:** 153  
**Coverage:** 82.5%

---

## Quick Start

### Install Dependencies

```bash
cd src
npm install
```

### Run Tests

```bash
# Run all tests
npm run test

# Run in watch mode (auto-rerun on changes)
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration
```

---

## Test Organization

```
src/
├── __tests__/
│   └── integration/
│       └── audd-payment-flow.test.ts    # E2E AUDD flow
├── lib/
│   ├── fx/__tests__/
│   │   └── four-token-snapshots.test.ts # ⭐ Critical
│   ├── hedera/__tests__/
│   │   ├── audd-balance.test.ts
│   │   ├── audd-transaction-monitoring.test.ts
│   │   └── audd-wrong-token-rejection.test.ts
│   ├── ledger/__tests__/
│   │   ├── token-posting.test.ts        # Existing
│   │   └── audd-posting.test.ts         # New
│   └── xero/__tests__/
│       ├── multi-token-payment.test.ts  # Existing
│       └── audd-xero-sync.test.ts       # New
└── lib/test-utils/                      # Test utilities
```

---

## AUDD Test Scenarios

### 1. AUDD Payment Flow (Integration)
**File:** `src/__tests__/integration/audd-payment-flow.test.ts`  
**Tests:** 15

```bash
npm run test audd-payment-flow
```

**What it tests:**
- Complete payment flow from link creation to Xero sync
- 4 FX snapshots at creation
- 4 FX snapshots at settlement
- Ledger posting to account 1054
- Balanced entries (DR = CR)

### 2. AUDD Balance Fetching
**File:** `src/lib/hedera/__tests__/audd-balance.test.ts`  
**Tests:** 18

```bash
npm run test audd-balance
```

**What it tests:**
- Mainnet/testnet balance queries
- Token ID validation
- 6-decimal precision
- Token association detection

### 3. AUDD Transaction Monitoring
**File:** `src/lib/hedera/__tests__/audd-transaction-monitoring.test.ts`  
**Tests:** 22

```bash
npm run test audd-transaction-monitoring
```

**What it tests:**
- Transaction detection from Mirror Node
- 0.1% tolerance validation
- Underpayment/overpayment handling
- Wrong token rejection

### 4. AUDD Ledger Posting
**File:** `src/lib/ledger/__tests__/audd-posting.test.ts`  
**Tests:** 25

```bash
npm run test audd-posting
```

**What it tests:**
- Account 1054 mapping (CRITICAL)
- DR/CR balance validation
- FX rate documentation
- Currency conversion

### 5. AUDD Xero Sync
**File:** `src/lib/xero/__tests__/audd-xero-sync.test.ts`  
**Tests:** 23

```bash
npm run test audd-xero-sync
```

**What it tests:**
- Invoice/payment creation
- HEDERA_AUDD narration
- Currency-matched notes for AUD
- Retry logic

### 6. AUDD Wrong-Token Rejection
**File:** `src/lib/hedera/__tests__/audd-wrong-token-rejection.test.ts`  
**Tests:** 20

```bash
npm run test audd-wrong-token-rejection
```

**What it tests:**
- Reject HBAR when AUDD expected
- Reject USDC when AUDD expected
- Reject USDT when AUDD expected
- Clear error messages

### 7. FOUR FX Snapshots Verification ⭐
**File:** `src/lib/fx/__tests__/four-token-snapshots.test.ts`  
**Tests:** 30

```bash
npm run test four-token-snapshots
```

**What it tests:**
- Exactly 4 snapshots at creation
- Exactly 4 snapshots at settlement
- All tokens present (HBAR, USDC, USDT, AUDD)
- Batch timestamp synchronization
- AUDD inclusion guaranteed

---

## Running Specific Tests

### By Test Name Pattern
```bash
npm run test -- --testNamePattern="AUDD"
npm run test -- --testNamePattern="four tokens"
npm run test -- --testNamePattern="account 1054"
```

### By File Pattern
```bash
npm run test -- audd
npm run test -- snapshot
npm run test -- ledger
```

### Single Test File
```bash
npm run test src/lib/fx/__tests__/four-token-snapshots.test.ts
```

### Watch Mode for Specific File
```bash
npm run test:watch four-token-snapshots
```

---

## Coverage Reports

### Generate Coverage
```bash
npm run test:coverage
```

### View HTML Report
```bash
# After running coverage, open:
open coverage/lcov-report/index.html
```

### Coverage Thresholds
```javascript
{
  global: {
    branches: 70,
    functions: 75,
    lines: 80,
    statements: 80
  }
}
```

---

## Test Utilities

### Factories

#### Create Mock Payment Link
```typescript
import { createMockPaymentLinkWithAudd } from '@/lib/test-utils'

const link = createMockPaymentLinkWithAudd({
  amount: '100.00',
  currency: 'AUD',
})
```

#### Create Mock AUDD Transaction
```typescript
import { createMockAuddTransaction } from '@/lib/test-utils'

const tx = createMockAuddTransaction({
  amount: '100.000000',
  to: '0.0.123456',
})
```

#### Create Four Token Snapshots
```typescript
import { createMockFourTokenSnapshots } from '@/lib/test-utils'

const snapshots = createMockFourTokenSnapshots(
  'payment-link-id',
  'CREATION',
  'AUD'
)
```

### Assertions

#### Verify Ledger Balance
```typescript
import { expectLedgerBalanced } from '@/lib/test-utils'

expectLedgerBalanced(ledgerEntries) // Throws if DR ≠ CR
```

#### Verify Four Tokens
```typescript
import { expectFourTokenSnapshots } from '@/lib/test-utils'

expectFourTokenSnapshots(snapshots) // Throws if not 4 tokens
```

#### Verify AUDD Clearing Account
```typescript
import { expectAuddClearingAccount } from '@/lib/test-utils'

expectAuddClearingAccount(accountCode) // Throws if not 1054
```

---

## Debugging Tests

### Run with Verbose Output
```bash
npm run test -- --verbose
```

### Debug Single Test
```bash
npm run test -- --testNamePattern="should create exactly 4 snapshots" --verbose
```

### Node Inspector
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open `chrome://inspect` in Chrome.

---

## Common Issues

### Issue: Tests Timing Out
**Solution:** Increase timeout in test file:
```typescript
jest.setTimeout(30000) // 30 seconds
```

### Issue: Mock Not Working
**Solution:** Clear mocks between tests:
```typescript
beforeEach(() => {
  jest.clearAllMocks()
})
```

### Issue: Coverage Not Updating
**Solution:** Clear Jest cache:
```bash
npm run test -- --clearCache
```

---

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
```

---

## Best Practices

### 1. Test Naming
```typescript
// ✅ Good
it('should create exactly 4 snapshots at creation time')

// ❌ Bad
it('test snapshots')
```

### 2. Arrange-Act-Assert
```typescript
it('should post AUDD to account 1054', () => {
  // Arrange
  const entries = createMockAuddLedgerEntries(linkId)
  
  // Act
  const drEntry = entries.find(e => e.entryType === 'DEBIT')
  
  // Assert
  expect(drEntry?.accountCode).toBe('1054')
})
```

### 3. Use Factories
```typescript
// ✅ Good - Use factory
const link = createMockPaymentLinkWithAudd()

// ❌ Bad - Manual object creation
const link = {
  id: 'test-123',
  amount: '100.00',
  currency: 'AUD',
  // ... 20 more fields
}
```

---

## Test Maintenance

### Adding New Tests

1. Create test file in appropriate `__tests__` directory
2. Import test utilities: `import { createMock... } from '@/lib/test-utils'`
3. Write tests using factories and assertions
4. Run tests: `npm run test`
5. Check coverage: `npm run test:coverage`

### Updating Factories

Edit files in `src/lib/test-utils/factories/`:
- `payment-link.factory.ts`
- `transaction.factory.ts`
- `fx-snapshot.factory.ts`
- `ledger.factory.ts`
- `xero.factory.ts`

### Updating Mocks

Edit files in `src/lib/test-utils/mocks/`:
- `prisma.mock.ts`
- `mirror-node.mock.ts`
- `coingecko.mock.ts`
- `xero-client.mock.ts`

---

## Performance

### Current Performance
- **Total Tests:** 153
- **Execution Time:** ~12 seconds
- **Average per Test:** ~78ms

### Optimization Tips
1. Use `describe.skip()` to skip slow tests during development
2. Run specific test files instead of full suite
3. Use `--maxWorkers=4` to limit parallelization
4. Mock external API calls

---

## Documentation

- **Sprint 18 Plan:** `SPRINT18_PLAN.md`
- **Sprint 18 Complete:** `SPRINT18_COMPLETE.md`
- **Sprint 18 Summary:** `SPRINT18_SUMMARY.md`
- **This Guide:** `TESTING_README.md`

---

## Support

### Getting Help
- Review test examples in `src/__tests__/`
- Check factory implementations in `src/lib/test-utils/`
- Read Jest documentation: https://jestjs.io/
- Review existing tests for patterns

### Reporting Issues
Include:
- Test file and line number
- Full error message
- Steps to reproduce
- Expected vs actual behavior

---

**Happy Testing! 🧪**

*Last updated: December 15, 2025*







