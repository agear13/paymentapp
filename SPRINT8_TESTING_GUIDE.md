# Sprint 8: Hedera Wallet Integration - Testing Guide

**Last Updated:** December 13, 2025  
**Status:** Ready for Testing

---

## 🧪 Testing Overview

This guide provides comprehensive testing procedures for the Hedera wallet integration, covering all three supported tokens (HBAR, USDC, USDT/AUDD) and various payment scenarios.

---

## 📋 Pre-Testing Setup

### 1. Environment Configuration

Ensure your `.env.local` file has the following variables:

```bash
# Hedera Network
NEXT_PUBLIC_HEDERA_NETWORK="testnet"  # or "mainnet"

# HashConnect Configuration
NEXT_PUBLIC_APP_NAME="Provvypay"
NEXT_PUBLIC_APP_ICON="https://your-domain.com/icon.png"
NEXT_PUBLIC_APP_DESCRIPTION="Secure payment link system"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Database
DATABASE_URL="postgresql://..."
```

### 2. Token IDs Verification

Check `src/lib/hedera/constants.ts` for correct token IDs:

**Testnet:**
- USDC: `0.0.429274`
- USDT: `0.0.429275`
- AUDD: `0.0.4918852`

**Mainnet:**
- USDC: `0.0.456858`
- USDT: `0.0.8322281`
- AUDD: `0.0.8317070`

### 3. Required Tools

- [ ] HashPack wallet browser extension installed
- [ ] Testnet HBAR in wallet (get from [Hedera Portal](https://portal.hedera.com/))
- [ ] Testnet USDC/USDT tokens (if testing token transfers)
- [ ] Chrome DevTools open for network inspection

### 4. Database Setup

Ensure merchant settings are configured:

```sql
-- Check merchant settings
SELECT 
  id, 
  organization_id, 
  display_name, 
  hedera_account_id 
FROM merchant_settings;

-- If missing, insert test data:
INSERT INTO merchant_settings (
  id, 
  organization_id, 
  display_name, 
  default_currency, 
  hedera_account_id
) VALUES (
  gen_random_uuid(),
  'your-org-id',
  'Test Merchant',
  'USD',
  '0.0.YOUR_TESTNET_ACCOUNT'
);
```

---

## 🔍 Test Categories

### A. API Endpoint Testing

#### Test 1: Fetch Merchant Settings

```bash
# Test merchant settings API (moved to public endpoint)
curl http://localhost:3000/api/public/merchant/TEST_SHORT_CODE

# Expected Response:
{
  "data": {
    "hederaAccountId": "0.0.123456",
    "displayName": "Test Merchant",
    "hasStripeAccount": true,
    "hasHederaAccount": true
  }
}
```

**Validation:**
- ✅ Returns 200 status code
- ✅ Contains `hederaAccountId` field
- ✅ Account ID is in valid format (0.0.xxxxx)
- ✅ Returns 404 for invalid short codes

#### Test 2: Fetch Balance Information

```bash
# Test balance endpoint
curl http://localhost:3000/api/hedera/balances/0.0.YOUR_ACCOUNT

# Expected Response:
{
  "data": {
    "balances": {
      "HBAR": "100.00000000",
      "USDC": "50.000000",
      "USDT": "25.000000",
      "AUDD": "10.000000"
    }
  }
}
```

**Validation:**
- ✅ Returns all token balances
- ✅ Correct decimal precision (HBAR: 8, others: 6)
- ✅ Handles accounts with zero balances
- ✅ Returns appropriate errors for invalid accounts

#### Test 3: Token Association Check

```bash
# Test token associations
curl http://localhost:3000/api/hedera/token-associations/0.0.YOUR_ACCOUNT

# Expected Response:
{
  "data": {
    "associations": {
      "USDC": true,
      "USDT": false,
      "AUDD": true
    }
  }
}
```

**Validation:**
- ✅ Shows association status for each HTS token
- ✅ HBAR is always implicitly associated
- ✅ Handles API errors gracefully

#### Test 4: Payment Amount Calculation

```bash
# Test payment amounts calculation
curl -X POST http://localhost:3000/api/hedera/payment-amounts \
  -H "Content-Type: application/json" \
  -d '{
    "fiatAmount": 100,
    "fiatCurrency": "USD"
  }'

# Expected Response:
{
  "data": {
    "paymentAmounts": [
      {
        "tokenType": "HBAR",
        "amount": "1234.56789012",
        "totalAmount": "1234.56789012",
        "fxRate": 0.081,
        "isRecommended": false,
        "isStable": false
      },
      {
        "tokenType": "USDC",
        "amount": "100.000000",
        "totalAmount": "100.000000",
        "fxRate": 1.0,
        "isRecommended": true,
        "isStable": true
      },
      // ... USDT, AUDD
    ]
  }
}
```

**Validation:**
- ✅ Returns amounts for all four tokens
- ✅ Includes FX rates
- ✅ Marks stablecoins correctly
- ✅ Recommends appropriate token
- ✅ Correct decimal precision

#### Test 5: Transaction Monitoring

```bash
# Test transaction monitoring (send payment first)
curl -X POST http://localhost:3000/api/hedera/transactions/monitor \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "0.0.MERCHANT_ACCOUNT",
    "tokenType": "USDC",
    "expectedAmount": 100.01,
    "timeoutMs": 60000
  }'

# Expected Response (after payment detected):
{
  "data": {
    "detected": true,
    "transaction": {
      "transactionId": "0.0.123@1234567890.000000000",
      "amount": "100.010000",
      "tokenType": "USDC"
    },
    "validation": {
      "isValid": true,
      "reason": "EXACT_MATCH",
      "message": "Payment confirmed"
    }
  }
}
```

**Validation:**
- ✅ Detects incoming payments
- ✅ Validates amount within tolerance
- ✅ Identifies correct token type
- ✅ Returns transaction ID
- ✅ Times out after 5 minutes

---

### B. UI Component Testing

#### Test 6: Wallet Connection Flow

**Steps:**
1. Navigate to payment page: `http://localhost:3000/pay/TEST_CODE`
2. Select "Cryptocurrency" payment method
3. Click "Connect Wallet" button
4. Approve HashPack connection in extension

**Validation:**
- ✅ HashPack extension opens
- ✅ Shows correct app name and description
- ✅ Wallet connects successfully
- ✅ Account ID displayed correctly
- ✅ "Connected" status shown
- ✅ Balance information loads

#### Test 7: Token Comparison Display

**Steps:**
1. After wallet connection, view token comparison
2. Verify all four tokens are shown

**Validation:**
- ✅ Shows HBAR, USDC, USDT, AUDD
- ✅ Displays amounts with correct decimals
- ✅ Shows "Stable" badge for stablecoins
- ✅ Shows "Volatile" indicator for HBAR
- ✅ Highlights recommended token
- ✅ Shows fee estimates
- ✅ Displays wallet balances
- ✅ "Insufficient balance" warning if needed

#### Test 8: Token Selection

**Steps:**
1. Select each token type (HBAR, USDC, USDT, AUDD)
2. Verify UI updates accordingly

**Validation:**
- ✅ Radio button selection works
- ✅ Selected token is highlighted
- ✅ Token details update
- ✅ Payment instructions update
- ✅ QR code updates (if shown)
- ✅ "Continue" button enabled

#### Test 9: Payment Instructions

**Steps:**
1. Select a token
2. Click "Continue with [TOKEN]"
3. Review payment instructions

**Validation:**
- ✅ Shows merchant account ID
- ✅ Shows exact amount to send
- ✅ Shows memo/reference (if required)
- ✅ Displays step-by-step instructions
- ✅ Shows tolerance information
- ✅ Includes QR code (optional)
- ✅ Copy buttons work

---

### C. End-to-End Payment Testing

#### Test 10: HBAR Payment (Happy Path)

**Steps:**
1. Connect wallet
2. Select HBAR
3. Note the required amount (e.g., `123.45678901 HBAR`)
4. Open HashPack wallet
5. Send exact amount to merchant account
6. Wait for transaction confirmation

**Expected Results:**
- ✅ Transaction monitoring starts automatically
- ✅ Loading indicator shown
- ✅ Payment detected within 5-30 seconds
- ✅ Amount validated successfully
- ✅ Success message displayed
- ✅ Payment link status updated to PAID
- ✅ Transaction ID recorded

**Database Validation:**
```sql
-- Check payment link status
SELECT pl.id, pl.status, pl.short_code
FROM payment_links pl
WHERE pl.short_code = 'TEST_CODE';

-- paid_at is derived from the latest PAYMENT_CONFIRMED event (not a column on payment_links)
SELECT pe.created_at AS paid_at
FROM payment_events pe
WHERE pe.payment_link_id = (SELECT id FROM payment_links WHERE short_code = 'TEST_CODE')
  AND pe.event_type = 'PAYMENT_CONFIRMED'
ORDER BY pe.created_at DESC
LIMIT 1;

-- Check payment event
SELECT * FROM payment_events 
WHERE payment_link_id = 'link-id' 
ORDER BY created_at DESC;

-- Check FX snapshot
SELECT * FROM fx_snapshots 
WHERE payment_link_id = 'link-id' 
AND snapshot_type = 'SETTLEMENT';
```

#### Test 11: USDC Payment (Happy Path)

**Steps:**
1. Ensure wallet has USDC associated and funded
2. Connect wallet
3. Select USDC
4. Note required amount (e.g., `100.010000 USDC`)
5. Send payment from HashPack
6. Wait for confirmation

**Expected Results:**
- ✅ Token association check passes
- ✅ Transaction monitoring works
- ✅ HTS token transfer detected
- ✅ Validation with 0.1% tolerance
- ✅ Payment confirmed
- ✅ Correct token type recorded

#### Test 12: USDT Payment (Happy Path)

Same as Test 11, but with USDT token.

#### Test 13: AUDD Payment (Happy Path)

Same as Test 11, but with AUDD token.

---

### D. Edge Case Testing

#### Test 14: Underpayment Rejection

**Steps:**
1. Note required amount: `100.000000 USDC`
2. Send slightly less: `99.800000 USDC` (0.2% less)
3. Wait for validation

**Expected Results:**
- ✅ Transaction detected
- ✅ Validation fails
- ✅ Error message: "Underpayment detected"
- ✅ Shows amount received vs required
- ✅ Offers retry option
- ✅ Payment link remains OPEN
- ✅ Event logged as PAYMENT_FAILED

#### Test 15: Overpayment Acceptance

**Steps:**
1. Note required amount: `100.000000 USDC`
2. Send slightly more: `100.150000 USDC` (0.15% more)
3. Wait for validation

**Expected Results:**
- ✅ Transaction detected
- ✅ Validation succeeds
- ✅ Warning: "Overpayment accepted"
- ✅ Shows variance amount
- ✅ Payment marked as PAID
- ✅ Extra amount noted in logs

#### Test 16: Wrong Token Payment

**Steps:**
1. Select USDC as payment token
2. Send USDT instead (same amount)
3. Wait for validation

**Expected Results:**
- ✅ Transaction detected
- ✅ Validation fails
- ✅ Error: "Wrong token sent"
- ✅ Shows expected vs received token
- ✅ Clear retry instructions
- ✅ Payment link remains OPEN

#### Test 17: Payment Timeout

**Steps:**
1. Select token and view instructions
2. Click "Start Monitoring"
3. **Do NOT send payment**
4. Wait 5 minutes

**Expected Results:**
- ✅ Polling continues for 5 minutes
- ✅ 60 attempts made (every 5 seconds)
- ✅ Timeout message displayed
- ✅ Offers retry option
- ✅ Payment link remains OPEN
- ✅ No false positives

#### Test 18: Multiple Payments

**Steps:**
1. Send first payment (correct amount)
2. Wait for confirmation
3. Try to send second payment to same link

**Expected Results:**
- ✅ First payment succeeds
- ✅ Link status changes to PAID
- ✅ Second payment attempt shows error
- ✅ "Already paid" message displayed
- ✅ Original transaction details shown

#### Test 19: Wallet Disconnection During Payment

**Steps:**
1. Start payment flow
2. Connect wallet
3. Select token
4. Disconnect wallet via HashPack
5. Try to continue

**Expected Results:**
- ✅ Disconnection detected
- ✅ UI updates to show disconnected state
- ✅ "Reconnect wallet" prompt shown
- ✅ Can reconnect without losing progress
- ✅ Selected token preserved

#### Test 20: Token Not Associated

**Steps:**
1. Use wallet without USDC association
2. Try to select USDC token

**Expected Results:**
- ✅ Association check runs
- ✅ Warning displayed: "Token not associated"
- ✅ Instructions to associate token shown
- ✅ Link to HashPack settings
- ✅ Can select other tokens
- ✅ Graceful fallback behavior

---

### E. Tolerance Testing

#### Test 21: HBAR Tolerance (0.5%)

**Required Amount:** `100.00000000 HBAR`

| Sent Amount | Expected Result | Reason |
|-------------|----------------|---------|
| `99.40000000` | ❌ Rejected | -0.6% (below tolerance) |
| `99.50000000` | ✅ Accepted | -0.5% (exact lower bound) |
| `100.00000000` | ✅ Accepted | Exact match |
| `100.50000000` | ✅ Accepted | +0.5% (exact upper bound) |
| `100.60000000` | ✅ Accepted | +0.6% (overpayment accepted) |

#### Test 22: USDC/USDT Tolerance (0.1%)

**Required Amount:** `100.000000 USDC`

| Sent Amount | Expected Result | Reason |
|-------------|----------------|---------|
| `99.850000` | ❌ Rejected | -0.15% (below tolerance) |
| `99.900000` | ✅ Accepted | -0.1% (exact lower bound) |
| `100.000000` | ✅ Accepted | Exact match |
| `100.100000` | ✅ Accepted | +0.1% (exact upper bound) |
| `100.200000` | ✅ Accepted | +0.2% (overpayment accepted) |

---

### F. Performance Testing

#### Test 23: Balance Fetch Speed

**Steps:**
1. Connect wallet
2. Note time to fetch balances

**Acceptance Criteria:**
- ✅ Balance fetch completes in < 1 second
- ✅ Shows loading indicator
- ✅ Handles API timeouts gracefully
- ✅ Retries on failure

#### Test 24: Transaction Detection Speed

**Steps:**
1. Send payment
2. Measure time to detection

**Acceptance Criteria:**
- ✅ Average detection: 5-30 seconds
- ✅ 95th percentile: < 60 seconds
- ✅ Polling interval: 5 seconds
- ✅ Max 60 attempts (5 minutes)

#### Test 25: Payment Amount Calculation Speed

**Steps:**
1. Select payment option
2. Measure calculation time

**Acceptance Criteria:**
- ✅ Calculation completes in < 200ms
- ✅ FX rate fetch cached appropriately
- ✅ Shows loading state if slow
- ✅ Handles rate provider failures

---

### G. Security Testing

#### Test 26: Input Validation

Test invalid inputs for all API endpoints:

```bash
# Invalid account ID
curl http://localhost:3000/api/hedera/balances/invalid-account
# Expected: 400 Bad Request

# Invalid token type
curl -X POST http://localhost:3000/api/hedera/transactions/monitor \
  -d '{"tokenType": "INVALID", "accountId": "0.0.123", "expectedAmount": 100}'
# Expected: 400 Bad Request

# Negative amount
curl -X POST http://localhost:3000/api/hedera/payment-amounts \
  -d '{"fiatAmount": -100, "fiatCurrency": "USD"}'
# Expected: 400 Bad Request
```

**Validation:**
- ✅ Rejects invalid account IDs
- ✅ Rejects invalid token types
- ✅ Rejects negative amounts
- ✅ Rejects invalid currency codes
- ✅ Returns proper error messages
- ✅ No sensitive data in errors

#### Test 27: Rate Limiting

**Steps:**
1. Make 100+ rapid API requests
2. Check for rate limit responses

**Validation:**
- ✅ Rate limiting activates
- ✅ Returns 429 status code
- ✅ Includes retry-after header
- ✅ Doesn't crash server
- ✅ Logs rate limit violations

---

## 📊 Test Results Template

Use this template to track test results:

```markdown
## Test Execution: [Date]

**Environment:** [Testnet/Mainnet]  
**Tester:** [Name]  
**Build Version:** [Version]

### Summary
- Total Tests: 27
- Passed: __
- Failed: __
- Skipped: __

### Failed Tests
| Test # | Test Name | Reason | Severity | Notes |
|--------|-----------|--------|----------|-------|
| 10 | HBAR Payment | Timeout | High | Mirror node slow |

### Issues Found
1. **[Issue Title]**
   - Severity: High/Medium/Low
   - Steps to reproduce:
   - Expected behavior:
   - Actual behavior:
   - Screenshots/Logs:

### Recommendations
- [ ] Fix Issue #1 before production
- [ ] Monitor Issue #2 in production
- [ ] Document workaround for Issue #3
```

---

## 🐛 Common Issues & Solutions

### Issue: HashPack Won't Connect

**Symptoms:**
- Extension doesn't open
- Connection times out

**Solutions:**
1. Clear browser cache
2. Disable other wallet extensions
3. Update HashPack to latest version
4. Check network settings in HashPack
5. Verify app metadata in constants.ts

### Issue: Transaction Not Detected

**Symptoms:**
- Payment sent but not detected
- Timeout after 5 minutes

**Solutions:**
1. Verify correct merchant account ID
2. Check Mirror Node API status
3. Confirm transaction on Hedera explorer
4. Verify token ID matches network
5. Check transaction confirmation status

### Issue: Balance Shows Zero

**Symptoms:**
- Wallet has funds but shows 0
- Balance API returns empty

**Solutions:**
1. Verify network setting (testnet vs mainnet)
2. Check account ID format
3. Confirm token association
4. Test Mirror Node API directly
5. Check for API rate limiting

### Issue: Wrong Amount Calculated

**Symptoms:**
- Required amount seems incorrect
- FX rate looks wrong

**Solutions:**
1. Verify FX rate provider (CoinGecko)
2. Check rate cache expiry
3. Test fallback provider (Mirror Node)
4. Verify currency code
5. Check decimal precision

---

## ✅ Production Readiness Checklist

Before deploying to production, ensure:

### Configuration
- [ ] Environment variables set correctly
- [ ] Token IDs verified for mainnet
- [ ] Merchant accounts configured
- [ ] HashConnect app metadata updated
- [ ] Network set to "mainnet"

### Testing
- [ ] All 27 tests passed
- [ ] Edge cases tested
- [ ] Tolerance validation confirmed
- [ ] Performance benchmarks met
- [ ] Security tests passed

### Monitoring
- [ ] Error logging configured
- [ ] Transaction monitoring set up
- [ ] Alert rules created
- [ ] Dashboard configured
- [ ] On-call schedule defined

### Documentation
- [ ] API documentation complete
- [ ] User guide created
- [ ] Support procedures documented
- [ ] Runbook prepared
- [ ] FAQ updated

### Compliance
- [ ] Security review completed
- [ ] PCI compliance verified
- [ ] Data handling reviewed
- [ ] Privacy policy updated
- [ ] Terms of service updated

---

## 📞 Support & Resources

### Internal Resources
- **Code:** `src/lib/hedera/`, `src/components/public/`
- **API Docs:** `src/docs/HEDERA_QUICK_REFERENCE.md`
- **Sprint Docs:** `SPRINT8_COMPLETE.md`

### External Resources
- **Hedera Portal:** https://portal.hedera.com
- **Mirror Node API:** https://testnet.mirrornode.hedera.com/api/v1/docs
- **HashPack Docs:** https://docs.hashpack.app/
- **Hedera Explorer:** https://hashscan.io

### Getting Help
- **Development Team:** Open GitHub issue
- **HashPack Support:** https://hashpack.app/support
- **Hedera Discord:** https://hedera.com/discord

---

**Testing Status:** ✅ Ready for Comprehensive Testing  
**Last Updated:** December 13, 2025  
**Next Review:** Before Production Deployment







