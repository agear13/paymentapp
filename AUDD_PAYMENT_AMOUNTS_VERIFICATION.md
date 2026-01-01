# AUDD Support in Hedera Payment Amounts - Verification Guide

## Overview
AUDD (Australian Digital Dollar) has been fully integrated into the Hedera payment amounts flow, matching the existing patterns for USDC/USDT stablecoins.

## Changes Made

### 1. ✅ API Route: `/api/hedera/payment-amounts`
**File:** `src/app/api/hedera/payment-amounts/route.ts`

**Changes:**
- Updated request schema to accept `AUDD` in `walletBalances` object
- Expanded token list from `['HBAR', 'USDC', 'USDT']` to `['HBAR', 'USDC', 'USDT', 'AUDD']`
- Updated comment to reflect "all four tokens"

**Result:** API now calculates payment amounts for all four tokens in parallel.

### 2. ✅ API Route: `/api/hedera/transactions/monitor`
**File:** `src/app/api/hedera/transactions/monitor/route.ts`

**Changes:**
- Updated Zod enum from `z.enum(['HBAR', 'USDC', 'USDT'])` to include `'AUDD'`

**Result:** Transaction monitoring now accepts AUDD as a valid token type.

### 3. ✅ UI Component Documentation
**File:** `src/components/public/hedera-payment-option.tsx`

**Changes:**
- Updated component JSDoc comment to mention AUDD support

**Result:** Documentation now correctly reflects all supported tokens.

### 4. ✅ Shared Constants (Already Configured)
**File:** `src/lib/hedera/constants.ts`

**Existing Configuration:**
```typescript
export const TOKEN_CONFIG = {
  // ... HBAR, USDC, USDT ...
  AUDD: {
    id: TOKEN_IDS[CURRENT_NETWORK === 'mainnet' ? 'MAINNET' : 'TESTNET'].AUDD,
    symbol: 'AUDD',
    name: 'Australian Digital Dollar',
    decimals: 6,
    isNative: false,
    isStablecoin: true,  // ✅ Treated as stablecoin
    icon: '🇦🇺',
  },
}

export const ESTIMATED_FEES = {
  // ... other tokens ...
  AUDD: 0.01, // Same fee structure as USDC/USDT
}
```

**Token IDs:**
- **Testnet:** `0.0.4918852`
- **Mainnet:** `0.0.1394325`

### 5. ✅ Token Service (Already Configured)
**File:** `src/lib/hedera/token-service.ts`

**Existing Functions:**
- `isStablecoin('AUDD')` returns `true` ✅
- `formatTokenAmount()` uses 6 decimals for AUDD ✅
- `getSupportedTokens()` dynamically includes AUDD via `Object.keys(TOKEN_CONFIG)` ✅

### 6. ✅ FX Services (Already Configured)
**Files:** 
- `src/lib/fx/fx-snapshot-service.ts`
- `src/lib/fx/providers/batch-rate-fetcher.ts`
- `src/lib/fx/batch-fx-service.ts`

**Existing Configuration:**
- All FX services already include AUDD in token lists
- CoinGecko mappings include AUDD
- Batch operations support all four tokens

---

## Verification Steps

### 1. Manual API Test with curl

#### Test Payment Amounts Calculation (Without Wallet Balances)
```bash
curl -X POST http://localhost:3000/api/hedera/payment-amounts \
  -H "Content-Type: application/json" \
  -d '{
    "fiatAmount": 100,
    "fiatCurrency": "AUD"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "fiatAmount": 100,
    "fiatCurrency": "AUD",
    "paymentAmounts": [
      {
        "tokenType": "HBAR",
        "requiredAmount": "...",
        "fiatAmount": "100.00",
        "fiatCurrency": "AUD",
        "rate": "...",
        "estimatedFee": "0.00100000",
        "totalAmount": "...",
        "isRecommended": false,
        "recommendationReason": "Native token, lowest fee"
      },
      {
        "tokenType": "USDC",
        "requiredAmount": "...",
        "fiatAmount": "100.00",
        "fiatCurrency": "AUD",
        "rate": "...",
        "estimatedFee": "0.010000",
        "totalAmount": "...",
        "isRecommended": true,
        "recommendationReason": "Recommended stablecoin"
      },
      {
        "tokenType": "USDT",
        "requiredAmount": "...",
        "fiatAmount": "100.00",
        "fiatCurrency": "AUD",
        "rate": "...",
        "estimatedFee": "0.010000",
        "totalAmount": "...",
        "isRecommended": false,
        "recommendationReason": "Stable value, no price volatility"
      },
      {
        "tokenType": "AUDD",
        "requiredAmount": "...",
        "fiatAmount": "100.00",
        "fiatCurrency": "AUD",
        "rate": "...",
        "estimatedFee": "0.010000",
        "totalAmount": "...",
        "isRecommended": false,
        "recommendationReason": "Stable value, no price volatility"
      }
    ],
    "timestamp": "2026-01-02T..."
  }
}
```

#### Test Payment Amounts Calculation (With AUDD Wallet Balance)
```bash
curl -X POST http://localhost:3000/api/hedera/payment-amounts \
  -H "Content-Type: application/json" \
  -d '{
    "fiatAmount": 100,
    "fiatCurrency": "AUD",
    "walletBalances": {
      "HBAR": "10.00000000",
      "USDC": "0.000000",
      "USDT": "0.000000",
      "AUDD": "150.000000"
    }
  }'
```

**Expected Behavior:**
- AUDD should be marked as `"isRecommended": true`
- `"recommendationReason": "Stable value + sufficient balance"`

#### Test Transaction Monitor with AUDD
```bash
curl -X POST http://localhost:3000/api/hedera/transactions/monitor \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "0.0.123456",
    "tokenType": "AUDD",
    "expectedAmount": 100.5,
    "timeoutMs": 300000
  }'
```

**Expected:** Request accepted, monitoring starts for AUDD token transfers.

### 2. TypeScript Compilation Check
```bash
npm run build
```

**Expected:** No TypeScript errors related to token types.

### 3. UI Flow Test
1. Create a payment link in AUD
2. Open the payment page
3. Select Hedera payment method
4. Verify all 4 tokens (HBAR, USDC, USDT, AUDD) are displayed
5. Verify AUDD shows:
   - Correct amount calculation
   - Proper stablecoin recommendation logic
   - 6 decimal places formatting
   - Proper fee estimation (0.01 AUDD)

---

## Recommendation Logic Summary

### Default (No Wallet Balances)
- **USDC:** Recommended by default (line 87-97 in route.ts)
- **USDT:** Not recommended
- **AUDD:** Not recommended
- **HBAR:** Not recommended

### With Sufficient AUDD Balance
- **AUDD:** Recommended (stablecoin + balance)
- **USDC:** Not recommended
- **USDT:** Not recommended
- **HBAR:** Only if has balance and no stablecoins have balance

### Recommendation Priority
1. Any stablecoin (USDC/USDT/AUDD) with sufficient balance
2. USDC by default (if no wallets have balance)
3. HBAR with balance (if no stablecoins available)

---

## Database Schema (Already Configured)

The `PaymentToken` enum in Prisma schema already includes AUDD:

```prisma
enum PaymentToken {
  HBAR
  USDC
  USDT
  AUDD
}
```

**FX Snapshots:** AUDD snapshots are captured automatically during payment link creation.

---

## Integration Points Verified

### ✅ Files Updated
1. `src/app/api/hedera/payment-amounts/route.ts`
2. `src/app/api/hedera/transactions/monitor/route.ts`
3. `src/components/public/hedera-payment-option.tsx`

### ✅ Files Already Supporting AUDD
1. `src/lib/hedera/constants.ts` (TOKEN_CONFIG, ESTIMATED_FEES, TOKEN_IDS)
2. `src/lib/hedera/token-service.ts` (all helper functions)
3. `src/lib/hedera/transaction-monitor.ts` (uses TokenType)
4. `src/lib/hedera/payment-validator.ts` (uses TOKEN_CONFIG)
5. `src/lib/hedera/payment-confirmation.ts` (generic TokenType support)
6. `src/lib/fx/fx-snapshot-service.ts` (AUDD in token list)
7. `src/lib/fx/providers/batch-rate-fetcher.ts` (AUDD mapping)
8. `src/lib/fx/batch-fx-service.ts` (CoinGecko AUDD support)
9. `src/components/public/token-selector.tsx` (dynamic token support)
10. `src/components/public/token-comparison.tsx` (dynamic token support)
11. `src/components/public/payment-instructions.tsx` (TokenType support)

### ✅ UI Components
All UI components use the `TokenPaymentAmount[]` array returned from the API, so they automatically support AUDD without code changes.

---

## Testing Checklist

- [ ] API returns 4 tokens (HBAR, USDC, USDT, AUDD) in payment amounts
- [ ] AUDD is marked as stablecoin in recommendations
- [ ] AUDD shows 6 decimal places
- [ ] AUDD fee is 0.01 (same as USDC/USDT)
- [ ] Transaction monitor accepts AUDD token type
- [ ] UI displays all 4 token options
- [ ] Payment flow works end-to-end with AUDD
- [ ] FX rates fetch correctly for AUDD
- [ ] Ledger posting works with AUDD payments
- [ ] TypeScript compilation succeeds

---

## Production Deployment Notes

1. **Environment Variables:** No new environment variables needed
2. **Database Migrations:** Already applied (PaymentToken enum includes AUDD)
3. **FX Rate Provider:** CoinGecko supports AUDD via `novatti-australian-digital-dollar` ID
4. **Token IDs:**
   - Use **Testnet** (`0.0.4918852`) for staging/testing
   - Use **Mainnet** (`0.0.1394325`) for production
5. **Hedera Network:** Set via `NEXT_PUBLIC_HEDERA_NETWORK` environment variable

---

## Summary

✅ **AUDD is now fully supported** in the Hedera payment amounts flow:
- All 4 tokens calculated in parallel
- Stablecoin recommendation logic includes AUDD
- Transaction monitoring supports AUDD
- UI automatically displays AUDD option
- FX services already configured
- No breaking changes to existing USDC/USDT/HBAR functionality

**Status:** Ready for testing and deployment.

