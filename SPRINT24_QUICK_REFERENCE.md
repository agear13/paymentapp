# Sprint 24: Edge Cases & Error Handling - Quick Reference

**Last Updated:** December 16, 2025

---

## 🎯 Quick Links

| Feature | File | Function |
|---------|------|----------|
| Underpayment | `src/lib/payment/edge-case-handler.ts` | `handleUnderpayment()` |
| Overpayment | `src/lib/payment/edge-case-handler.ts` | `handleOverpayment()` |
| Duplicate Check | `src/lib/payment/edge-case-handler.ts` | `checkDuplicatePayment()` |
| Payment Lock | `src/lib/payment/edge-case-handler.ts` | `acquirePaymentLock()` |
| Expired Link | `src/lib/payment/edge-case-handler.ts` | `handleExpiredLinkPayment()` |
| Circuit Breaker | `src/lib/integration/failure-handler.ts` | `getCircuitBreakerState()` |
| Health Check | `src/lib/integration/failure-handler.ts` | `checkHederaNetworkHealth()` |
| Orphan Detection | `src/lib/data/repair-utilities.ts` | `findOrphanedPayments()` |
| Auto-Repair | `src/lib/data/repair-utilities.ts` | `repairOrphanedPayments()` |
| Consistency Check | `src/lib/data/repair-utilities.ts` | `runConsistencyChecks()` |
| Timezone | `src/lib/utils/timezone.ts` | `calculateExpiryDate()` |

---

## 🔧 Common Tasks

### Check for Duplicate Payment

```typescript
import { checkDuplicatePayment } from '@/lib/payment/edge-case-handler';

const result = await checkDuplicatePayment(
  paymentLinkId,
  transactionId,
  'STRIPE' // or 'HEDERA'
);

if (result.isDuplicate) {
  console.log('Already processed:', result.existingPaymentEventId);
}
```

### Handle Payment with Lock

```typescript
import { acquirePaymentLock, releasePaymentLock } from '@/lib/payment/edge-case-handler';

const acquired = await acquirePaymentLock(paymentLinkId);
if (!acquired) {
  throw new Error('Payment is being processed');
}

try {
  // Process payment
} finally {
  await releasePaymentLock(paymentLinkId);
}
```

### Check Circuit Breaker

```typescript
import { isCircuitBreakerOpen, recordFailure } from '@/lib/integration/failure-handler';

if (isCircuitBreakerOpen('STRIPE')) {
  throw new Error('Stripe temporarily unavailable');
}

try {
  await callStripeAPI();
} catch (error) {
  recordFailure('STRIPE', 'NETWORK');
  throw error;
}
```

### Run Data Maintenance

```typescript
import { runMaintenanceCycle } from '@/lib/data/repair-utilities';

const result = await runMaintenanceCycle(organizationId, {
  autoRepair: true,
  dryRun: false,
});

console.log(`Found ${result.consistencyCheck.issuesFound} issues`);
console.log(`Repaired ${result.orphanRepair?.repaired} orphans`);
```

### Calculate Timezone-Aware Expiry

```typescript
import { calculateExpiryDate } from '@/lib/utils/timezone';

const expiryDate = calculateExpiryDate(
  new Date(),
  24, // hours
  'America/New_York'
);
```

---

## 🚨 Error Categories

| Category | Meaning | Retry? | Backoff |
|----------|---------|--------|---------|
| NETWORK | Connection failed | ✅ Yes | Exponential (1s → 16s) |
| RATE_LIMIT | Too many requests | ✅ Yes | Long (60s → 3600s) |
| AUTH | Invalid credentials | ❌ No | N/A |
| VALIDATION | Invalid data | ❌ No | N/A |
| NOT_FOUND | Resource missing | ❌ No | N/A |
| SERVER_ERROR | 5xx errors | ✅ Yes | Exponential (1s → 16s) |
| TIMEOUT | Request timeout | ✅ Yes | Exponential (1s → 16s) |
| UNKNOWN | Unknown error | ⚠️ Limited | Linear (5s → 15s) |

---

## 📊 Thresholds & Limits

### Payment Tolerances

| Scenario | Threshold | Action |
|----------|-----------|--------|
| Micro underpayment | <1% | Manual review |
| Small underpayment | 1-10% | Allow retry |
| Large underpayment | >10% | Contact support |
| Small overpayment | <1% | Auto-accept |
| Moderate overpayment | 1-10% | Accept (notify) |
| Large overpayment | 10-20% | Accept (review) |
| Huge overpayment | >20% | Accept (investigate) |

### Circuit Breaker

| Setting | Value |
|---------|-------|
| Failure threshold | 5 consecutive failures |
| Reset timeout | 60 seconds |
| Half-open attempts | 3 test requests |

### Retry Limits

| Error Type | Max Attempts | Initial Delay |
|------------|--------------|---------------|
| Transient | 5 | 1 second |
| Rate limit | 10 | 60 seconds |
| Unknown | 3 | 5 seconds |

### Data Staleness

| Type | Threshold | Action |
|------|-----------|--------|
| FX rate | 15 minutes | Use fallback provider |
| Payment link | Expiry timestamp | Auto-transition to EXPIRED |
| Consistency check | 24 hours | Run maintenance |

---

## 🔍 Consistency Check Types

| Check | Severity | Auto-Repair? |
|-------|----------|--------------|
| Missing payment event | HIGH | ❌ No |
| Status mismatch | CRITICAL | ✅ Yes |
| Missing FX snapshot | MEDIUM | ❌ No |
| Stale expiry | LOW | ✅ Yes |
| Ledger imbalance | CRITICAL | ❌ No |
| Duplicate short code | HIGH | ❌ No |

---

## 🧪 Test Commands

```bash
# Run all edge case tests
npm test edge-cases

# Run payment tests only
npm test payment-edge-cases

# Run integration tests only
npm test integration-failures

# Run with coverage
npm test -- --coverage edge-cases
```

---

## 📈 Monitoring Checklist

### Daily Checks

- [ ] Circuit breaker state (should be CLOSED)
- [ ] Webhook success rate (should be >95%)
- [ ] Orphan count (should be 0)
- [ ] Ledger balance check (all balanced)

### Weekly Checks

- [ ] Run consistency checks
- [ ] Review large overpayments
- [ ] Check FX rate staleness
- [ ] Analyze duplicate attempts

### Monthly Checks

- [ ] Run full maintenance cycle
- [ ] Review error categories
- [ ] Update retry thresholds
- [ ] Audit circuit breaker config

---

## 🚀 Deployment Checklist

### Before Deployment

- [ ] All tests passing (60+ edge case tests)
- [ ] Circuit breaker config validated
- [ ] Retry thresholds configured
- [ ] Lock timeout settings verified

### After Deployment

- [ ] Monitor duplicate payment rate (should be 0%)
- [ ] Check lock acquisition success rate
- [ ] Verify circuit breaker transitions
- [ ] Validate timezone calculations

### Rollback Plan

If issues detected:
1. Disable auto-repair (`autoRepair: false`)
2. Set circuit breaker thresholds higher
3. Increase lock timeouts
4. Enable verbose logging

---

## 📞 Support Scenarios

### "Payment was rejected as duplicate"

1. Check `payment_events` table for existing PAYMENT_CONFIRMED
2. Verify transaction ID matches
3. Check timestamp of original processing
4. Confirm no actual duplicate charge

### "Circuit breaker opened"

1. Check recent error logs for failure category
2. Verify external service status (Stripe/Hedera/Xero)
3. Wait for reset timeout (60s)
4. Monitor for successful requests in HALF_OPEN

### "Orphan payment detected"

1. Run consistency check: `runConsistencyChecks(orgId)`
2. Check specific issues for payment link
3. Attempt auto-repair: `repairOrphanedPayments(orgId)`
4. Manual intervention if auto-repair fails

### "Ledger imbalance"

1. Query ledger entries for payment link
2. Sum debits and credits
3. Check for missing entries or duplicate postings
4. Create manual corrective entry if needed
5. Log in audit trail

---

## 🔧 Configuration

### Environment Variables

```bash
# Circuit breaker settings
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT_MS=60000

# Lock timeout
PAYMENT_LOCK_TIMEOUT_MS=5000

# FX rate staleness
FX_RATE_MAX_AGE_MINUTES=15

# Grace period for expiry
EXPIRY_GRACE_PERIOD_MINUTES=5
```

### Feature Flags

```typescript
// Enable/disable features
const FEATURES = {
  duplicateDetection: true,      // Always on
  circuitBreaker: true,          // Recommended
  autoRepair: false,             // Use with caution
  timezoneAdjustment: true,      // Always on
  lockingEnabled: true,          // Always on
};
```

---

## 📚 Additional Resources

- **Full Documentation:** `SPRINT24_COMPLETE.md`
- **Test Suite:** `src/__tests__/edge-cases/`
- **API Reference:** Function JSDoc comments in source files
- **Architecture:** See individual file headers for design decisions

---

**Need Help?** Check `SPRINT24_COMPLETE.md` for detailed examples and troubleshooting. 📖







