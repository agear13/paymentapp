# Sprint 18: Testing Infrastructure & AUDD Test Scenarios

**Sprint Duration:** December 15, 2025  
**Status:** In Progress  
**Focus:** Comprehensive testing infrastructure with AUDD-specific test coverage

---

## 🎯 Sprint Objectives

1. **Set up comprehensive testing infrastructure** with Jest and React Testing Library
2. **Create AUDD-specific test scenarios** for all payment flows
3. **Verify FOUR FX snapshots** are captured per payment link
4. **Ensure AUDD integration** is fully tested before production
5. **Achieve 80%+ code coverage** on critical payment paths

---

## 📦 Deliverables

### 1. Testing Infrastructure Setup ✅

#### Jest Configuration
- [ ] Install Jest and related dependencies
- [ ] Configure Jest for Next.js and TypeScript
- [ ] Set up test utilities and mocks
- [ ] Configure code coverage reporting
- [ ] Create test data factories
- [ ] Set up database mocking utilities

**Files:**
- `jest.config.js` - Jest configuration
- `jest.setup.js` - Global test setup
- `src/lib/test-utils/` - Test utilities and helpers
- `src/lib/test-utils/factories/` - Test data factories
- `src/lib/test-utils/mocks/` - Mock implementations

### 2. AUDD Payment Flow Tests 🇦🇺

#### Test: AUDD Payment Flow (End-to-End)
**File:** `src/__tests__/integration/audd-payment-flow.test.ts`

**Scenarios:**
- [ ] Create payment link with AUD currency
- [ ] Verify AUDD token is available as payment option
- [ ] Connect wallet and select AUDD token
- [ ] Calculate correct AUDD amount required
- [ ] Monitor for AUDD transaction
- [ ] Validate AUDD payment within tolerance (0.1%)
- [ ] Confirm payment link status updates to PAID
- [ ] Verify all data persisted correctly

**Acceptance Criteria:**
- ✅ Full flow completes without errors
- ✅ AUDD token appears in payment options
- ✅ Correct AUDD amount calculated (1:1 with AUD)
- ✅ Transaction detection within 30 seconds
- ✅ Payment link status updates correctly

### 3. AUDD Token Balance Fetching Tests

#### Test: AUDD Balance Fetching
**File:** `src/lib/hedera/__tests__/audd-balance.test.ts`

**Scenarios:**
- [ ] Fetch AUDD balance for testnet account
- [ ] Fetch AUDD balance for mainnet account
- [ ] Handle accounts with zero AUDD balance
- [ ] Handle accounts without AUDD association
- [ ] Verify correct decimal precision (6 decimals)
- [ ] Test balance caching mechanism
- [ ] Test balance fetch error handling

**Acceptance Criteria:**
- ✅ Returns correct AUDD balance
- ✅ Uses correct token ID per network
- ✅ Handles edge cases gracefully
- ✅ Proper error messages for failures

### 4. AUDD Transaction Monitoring Tests

#### Test: AUDD Transaction Detection
**File:** `src/lib/hedera/__tests__/audd-transaction-monitoring.test.ts`

**Scenarios:**
- [ ] Detect incoming AUDD transaction
- [ ] Validate AUDD amount within 0.1% tolerance
- [ ] Verify AUDD token ID matches expected
- [ ] Reject wrong token (USDC/USDT) when AUDD expected
- [ ] Handle underpayment (below tolerance)
- [ ] Accept overpayment (log variance)
- [ ] Test transaction polling timeout (5 minutes)
- [ ] Test transaction confirmation checking

**Acceptance Criteria:**
- ✅ Detects AUDD transactions correctly
- ✅ Validates token type strictly
- ✅ Applies correct tolerance (0.1%)
- ✅ Rejects wrong tokens with clear error
- ✅ Times out after 5 minutes

### 5. AUDD Ledger Posting Tests

#### Test: AUDD Ledger Entries
**File:** `src/lib/ledger/__tests__/audd-posting.test.ts`

**Scenarios:**
- [ ] AUDD payment posts to account 1054
- [ ] Verify DR Crypto Clearing AUDD (1054)
- [ ] Verify CR Accounts Receivable (1200)
- [ ] Check FX rate included in description
- [ ] Validate currency conversion (AUDD to AUD)
- [ ] Test 1:1 rate for AUD invoices
- [ ] Test currency mismatch (AUDD to USD)
- [ ] Verify balance validation (DR = CR)
- [ ] Test idempotency (no duplicate entries)

**Acceptance Criteria:**
- ✅ AUDD uses account 1054 (NOT 1051, 1052, or 1053)
- ✅ Correct DR/CR entries created
- ✅ FX rate documented in description
- ✅ Currency conversion accurate
- ✅ Ledger remains balanced

### 6. AUDD Xero Sync Tests

#### Test: AUDD Xero Integration
**File:** `src/lib/xero/__tests__/audd-xero-sync.test.ts`

**Scenarios:**
- [ ] Create Xero invoice for AUDD payment
- [ ] Record AUDD payment in Xero
- [ ] Use correct AUDD clearing account mapping
- [ ] Include AUDD-specific narration
- [ ] Document HEDERA_AUDD transaction ID
- [ ] Include FX rate in payment details
- [ ] Add "Currency matched" note for AUD invoices
- [ ] Test retry logic for failed AUDD syncs
- [ ] Verify sync queue processing

**Narration Format:**
```
Payment via HEDERA_AUDD
Transaction: 0.0.123@456.789
Token: AUDD
FX Rate: 1.00000000 AUDD/AUD @ 2025-12-15T10:00:00Z
Amount: 100.000000 AUDD = 100.00 AUD
✓ No FX risk - Currency matched payment 🇦🇺
```

**Acceptance Criteria:**
- ✅ Invoice created successfully
- ✅ Payment recorded with AUDD details
- ✅ Correct clearing account used (1054)
- ✅ Narration includes all required fields
- ✅ Currency match detected and noted
- ✅ Retry logic works for failures

### 7. AUDD Wrong-Token Rejection Tests

#### Test: Token Type Validation
**File:** `src/lib/hedera/__tests__/audd-wrong-token-rejection.test.ts`

**Scenarios:**
- [ ] Customer selects AUDD, sends HBAR → REJECT
- [ ] Customer selects AUDD, sends USDC → REJECT
- [ ] Customer selects AUDD, sends USDT → REJECT
- [ ] Customer selects HBAR, sends AUDD → REJECT
- [ ] Verify clear error messages
- [ ] Test retry instructions
- [ ] Verify payment link stays OPEN
- [ ] Log wrong-token attempts

**Error Message Format:**
```
❌ Wrong Token Received

Expected: AUDD (Australian Digital Dollar)
Received: USDC (USD Coin)

Please retry your payment using AUDD token.
Token ID: 0.0.1394325 (mainnet)
```

**Acceptance Criteria:**
- ✅ Rejects all wrong tokens
- ✅ Clear error messages displayed
- ✅ Payment link remains OPEN
- ✅ Retry instructions provided
- ✅ All attempts logged

### 8. FOUR FX Snapshots Verification Tests 🌟

#### Test: Multi-Token FX Snapshot Creation
**File:** `src/lib/fx/__tests__/four-token-snapshots.test.ts`

**This is a CRITICAL test for AUDD integration!**

**Scenarios:**
- [ ] **Creation-time:** Verify 4 snapshots created (HBAR, USDC, USDT, AUDD)
- [ ] **Settlement-time:** Verify 4 snapshots created
- [ ] Verify each token has correct base currency rate
- [ ] Test snapshot creation for AUD invoice (AUDD should be ~1.0)
- [ ] Test snapshot creation for USD invoice (all 4 tokens)
- [ ] Verify snapshot timestamps are identical (same batch)
- [ ] Test snapshot retrieval by token type
- [ ] Verify rate variance tracking
- [ ] Test snapshot failure handling (partial failure)

**Database Validation:**
```sql
-- For a single payment link, should have 8 snapshots total:
-- 4 CREATION snapshots (HBAR, USDC, USDT, AUDD)
-- 4 SETTLEMENT snapshots (HBAR, USDC, USDT, AUDD)

SELECT 
  token_type,
  snapshot_type,
  COUNT(*) as count
FROM fx_snapshots
WHERE payment_link_id = 'test-link-id'
GROUP BY token_type, snapshot_type
ORDER BY token_type, snapshot_type;

-- Expected result:
-- AUDD  | CREATION   | 1
-- AUDD  | SETTLEMENT | 1
-- HBAR  | CREATION   | 1
-- HBAR  | SETTLEMENT | 1
-- USDC  | CREATION   | 1
-- USDC  | SETTLEMENT | 1
-- USDT  | CREATION   | 1
-- USDT  | SETTLEMENT | 1
-- TOTAL: 8 rows
```

**Acceptance Criteria:**
- ✅ **Exactly 4 snapshots created at link creation**
- ✅ **Exactly 4 snapshots created at settlement**
- ✅ All snapshots have same timestamp (batch creation)
- ✅ AUDD rate included and accurate
- ✅ Each token type represented
- ✅ Snapshot retrieval works correctly
- ✅ No duplicate snapshots created

---

## 🧪 Additional Test Categories

### Unit Tests - Core Services

#### FX Service Tests
- [ ] AUDD rate fetching from CoinGecko
- [ ] AUDD rate from Mirror Node (fallback)
- [ ] AUDD/AUD rate calculation
- [ ] AUDD/USD rate calculation
- [ ] Rate caching for AUDD

#### Token Service Tests
- [ ] AUDD token ID validation
- [ ] AUDD balance formatting (6 decimals)
- [ ] AUDD amount calculation
- [ ] AUDD tolerance validation (0.1%)

#### Payment Link Service Tests
- [ ] Create link with AUD currency
- [ ] Verify AUDD available in token options
- [ ] Update link status after AUDD payment
- [ ] AUDD payment event creation

### Integration Tests

#### Database Integration
- [ ] Insert AUDD FX snapshot
- [ ] Query AUDD ledger entries
- [ ] Retrieve AUDD payment events
- [ ] AUDD Xero sync records

#### API Integration
- [ ] Mirror Node API with AUDD token ID
- [ ] CoinGecko AUDD rate fetching
- [ ] Xero API with AUDD payment

### E2E Tests

#### Payment Flow E2E
- [ ] Complete AUDD payment (testnet)
- [ ] AUDD payment with AUD invoice
- [ ] AUDD payment with USD invoice
- [ ] Multiple token comparison (including AUDD)

---

## 📊 Test Coverage Goals

### Overall Coverage Target: 80%+

| Component | Current | Target | Priority |
|-----------|---------|--------|----------|
| FX Service (AUDD) | 0% | 90% | 🔴 Critical |
| Token Service (AUDD) | 0% | 90% | 🔴 Critical |
| Ledger Posting (AUDD) | 50% | 95% | 🔴 Critical |
| Xero Sync (AUDD) | 40% | 90% | 🔴 Critical |
| Transaction Monitoring | 60% | 85% | 🟡 High |
| Payment Flow | 50% | 80% | 🟡 High |
| API Endpoints | 70% | 85% | 🟢 Medium |

---

## 🔧 Test Utilities & Mocks

### Mock Data Factories

#### Payment Link Factory
```typescript
export function createMockPaymentLink(overrides?: Partial<PaymentLink>) {
  return {
    id: 'test-link-' + uuid(),
    shortCode: 'TEST1234',
    amount: '100.00',
    currency: 'AUD', // Default to AUD for AUDD testing
    status: 'OPEN',
    organizationId: 'test-org',
    ...overrides,
  };
}
```

#### AUDD Transaction Factory
```typescript
export function createMockAuddTransaction(overrides?: Partial<Transaction>) {
  return {
    transactionId: '0.0.123@' + Date.now() + '.000000000',
    amount: '100.000000',
    tokenType: 'AUDD',
    tokenId: '0.0.1394325', // Mainnet AUDD
    timestamp: new Date(),
    ...overrides,
  };
}
```

#### FX Snapshot Factory
```typescript
export function createMockFxSnapshots(paymentLinkId: string) {
  const timestamp = new Date();
  return [
    { paymentLinkId, tokenType: 'HBAR', rate: 0.081, snapshotType: 'CREATION', timestamp },
    { paymentLinkId, tokenType: 'USDC', rate: 1.0, snapshotType: 'CREATION', timestamp },
    { paymentLinkId, tokenType: 'USDT', rate: 1.0, snapshotType: 'CREATION', timestamp },
    { paymentLinkId, tokenType: 'AUDD', rate: 1.0, snapshotType: 'CREATION', timestamp }, // ⭐
  ];
}
```

### Mock Implementations

- **Mirror Node API Mock:** Simulate AUDD balance queries
- **CoinGecko API Mock:** Return test AUDD rates
- **Xero API Mock:** Simulate invoice/payment creation
- **Database Mock:** In-memory Prisma client
- **HashConnect Mock:** Simulate wallet connection

---

## 🚦 Success Criteria

### Must Have (P0)
- [x] Jest configured and working
- [ ] All 7 AUDD test scenarios implemented
- [ ] FOUR FX snapshots test passes
- [ ] Token-to-account mapping tests pass
- [ ] Wrong-token rejection works
- [ ] 80%+ coverage on AUDD-related code

### Should Have (P1)
- [ ] E2E tests for full AUDD payment flow
- [ ] Performance tests for AUDD transaction detection
- [ ] Snapshot comparison tests
- [ ] Load tests with multiple AUDD payments

### Nice to Have (P2)
- [ ] Visual regression tests for AUDD UI
- [ ] Accessibility tests for payment flow
- [ ] Multi-browser testing
- [ ] Testnet automated testing

---

## 📝 Test Execution Strategy

### Phase 1: Unit Tests (Days 1-2)
- Set up Jest infrastructure
- Create mock factories
- Write unit tests for AUDD-specific functions
- Achieve 80%+ unit test coverage

### Phase 2: Integration Tests (Days 3-4)
- Database integration tests
- API integration tests
- Ledger posting integration tests
- Xero sync integration tests

### Phase 3: E2E Tests (Day 5)
- Complete payment flow tests
- Multi-token comparison tests
- Error scenario tests
- Performance validation

### Phase 4: Validation (Day 6)
- Run full test suite
- Generate coverage reports
- Manual testing on testnet
- Document findings

---

## 🐛 Known Issues to Test

### AUDD-Specific Issues
1. **Token ID Mismatch:** Ensure mainnet vs testnet IDs are correct
2. **Decimal Precision:** AUDD uses 6 decimals (not 8 like HBAR)
3. **Currency Matching:** AUDD/AUD should have special handling
4. **Account Mapping:** AUDD must use 1054, not other clearing accounts
5. **Snapshot Creation:** All 4 tokens must be captured simultaneously

---

## 📚 Documentation

### Test Documentation
- [ ] Test writing guide
- [ ] Mock data guide
- [ ] Test execution guide
- [ ] Coverage report interpretation
- [ ] CI/CD integration guide

### Developer Documentation
- [ ] How to run tests locally
- [ ] How to add new tests
- [ ] How to mock external services
- [ ] Debugging test failures
- [ ] Performance testing guide

---

## 🔄 CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
```

### Pre-commit Hooks
- Run unit tests
- Check code coverage
- Lint test files

---

## 📈 Metrics to Track

### Test Execution Metrics
- Total tests: Target 150+
- AUDD-specific tests: 50+
- Test execution time: < 2 minutes
- Flaky tests: 0
- Test failure rate: < 1%

### Coverage Metrics
- Overall coverage: 80%+
- AUDD-related code: 90%+
- Critical paths: 95%+
- Uncovered lines: < 100

---

## 🎯 Sprint 18 Completion Checklist

### Testing Infrastructure
- [ ] Jest installed and configured
- [ ] Test utilities created
- [ ] Mock factories implemented
- [ ] Database mocking set up
- [ ] Code coverage reporting enabled

### AUDD Tests
- [ ] ✅ AUDD payment flow test
- [ ] ✅ AUDD token balance fetching test
- [ ] ✅ AUDD transaction monitoring test
- [ ] ✅ AUDD ledger posting test
- [ ] ✅ AUDD Xero sync test
- [ ] ✅ AUDD wrong-token rejection test
- [ ] ✅ FOUR FX snapshots verification test

### Quality Gates
- [ ] All tests passing
- [ ] 80%+ code coverage achieved
- [ ] No critical bugs found
- [ ] Documentation complete
- [ ] CI/CD pipeline configured

### Production Readiness
- [ ] Testnet validation complete
- [ ] Performance benchmarks met
- [ ] Security review passed
- [ ] Error handling verified
- [ ] Monitoring and alerting configured

---

## 🚀 Next Steps (Sprint 19)

After Sprint 18 completion:
1. **Performance optimization** based on test findings
2. **Load testing** with multiple AUDD payments
3. **Security testing** for payment validation
4. **User acceptance testing** on testnet
5. **Production deployment** preparation

---

**Sprint 18 Status:** 🏗️ In Progress  
**Start Date:** December 15, 2025  
**Target Completion:** December 21, 2025 (6 days)  
**Priority:** 🔴 Critical (AUDD production readiness)

---

## 📞 Support & Resources

- **Testing Guide:** `SPRINT8_TESTING_GUIDE.md`
- **AUDD Config:** `AUDD_CONFIGURATION_STATUS.md`
- **Token IDs:** `src/lib/hedera/constants.ts`
- **Existing Tests:** `src/lib/ledger/__tests__/`, `src/lib/xero/__tests__/`

**Let's ensure AUDD is production-ready with comprehensive test coverage! 🧪🇦🇺**







