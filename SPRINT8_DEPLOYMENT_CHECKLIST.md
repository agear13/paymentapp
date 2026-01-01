# Sprint 8: Production Deployment Checklist

**Last Updated:** December 13, 2025  
**Status:** Updated with recent improvements

---

## ✅ Pre-Deployment Checklist

### 1. Environment Configuration

- [ ] **Verify `.env.local` settings**
  ```bash
  NEXT_PUBLIC_HEDERA_NETWORK="mainnet"  # or "testnet"
  NEXT_PUBLIC_APP_NAME="Your App Name"
  NEXT_PUBLIC_APP_ICON="https://your-domain.com/icon.png"
  NEXT_PUBLIC_APP_DESCRIPTION="Your app description"
  NEXT_PUBLIC_APP_URL="https://your-domain.com"
  ```

- [x] **Confirm token IDs in `src/lib/hedera/constants.ts`** ✅ UPDATED
  ```typescript
  export const TOKEN_IDS = {
    MAINNET: {
      USDC: '0.0.456858',
      USDT: '0.0.8322281',  // ✅ UPDATED - Verify before production
      AUDD: '0.0.8317070',
    },
    TESTNET: {
      USDC: '0.0.429274',   // ✅ UPDATED
      USDT: '0.0.429275',   // ✅ UPDATED
      AUDD: '0.0.4918852',
    },
  };
  ```
  **Note:** USDT mainnet token ID (0.0.8322281) should be verified before production deployment.

- [ ] **Set correct network in constants**
  ```typescript
  export const CURRENT_NETWORK: HederaNetwork =
    (process.env.NEXT_PUBLIC_HEDERA_NETWORK as HederaNetwork) || 
    HEDERA_NETWORK.TESTNET;  // Default is testnet for safety
  ```

### 2. Database Setup

- [x] **Merchant settings API endpoint created** ✅ NEW
  - API endpoint: `GET /api/public/merchant/[shortCode]` (moved from payment-links to avoid routing conflict)
  - Returns merchant Hedera account ID for payment links
  - Properly handles missing settings

- [ ] **Merchant Hedera accounts configured**
  - All merchants have `hederaAccountId` in `merchant_settings`
  - Account IDs are valid format (0.0.xxxxx)
  - Accounts are active on the network
  
- [ ] **Test merchant settings retrieval**
  ```bash
  curl http://localhost:3000/api/public/merchant/TEST_CODE
  # Should return merchant's Hedera account ID
  ```

- [ ] **FX snapshots table ready**
  - `fx_snapshots` table exists
  - Supports all three token types (HBAR, USDC, USDT)
  - Indexes are created for performance

- [ ] **Payment link events table ready**
  - Can store Hedera transaction metadata
  - Supports token type field
  - Has proper indexes

### 3. Testing

#### Testnet Testing

**Note:** See `SPRINT8_TESTING_GUIDE.md` for comprehensive testing procedures (27 test cases).

- [ ] **Connect HashPack wallet on testnet**
- [ ] **Verify merchant settings API works**
  ```bash
  curl http://localhost:3000/api/public/merchant/YOUR_TEST_CODE
  ```
- [ ] **Test HBAR payment flow**
  - Wallet connection
  - Amount calculation
  - Payment instructions
  - Transaction monitoring
  - Payment validation
  - Status update

- [ ] **Test USDC payment flow**
  - Token association check
  - Amount calculation
  - Payment with USDC
  - Transaction detection
  - Validation with 0.1% tolerance

- [ ] **Test USDT payment flow**
  - Token association check
  - Amount calculation
  - Payment with USDT
  - Transaction detection
  - Validation with 0.1% tolerance

- [ ] **Test edge cases**
  - Underpayment (should reject)
  - Overpayment (should accept with warning)
  - Wrong token (should reject)
  - Payment timeout (should handle gracefully)
  - Wallet disconnect during payment
  - Multiple payments to same link

#### API Testing

- [ ] **Test all API endpoints**
  ```bash
  # Balances
  curl http://localhost:3000/api/hedera/balances/0.0.12345
  
  # Token associations
  curl http://localhost:3000/api/hedera/token-associations/0.0.12345
  
  # Payment amounts
  curl -X POST http://localhost:3000/api/hedera/payment-amounts \
    -H "Content-Type: application/json" \
    -d '{"fiatAmount":100,"fiatCurrency":"USD"}'
  
  # Transaction monitoring
  curl -X POST http://localhost:3000/api/hedera/transactions/monitor \
    -H "Content-Type: application/json" \
    -d '{"accountId":"0.0.12345","tokenType":"USDC","expectedAmount":100.01}'
  ```

### 4. Integration Testing

- [ ] **FX Engine integration**
  - Creation snapshots captured for all tokens
  - Settlement snapshots captured on payment
  - Rate variance calculated correctly
  - Rates stored in database

- [ ] **Payment link status updates**
  - Status changes from OPEN to PAID
  - `paidAt` timestamp set correctly
  - Payment method recorded as "HEDERA"

- [ ] **Event logging**
  - All payment events logged
  - Transaction IDs recorded
  - Token types tracked
  - FX rates stored

### 5. Security Review

- [ ] **No private keys in code**
- [ ] **No hardcoded account IDs**
- [ ] **Input validation on all endpoints**
- [ ] **Rate limiting configured**
- [ ] **Error messages don't leak sensitive data**
- [ ] **CORS properly configured**
- [ ] **API authentication in place**

### 6. Performance Optimization

- [ ] **Balance caching implemented**
- [ ] **Rate calculations cached**
- [ ] **Transaction monitoring optimized**
- [ ] **Database queries indexed**
- [ ] **API response times acceptable**
  - Balance fetch: <1s
  - Payment calculation: <200ms
  - Transaction monitoring: 5-30s

### 7. Monitoring & Logging

- [ ] **Logging configured**
  - All payment attempts logged
  - Validation results logged
  - Errors logged with context
  - Transaction IDs tracked

- [ ] **Alerts set up**
  - Payment failures
  - API errors
  - Timeout issues
  - Validation failures

- [ ] **Metrics tracked**
  - Payment success rate
  - Average detection time
  - Token usage distribution
  - Error rates by type

### 8. Documentation

- [ ] **Internal documentation updated**
  - Deployment procedures
  - Troubleshooting guide
  - Support procedures

- [ ] **Customer documentation ready**
  - How to pay with crypto
  - Supported tokens
  - Payment instructions
  - FAQ

- [ ] **Merchant documentation ready**
  - How to enable crypto payments
  - Account setup guide
  - Transaction reconciliation
  - Support contacts

### 9. Backup & Recovery

- [ ] **Database backups configured**
- [ ] **Transaction logs backed up**
- [ ] **Recovery procedures documented**
- [ ] **Rollback plan prepared**

### 10. Compliance & Legal

- [ ] **Terms of service updated**
  - Crypto payment terms
  - Refund policy
  - Exchange rate disclosure

- [ ] **Privacy policy updated**
  - Wallet address handling
  - Transaction data storage

- [ ] **Regulatory compliance checked**
  - Local crypto regulations
  - AML/KYC requirements (if applicable)
  - Tax reporting requirements

---

## 🚀 Deployment Steps

### Step 1: Pre-Deployment

1. [ ] Run full test suite
2. [ ] Verify all environment variables
3. [ ] Check token IDs are correct
4. [ ] Review security checklist
5. [ ] Backup current database

### Step 2: Staging Deployment

1. [ ] Deploy to staging environment
2. [ ] Run smoke tests
3. [ ] Test with real testnet accounts
4. [ ] Verify monitoring and logging
5. [ ] Check performance metrics

### Step 3: Production Deployment

1. [ ] Deploy to production
2. [ ] Verify environment variables
3. [ ] Test with small transaction
4. [ ] Monitor error rates
5. [ ] Check transaction processing

### Step 4: Post-Deployment

1. [ ] Monitor for 24 hours
2. [ ] Check error logs
3. [ ] Verify payment success rate
4. [ ] Review performance metrics
5. [ ] Collect user feedback

---

## 🔍 Verification Tests

### Quick Smoke Test

```bash
# 1. Check health
curl https://your-domain.com/api/health

# 2. Test balance endpoint
curl https://your-domain.com/api/hedera/balances/0.0.12345

# 3. Test payment calculation
curl -X POST https://your-domain.com/api/hedera/payment-amounts \
  -H "Content-Type: application/json" \
  -d '{"fiatAmount":10,"fiatCurrency":"USD"}'
```

### End-to-End Test

1. Create a test payment link
2. Navigate to payment page
3. Connect wallet
4. Select token
5. Send test payment
6. Verify detection
7. Check status update
8. Review logs

---

## ✅ Recent Improvements (Dec 13, 2025)

### 1. Token IDs Updated
- ✅ Testnet USDC: `0.0.429274`
- ✅ Testnet USDT: `0.0.429275`
- ✅ Mainnet USDT: `0.0.8322281` (verify before production)
- ✅ AUDD support added for both networks

### 2. Merchant Account Retrieval Fixed
- ✅ Created API endpoint: `/api/public/merchant/[shortCode]` (moved from payment-links)
- ✅ Updated `hedera-payment-option.tsx` to fetch dynamically
- ✅ Updated `payment-method-selector.tsx` to pass shortCode
- ✅ Updated `payment-page-content.tsx` with proper props
- ✅ Removed hardcoded merchant account ID
- ✅ Added proper error handling

### 3. Testing Resources Created
- ✅ Comprehensive testing guide: `SPRINT8_TESTING_GUIDE.md`
- ✅ 27 detailed test cases
- ✅ API endpoint testing procedures
- ✅ UI component testing scenarios
- ✅ Edge case testing coverage
- ✅ Performance benchmarks
- ✅ Security testing guidelines

### 4. Code Quality
- ✅ Fixed typos in merchant-settings API
- ✅ All linter errors resolved
- ✅ Proper TypeScript typing throughout
- ✅ Added loading states for merchant fetch

---

## ⚠️ Remaining Issues & Considerations

### Issue: USDT Mainnet Token ID

**Status:** Updated but needs verification  
**Impact:** USDT payments may not work if ID is incorrect  
**Action Required:** Verify `0.0.8322281` is correct mainnet USDT token ID  
**Priority:** HIGH - Must verify before mainnet deployment

**Verification Steps:**
1. Check Hedera HashScan: https://hashscan.io/mainnet/token/0.0.8322281
2. Verify token symbol is "USDT"
3. Confirm token decimals is 6
4. Test small transaction on mainnet

---

## 📞 Support Contacts

### Technical Issues
- **Development Team:** dev@your-domain.com
- **On-Call:** +1-XXX-XXX-XXXX

### Business Issues
- **Product Team:** product@your-domain.com
- **Customer Support:** support@your-domain.com

---

## 🔄 Rollback Procedure

If issues are detected:

1. **Immediate:**
   - Disable Hedera payment option in UI
   - Set `availablePaymentMethods.hedera = false`

2. **Short-term:**
   - Revert to previous deployment
   - Restore database if needed
   - Notify affected customers

3. **Investigation:**
   - Review error logs
   - Check transaction data
   - Identify root cause
   - Plan fix

---

## ✅ Sign-Off

### Development Team
- [ ] Code reviewed
- [ ] Tests passed
- [ ] Documentation complete
- [ ] Signed off by: _________________ Date: _______

### QA Team
- [ ] Test plan executed
- [ ] Edge cases verified
- [ ] Performance acceptable
- [ ] Signed off by: _________________ Date: _______

### Product Team
- [ ] Requirements met
- [ ] User experience approved
- [ ] Documentation reviewed
- [ ] Signed off by: _________________ Date: _______

### Operations Team
- [ ] Monitoring configured
- [ ] Alerts set up
- [ ] Runbook prepared
- [ ] Signed off by: _________________ Date: _______

---

## 🎉 Ready for Production?

Once all items are checked and signed off:

✅ **APPROVED FOR PRODUCTION DEPLOYMENT**

Deployment Date: _________________  
Deployed By: _________________  
Verified By: _________________

---

**Good luck with your deployment! 🚀**






