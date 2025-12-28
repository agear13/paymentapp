# AUDD Token Setup Guide

**Quick guide for enabling AUDD (Australian Digital Dollar) support**

---

## ⚠️ Critical Steps Required

Before AUDD can be used in production, complete these steps:

### 1. Obtain AUDD Token IDs

You need the actual Hedera token IDs for AUDD on both networks.

**Updated:** `src/lib/hedera/constants.ts` ✅

```typescript
export const TOKEN_IDS = {
  MAINNET: {
    USDC: '0.0.456858',
    USDT: '0.0.456858',
    AUDD: '0.0.8317070', // ✅ Mainnet AUDD (EVM: 0x39ceba2b467fa987546000eb5d1373acf1f3a2e1)
  },
  TESTNET: {
    USDC: '0.0.1234567',
    USDT: '0.0.1234568',
    AUDD: '0.0.4918852', // ✅ Testnet AUDD (EVM: 0x00000000000000000000000000000000004b0e44)
  },
};
```

**AUDD Token Details:**
- **Mainnet Contract ID:** `0.0.8317070-kvexg`
- **Mainnet EVM Address:** `0x39ceba2b467fa987546000eb5d1373acf1f3a2e1`
- **Testnet Contract ID:** `0.0.4918852-blgqc`
- **Testnet EVM Address:** `0x00000000000000000000000000000000004b0e44`
- Check on explorers:
  - Mainnet: [https://hashscan.io/mainnet/token/0.0.8317070](https://hashscan.io/mainnet/token/0.0.8317070)
  - Testnet: [https://hashscan.io/testnet/token/0.0.4918852](https://hashscan.io/testnet/token/0.0.4918852)

### 2. Run Database Migration

Apply the schema changes to add AUDD to the database:

```bash
# Generate Prisma migration
npx prisma migrate dev --name add_audd_token

# Apply to database
npx prisma migrate deploy

# Regenerate Prisma client
npx prisma generate
```

### 3. Verify CoinGecko Support (Optional)

Check if AUDD is listed on CoinGecko:

```bash
# Search for AUDD on CoinGecko
curl "https://api.coingecko.com/api/v3/search?query=audd"
```

If AUDD is not on CoinGecko yet:
- The system will automatically fall back to Hedera Mirror Node
- AUDD/AUD will use the 1:1 peg
- AUDD/USD will be calculated from AUD/USD conversion

**Update CoinGecko ID if found:** `src/lib/fx/providers/coingecko.ts`

```typescript
const CURRENCY_TO_COINGECKO_ID: Record<string, string> = {
  HBAR: 'hedera-hashgraph',
  USDC: 'usd-coin',
  USDT: 'tether',
  AUDD: 'australian-digital-dollar', // ⚠️ VERIFY ACTUAL ID
  BTC: 'bitcoin',
  ETH: 'ethereum',
};
```

---

## ✅ Testing Checklist

After completing the critical steps, test AUDD functionality:

### Test 1: Rate Fetching

```bash
# Test AUDD/AUD rate (should be ~1.0)
curl "http://localhost:3000/api/fx/rates?base=AUDD&quote=AUD"

# Expected response:
# {
#   "success": true,
#   "data": {
#     "base": "AUDD",
#     "quote": "AUD",
#     "rate": 1.0,
#     "provider": "hedera_mirror",
#     "timestamp": "2025-12-07T..."
#   }
# }
```

```bash
# Test AUDD/USD rate (should be ~AUD/USD rate)
curl "http://localhost:3000/api/fx/rates?base=AUDD&quote=USD"

# Expected response:
# {
#   "success": true,
#   "data": {
#     "base": "AUDD",
#     "quote": "USD",
#     "rate": 0.65789...,
#     "provider": "hedera_mirror",
#     "timestamp": "2025-12-07T..."
#   }
# }
```

### Test 2: Multi-Token Rates

```bash
# Test all four tokens together
curl "http://localhost:3000/api/fx/rates?pairs=HBAR/USD,USDC/USD,USDT/USD,AUDD/AUD"

# Expected: Array with 4 rate objects
```

### Test 3: Currency Calculation

```bash
# Calculate AUDD amount for 100 AUD invoice
curl -X POST http://localhost:3000/api/fx/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "fromCurrency": "AUD",
    "toCurrency": "AUDD"
  }'

# Expected: ~100 AUDD (due to 1:1 peg)
```

### Test 4: Health Check

```bash
# Verify AUDD is included in system health
curl "http://localhost:3000/api/fx/health"

# Check response includes AUDD in supported pairs
```

### Test 5: Wallet Balance

If you have a test account with AUDD tokens:

```typescript
import { getAccountBalances } from '@/lib/hedera/token-service';

const balances = await getAccountBalances('0.0.YOUR_ACCOUNT');

console.log(balances);
// Expected:
// {
//   HBAR: '100.00000000',
//   USDC: '50.000000',
//   USDT: '75.000000',
//   AUDD: '120.000000'  ← Should appear
// }
```

### Test 6: Payment Link Creation

```typescript
import { getFxService } from '@/lib/fx';

const fxService = getFxService();

// Create payment link (replace with actual ID)
const paymentLinkId = 'your-payment-link-id';

// Capture all token snapshots (should include AUDD)
const snapshots = await fxService.captureAllCreationSnapshots(
  paymentLinkId,
  'AUD'
);

console.log(`Created ${snapshots.length} snapshots`);
// Expected: 4 snapshots (HBAR, USDC, USDT, AUDD)

console.log(snapshots.map(s => s.tokenType));
// Expected: ['HBAR', 'USDC', 'USDT', 'AUDD']
```

---

## 🚀 Production Deployment

### Pre-deployment Checklist

- [ ] AUDD token IDs added for mainnet
- [ ] AUDD token IDs added for testnet
- [ ] Database migration applied to all environments
- [ ] Prisma client regenerated
- [ ] All rate fetching tests pass
- [ ] All calculation tests pass
- [ ] UI displays 4 tokens correctly
- [ ] Wallet can fetch AUDD balances
- [ ] AUDD payment flow tested end-to-end

### Environment Variables

No additional environment variables required for AUDD support. The existing configuration is sufficient:

```bash
# Optional - CoinGecko Pro API key (if using)
COINGECKO_API_KEY=your_api_key_here

# Hedera network (already configured)
NEXT_PUBLIC_HEDERA_NETWORK=mainnet
```

### Deployment Steps

1. **Merge code changes** to your deployment branch
2. **Run database migrations** on production database:
   ```bash
   npx prisma migrate deploy
   ```
3. **Deploy application** using your normal process
4. **Verify** AUDD appears in token selector
5. **Test** AUDD payment flow in production
6. **Monitor** AUDD transactions and balances

---

## 📊 Monitoring & Validation

### Rate Monitoring

Watch for AUDD rate anomalies:

```typescript
import { getFxService } from '@/lib/fx';

const fxService = getFxService();

// Monitor AUDD/AUD peg
const rate = await fxService.getRate('AUDD', 'AUD');

if (Math.abs(rate.rate - 1.0) > 0.05) {
  console.warn('AUDD/AUD rate deviating from peg!', rate);
  // Alert team
}
```

### Balance Validation

Ensure AUDD balances are being tracked:

```typescript
import { getAccountBalances } from '@/lib/hedera/token-service';

// Check merchant wallet
const balances = await getAccountBalances(merchantAccountId);

if (balances.AUDD === '0.000000') {
  console.warn('No AUDD balance for merchant');
  // May need AUDD association
}
```

### Snapshot Verification

Verify 4 snapshots are created:

```typescript
import { getFxSnapshotService } from '@/lib/fx';

const snapshotService = getFxSnapshotService();
const snapshots = await snapshotService.getSnapshots(paymentLinkId);

const tokenTypes = snapshots.map(s => s.tokenType);
console.log('Tokens with snapshots:', tokenTypes);
// Expected: Should include AUDD
```

---

## 🆘 Troubleshooting

### Issue: "AUDD token ID not found"

**Cause:** Token IDs not updated in constants.ts

**Solution:** Update `TOKEN_IDS` with actual AUDD token IDs

### Issue: "Unsupported currency pair: AUDD/AUD"

**Cause:** Rate provider not recognizing AUDD

**Solution:** Verify Hedera Mirror provider includes AUDD in `supportsPair()`

### Issue: "AUDD balance always showing 0"

**Possible causes:**
1. Account not associated with AUDD token
2. Wrong AUDD token ID configured
3. Account truly has 0 AUDD balance

**Solution:**
```typescript
import { checkTokenAssociations } from '@/lib/hedera/token-service';

const associations = await checkTokenAssociations(accountId);
const auddAssoc = associations.find(a => a.symbol === 'AUDD');

if (!auddAssoc?.isAssociated) {
  console.log('Account not associated with AUDD - user needs to associate');
}
```

### Issue: "AUDD not appearing in token selector"

**Cause:** Payment amounts calculation not including AUDD

**Solution:** Verify token calculation logic includes all 4 tokens

### Issue: "Database migration fails"

**Error:** `Column 'token_type' does not allow AUDD`

**Solution:** Enum not updated. Check:
1. Prisma schema has AUDD in PaymentToken enum
2. Migration was generated after schema update
3. Database needs migration applied

---

## 📚 Reference Links

- [AUDD Integration Summary](./AUDD_INTEGRATION_SUMMARY.md)
- [Sprint 7: FX Pricing Engine](./SPRINT7_FX_PRICING_ENGINE.md)
- [FX Quick Reference](./FX_QUICK_REFERENCE.md)
- [Hedera Token Service Docs](https://docs.hedera.com/hedera/sdks-and-apis/sdks/token-service)
- [Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)

---

## 🎯 Success Criteria

AUDD integration is complete when:

- ✅ All 4 tokens displayed in UI
- ✅ AUDD rates fetching successfully
- ✅ AUDD balances showing correctly
- ✅ 4 snapshots created per payment link
- ✅ AUDD payments can be initiated
- ✅ AUDD payments validated with 0.1% tolerance
- ✅ Zero linting errors
- ✅ All tests passing

---

**Need Help?**

If you encounter issues:
1. Check this troubleshooting guide
2. Review the AUDD Integration Summary
3. Test with the FX health endpoint: `/api/fx/health`
4. Check server logs for detailed errors

Good luck! 🇦🇺

