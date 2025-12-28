# FX Pricing Engine - Quick Reference

**Quick reference for developers integrating with the FX Pricing Engine**

---

## 🚀 Quick Start

### Import the FX Service

```typescript
import { getFxService } from '@/lib/fx';

const fxService = getFxService();
```

---

## 📋 Common Operations

### 1. Get Current Exchange Rate

```typescript
// Single rate
const rate = await fxService.getRate('HBAR', 'USD');
console.log(rate.rate); // 0.0385

// Multiple rates
const rates = await fxService.getRates([
  { base: 'HBAR', quote: 'USD' },
  { base: 'USDC', quote: 'USD' },
]);
```

### 2. Calculate Crypto Amount for Invoice

```typescript
// Invoice: 100 AUD → Calculate required HBAR
const calc = await fxService.calculateCryptoAmount(
  100,     // Fiat amount
  'AUD',   // Fiat currency
  'HBAR'   // Crypto currency
);

console.log(`Need: ${calc.targetAmount} HBAR`);
// Output: Need: 3.85398076 HBAR
```

### 3. Calculate Fiat Value of Crypto

```typescript
// Received: 10 HBAR → Calculate AUD value
const calc = await fxService.calculateFiatAmount(
  10,      // Crypto amount
  'HBAR',  // Crypto currency
  'AUD'    // Fiat currency
);

console.log(`Value: ${calc.targetAmount} AUD`);
// Output: Value: 259.70 AUD
```

### 4. Validate Payment Amount

```typescript
const validation = fxService.validatePaymentAmount(
  10.0,    // Required
  9.95,    // Received
  0.5      // Tolerance (0.5%)
);

if (validation.isValid) {
  // Accept payment
} else if (validation.isUnderpayment) {
  // Reject - underpayment
}
```

### 5. Create FX Snapshots

```typescript
// At payment link creation - capture all token snapshots
const creationSnapshots = await fxService.captureAllCreationSnapshots(
  paymentLinkId,
  'USD'
);
// Returns array with 4 snapshots (HBAR, USDC, USDT, AUDD)

// Or capture single token snapshot
const hbarSnapshot = await fxService.captureCreationSnapshot(
  paymentLinkId,
  'HBAR',
  'USD',
  'HBAR'
);

// At payment settlement - capture for token used
const settlementSnapshot = await fxService.captureSettlementSnapshot(
  paymentLinkId,
  'USDT',
  'USD',
  'USDT'
);
```

### 6. Calculate Rate Variance

```typescript
// Calculate variance for specific token
const variance = await fxService.calculateRateVariance(paymentLinkId, 'USDT');

console.log(`USDT rate changed by ${variance.variancePercent.toFixed(2)}%`);
// Creation: 1.0000
// Settlement: 0.9998
// Variance: -0.02%
```

### 7. Format Amounts and Rates

```typescript
// Format crypto amount (8 decimals)
const formatted = fxService.formatAmount(3.853980762, 'HBAR');
// Output: "3.85398076"

// Format fiat amount (2 decimals)
const formatted = fxService.formatAmount(100.5, 'USD');
// Output: "100.50"

// Format rate (8 decimals)
const formatted = fxService.formatRate(0.0385);
// Output: "0.03850000"
```

---

## 🌐 API Endpoints

### GET /api/fx/rates
```bash
# Single rate
curl "http://localhost:3000/api/fx/rates?base=HBAR&quote=USD"

# Multiple rates (all four tokens)
curl "http://localhost:3000/api/fx/rates?pairs=HBAR/USD,USDC/USD,USDT/USD,AUDD/AUD"
```

### POST /api/fx/calculate
```bash
curl -X POST http://localhost:3000/api/fx/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "fromCurrency": "AUD",
    "toCurrency": "HBAR"
  }'
```

### GET /api/fx/health
```bash
curl "http://localhost:3000/api/fx/health"
```

### GET /api/fx/snapshots/[paymentLinkId]
```bash
curl "http://localhost:3000/api/fx/snapshots/{payment-link-id}"
```

---

## 💡 Common Patterns

### Pattern 1: Payment Link Creation with Snapshot

```typescript
async function createPaymentLink(data: PaymentLinkData) {
  // Create payment link
  const paymentLink = await prisma.paymentLink.create({ data });

  // Capture FX snapshots for all tokens if crypto payment enabled
  if (merchantSettings.hederaAccountId) {
    const fxService = getFxService();
    await fxService.captureAllCreationSnapshots(
      paymentLink.id,
      paymentLink.currency
    );
    // Creates 4 snapshots in parallel (HBAR, USDC, USDT, AUDD)
  }

  return paymentLink;
}
```

### Pattern 2: Crypto Payment Validation

```typescript
async function validateCryptoPayment(
  paymentLink: PaymentLink,
  tokenReceived: number,
  tokenType: 'HBAR' | 'USDC' | 'USDT'
) {
  const fxService = getFxService();

  // Calculate fiat value of received crypto
  const fiatValue = await fxService.calculateFiatAmount(
    tokenReceived,
    tokenType,
    paymentLink.currency
  );

  // Validate with 0.5% tolerance
  const validation = fxService.validatePaymentAmount(
    parseFloat(paymentLink.amount.toString()),
    fiatValue.targetAmount,
    0.5
  );

  if (validation.isUnderpayment) {
    throw new Error(
      `Underpayment: Received ${fiatValue.targetAmount} ` +
      `${paymentLink.currency}, required ${paymentLink.amount}`
    );
  }

  return {
    isValid: true,
    fiatValue: fiatValue.targetAmount,
    cryptoAmount: tokenReceived,
    tokenType,
  };
}
```

### Pattern 3: Settlement with Snapshot

```typescript
async function settleCryptoPayment(
  paymentLinkId: string,
  tokenReceived: number,
  tokenType: 'HBAR' | 'USDC' | 'USDT'
) {
  const fxService = getFxService();
  const paymentLink = await getPaymentLink(paymentLinkId);

  // Capture settlement snapshot for the specific token used
  const snapshot = await fxService.captureSettlementSnapshot(
    paymentLinkId,
    tokenType,
    paymentLink.currency,
    tokenType
  );

  // Calculate final amounts
  const fiatValue = await fxService.calculateFiatAmount(
    tokenReceived,
    tokenType,
    paymentLink.currency
  );

  // Create ledger entries with FX info
  await createLedgerEntries({
    paymentLinkId,
    tokenType,
    cryptoAmount: tokenReceived,
    fiatAmount: fiatValue.targetAmount,
    rate: snapshot.rate.toString(),
    provider: snapshot.provider,
  });
}
```

---

## 🎯 Supported Currency Pairs

### Crypto Currencies
- `HBAR` - Hedera Hashgraph
- `USDC` - USD Coin (USD Stablecoin)
- `USDT` - Tether USD (USD Stablecoin)
- `AUDD` - Australian Digital Dollar (AUD Stablecoin)

### Fiat Currencies
- `USD` - US Dollar
- `AUD` - Australian Dollar
- `EUR` - Euro
- `GBP` - British Pound
- `CAD` - Canadian Dollar
- `NZD` - New Zealand Dollar
- `SGD` - Singapore Dollar

### Available Pairs (via CoinGecko)
- HBAR/USD, HBAR/AUD, HBAR/EUR, HBAR/GBP
- USDC/USD, USDC/AUD, USDC/EUR, USDC/GBP
- USDT/USD, USDT/AUD, USDT/EUR, USDT/GBP
- AUDD/AUD, AUDD/USD, AUDD/EUR, AUDD/GBP

---

## ⚙️ Configuration

### Environment Variables

```bash
# Optional - CoinGecko Pro API key
COINGECKO_API_KEY=your_api_key_here
```

### Cache Configuration

```typescript
import { RateCache } from '@/lib/fx';

const cache = new RateCache({
  ttlMs: 60000,      // 60 seconds
  maxEntries: 1000,  // Max cache size
});
```

---

## 🔍 Error Handling

```typescript
import { RateProviderError } from '@/lib/fx';

try {
  const rate = await fxService.getRate('HBAR', 'USD');
} catch (error) {
  if (error instanceof RateProviderError) {
    console.error(`Provider: ${error.provider}`);
    console.error(`Code: ${error.code}`);
    console.error(`Message: ${error.message}`);
  }
}
```

---

## 📊 Precision Constants

```typescript
import { PRECISION } from '@/lib/fx';

PRECISION.CRYPTO  // 8 decimals for crypto amounts
PRECISION.FIAT    // 2 decimals for fiat amounts
PRECISION.RATE    // 8 decimals for exchange rates
```

---

## 🔄 Rate Providers

### Primary: CoinGecko
- Priority: 1 (highest)
- Rate Limit: 50/min (free), 500/min (Pro)
- Supports: All major crypto/fiat pairs

### Fallback: Hedera Mirror Node
- Priority: 2
- Rate Limit: ~100/min
- Supports: HBAR/USD, USDC/USD, USDT/USD, AUDD/AUD, and calculated cross-pairs

### Provider Health Check

```typescript
const health = await fxService.checkProviderHealth();
console.log(health);
// {
//   "coingecko": true,
//   "hedera_mirror": true
// }
```

---

## ⚡ Performance Tips

1. **Use caching:** Rates are cached for 60 seconds by default
2. **Batch requests:** Use `getRates()` for multiple pairs
3. **Reuse service:** Use singleton `getFxService()`
4. **Monitor health:** Check provider health periodically
5. **Handle fallback:** System automatically falls back to Hedera Mirror

---

## 📝 Type Definitions

```typescript
import type {
  Currency,
  CryptoCurrency,
  FiatCurrency,
  CurrencyPair,
  ExchangeRate,
  RateCalculation,
  FxSnapshotData,
} from '@/lib/fx/types';
```

---

## 🆘 Troubleshooting

### Issue: Rate fetching slow
**Solution:** Check if rates are being cached. Enable debug logging:
```typescript
import { log } from '@/lib/logger';
log.level = 'debug';
```

### Issue: Provider always failing
**Solution:** Check provider health:
```bash
curl http://localhost:3000/api/fx/health
```

### Issue: Rate variance too high
**Solution:** Check snapshot times and network conditions. Variance >5% may indicate stale rates or network issues.

---

## 📚 Additional Resources

- [Full Documentation](./SPRINT7_FX_PRICING_ENGINE.md)
- [PRD: FX Pricing Engine](../prd.md#43-fx-pricing-engine)
- [CoinGecko API Docs](https://docs.coingecko.com/)
- [Hedera Mirror Node API](https://docs.hedera.com/hedera/sdks-and-apis/rest-api)

---

**Need help?** Check the full documentation or contact the development team.


