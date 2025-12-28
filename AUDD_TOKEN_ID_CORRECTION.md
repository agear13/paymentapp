# AUDD Mainnet Token ID Correction

**Date:** December 13, 2025  
**Status:** ✅ CORRECTED  
**Priority:** HIGH - Production Critical

---

## 🔧 Issue

The AUDD mainnet token ID in the codebase was **incorrect**.

### Previous (Incorrect)
- **Token ID:** `0.0.8317070`
- **EVM Address:** `0x39ceba2b467fa987546000eb5d1373acf1f3a2e1`

### Corrected (Current)
- **Token ID:** `0.0.1394325` ✅
- **EVM Address:** `0x0000000000000000000000000000000000154695` ✅

---

## 📋 Verification

### Mainnet Token Details
- **Contract ID:** `0.0.1394325`
- **Symbol:** AUDD
- **Decimals:** 6
- **Network:** Hedera Mainnet
- **Verify on HashScan:** https://hashscan.io/mainnet/token/0.0.1394325

### Testnet Token Details (Unchanged ✅)
- **Contract ID:** `0.0.4918852`
- **EVM Address:** `0x00000000000000000000000000000000004b0e44`
- **Network:** Hedera Testnet
- **Verify on HashScan:** https://hashscan.io/testnet/token/0.0.4918852

---

## ✅ Files Updated

### 1. Core Configuration
**File:** `src/lib/hedera/constants.ts`

```typescript
export const TOKEN_IDS = {
  MAINNET: {
    USDC: '0.0.456858',
    USDT: '0.0.8322281',
    AUDD: '0.0.1394325', // ✅ CORRECTED from 0.0.8317070
  },
  TESTNET: {
    USDC: '0.0.429274',
    USDT: '0.0.429275',
    AUDD: '0.0.4918852', // ✅ Already correct
  },
} as const;
```

### 2. Documentation Files Updated
- ✅ `AUDD_CONFIGURATION_STATUS.md`
- ✅ `AUDD_TOKEN_IDS_CONFIGURED.md`
- ✅ `AUDD_TOKEN_ID_CORRECTION.md` (this file)

---

## 🧪 Testing Required

Before deploying to mainnet with AUDD support:

### 1. Verify Token on HashScan
```bash
# Visit this URL and confirm:
https://hashscan.io/mainnet/token/0.0.1394325

# Check:
- Token symbol is "AUDD"
- Decimals is 6
- Token is active
```

### 2. Test Token Association
```bash
# Test that wallet can associate with token
# Use HashPack on mainnet to associate: 0.0.1394325
```

### 3. Test Balance Fetch
```bash
# Test balance API with an account that holds AUDD
curl http://localhost:3000/api/hedera/balances/YOUR_ACCOUNT_WITH_AUDD
```

### 4. Test Payment Calculation
```bash
# Test that AUDD amounts calculate correctly
curl -X POST http://localhost:3000/api/hedera/payment-amounts \
  -H "Content-Type: application/json" \
  -d '{
    "fiatAmount": 100,
    "fiatCurrency": "AUD"
  }'

# Verify AUDD is included in response with correct rates
```

### 5. End-to-End Payment Test (Testnet First!)
1. Create payment link in AUD
2. Connect HashPack wallet
3. Select AUDD token
4. Verify correct amount calculated
5. Send small test payment
6. Confirm transaction detected and validated

---

## 🔍 Impact Analysis

### What Changed
- Mainnet AUDD token ID
- Mainnet AUDD EVM address
- Related documentation

### What's the Same
- Testnet AUDD configuration (already correct)
- All other token IDs (HBAR, USDC, USDT)
- Code logic and functionality
- API endpoints
- UI components

### Risk Assessment
- **Risk Level:** MEDIUM
- **Reason:** Using wrong token ID would cause all AUDD payments to fail on mainnet
- **Mitigation:** Comprehensive testing before production deployment

---

## ✅ Validation Checklist

Before considering this correction complete:

- [x] Token ID updated in constants.ts
- [x] Documentation updated
- [x] No linter errors
- [ ] Verified token exists on HashScan
- [ ] Tested balance fetch with real account
- [ ] Tested payment calculation
- [ ] Tested token association check
- [ ] End-to-end payment test on testnet
- [ ] Code reviewed by team
- [ ] QA approved

---

## 📞 Next Steps

### Immediate (Required)
1. ✅ Update code (DONE)
2. ✅ Update documentation (DONE)
3. [ ] Verify token on HashScan
4. [ ] Test balance API
5. [ ] Test payment calculations

### Before Mainnet Deployment
1. [ ] Complete all testnet testing
2. [ ] Verify AUDD token on mainnet HashScan
3. [ ] Test with real mainnet account (small amount)
4. [ ] Document test results
5. [ ] Get approval for production

### Post-Deployment
1. [ ] Monitor first AUDD payment
2. [ ] Verify FX rates for AUD currency
3. [ ] Check transaction validation
4. [ ] Document any issues

---

## 🚨 Important Notes

### For Developers
- Always use `TOKEN_IDS[CURRENT_NETWORK].AUDD` to get the correct token ID
- Never hardcode token IDs in components
- Test on testnet before mainnet

### For QA
- Verify both networks separately
- Test AUDD alongside other tokens
- Check FX rate calculations for AUD
- Validate tolerance (0.1% for stablecoins)

### For Operations
- Monitor AUDD payment success rate
- Track any token-specific errors
- Have rollback plan ready
- Document first production AUDD payment

---

## 📚 Related Documentation

- **Testing Guide:** `SPRINT8_TESTING_GUIDE.md`
- **Deployment Checklist:** `SPRINT8_DEPLOYMENT_CHECKLIST.md`
- **AUDD Setup:** `src/docs/AUDD_SETUP_GUIDE.md`
- **Hedera Integration:** `src/docs/SPRINT8_HEDERA_WALLET.md`

---

## 🎯 Summary

**What:** Corrected AUDD mainnet token ID from `0.0.8317070` to `0.0.1394325`  
**Why:** Previous ID was incorrect and would cause payment failures  
**Status:** Code updated, testing required before production  
**Priority:** HIGH - Must verify before mainnet deployment  

---

**Prepared by:** AI Assistant  
**Date:** December 13, 2025  
**Verified by:** User (provided correct token IDs)  
**Status:** ✅ Code Updated - Testing Pending







