# FX Pricing Engine

**Complete FX rate fetching, caching, and calculation system for Provvypay**

---

## Overview

The FX Pricing Engine provides real-time exchange rates between crypto (HBAR, USDC) and fiat currencies (USD, AUD, etc.) with:

- **Multi-provider support** - CoinGecko (primary) and Hedera Mirror Node (fallback)
- **Automatic fallback** - Seamless provider switching on failure
- **Rate caching** - 60-second in-memory cache for performance
- **Immutable snapshots** - Database-backed audit trail
- **Precise calculations** - 8-decimal precision for crypto amounts
- **Payment validation** - Tolerance-based payment verification

---

## Quick Start

```typescript
import { getFxService } from '@/lib/fx';

const fxService = getFxService();

// Get current rate
const rate = await fxService.getRate('HBAR', 'USD');

// Calculate crypto amount for invoice
const calc = await fxService.calculateCryptoAmount(100, 'AUD', 'HBAR');

// Validate payment
const validation = fxService.validatePaymentAmount(10.0, 9.95, 0.5);
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       FxService                             │
│                   (Main Facade)                             │
└──────────────┬──────────────────────────────────────────────┘
               │
    ┌──────────┴─────────────┬────────────────┬───────────────┐
    │                        │                │               │
┌───▼──────────────┐  ┌──────▼─────────┐  ┌──▼────────────┐  │
│ Rate Provider    │  │  Rate Cache    │  │  Snapshot     │  │
│ Factory          │  │                │  │  Service      │  │
│                  │  │  - LRU Cache   │  │               │  │
│  - CoinGecko     │  │  - 60s TTL     │  │  - Creation   │  │
│  - Hedera Mirror │  │  - 1000 max    │  │  - Settlement │  │
│  - Fallback      │  │                │  │  - Variance   │  │
└──────────────────┘  └────────────────┘  └───────────────┘  │
                                                              │
                                          ┌───────────────────▼───┐
                                          │  Rate Calculator      │
                                          │                       │
                                          │  - Fiat → Crypto      │
                                          │  - Crypto → Fiat      │
                                          │  - Validation         │
                                          │  - Formatting         │
                                          └───────────────────────┘
```

---

## Core Components

### 1. FxService
Main entry point for all FX operations.

```typescript
const fxService = getFxService();

// Rates
await fxService.getRate(base, quote);
await fxService.getRates(pairs);

// Calculations
await fxService.calculateCryptoAmount(fiat, fiatCurrency, cryptoCurrency);
await fxService.calculateFiatAmount(crypto, cryptoCurrency, fiatCurrency);

// Validation
fxService.validatePaymentAmount(required, received, tolerance);

// Snapshots
await fxService.captureCreationSnapshot(paymentLinkId, base, quote);
await fxService.captureSettlementSnapshot(paymentLinkId, base, quote);

// Utilities
fxService.formatAmount(amount, currency);
fxService.formatRate(rate);
```

### 2. Rate Providers

#### CoinGecko Provider (Primary)
- API: https://api.coingecko.com/api/v3
- Rate limit: 50 req/min (free), 500 req/min (Pro)
- Supports: All major crypto/fiat pairs
- Priority: 1 (highest)

#### Hedera Mirror Node Provider (Fallback)
- API: https://mainnet-public.mirrornode.hedera.com
- Rate limit: ~100 req/min
- Supports: HBAR/USD, USDC/USD, calculated AUD pairs
- Priority: 2 (fallback)

### 3. Rate Cache
In-memory LRU cache with:
- TTL: 60 seconds (configurable)
- Max entries: 1000 (configurable)
- Automatic cleanup: Every 5 minutes
- Thread-safe operations

### 4. FX Snapshot Service
Creates immutable rate records in database:
- **Creation snapshot** - When payment link is created
- **Settlement snapshot** - When payment is confirmed
- Includes: rate, provider, timestamp, currency pair
- Enables: Rate variance analysis, audit trail

### 5. Rate Calculator
Precise calculations with 8-decimal precision:
- Fiat → Crypto conversions
- Crypto → Fiat conversions
- Cross-rate calculations
- Payment validation with tolerance
- Amount formatting

---

## Supported Currency Pairs

### Crypto Currencies
- `HBAR` - Hedera Hashgraph
- `USDC` - USD Coin

### Fiat Currencies
- `USD` - US Dollar
- `AUD` - Australian Dollar
- `EUR` - Euro
- `GBP` - British Pound
- `CAD` - Canadian Dollar
- `NZD` - New Zealand Dollar
- `SGD` - Singapore Dollar

---

## API Endpoints

### GET /api/fx/rates
Fetch current exchange rates.

```bash
# Single rate
GET /api/fx/rates?base=HBAR&quote=USD

# Multiple rates
GET /api/fx/rates?pairs=HBAR/USD,USDC/USD
```

### POST /api/fx/calculate
Calculate currency conversions.

```bash
POST /api/fx/calculate
Content-Type: application/json

{
  "amount": 100,
  "fromCurrency": "AUD",
  "toCurrency": "HBAR"
}
```

### GET /api/fx/health
Check system health.

```bash
GET /api/fx/health
```

### GET /api/fx/snapshots/[paymentLinkId]
Get snapshots for a payment link.

```bash
GET /api/fx/snapshots/{payment-link-id}
```

---

## Common Patterns

### Pattern 1: Payment Link Creation
```typescript
async function createPaymentLink(data: PaymentLinkData) {
  const paymentLink = await prisma.paymentLink.create({ data });
  
  // Capture creation snapshot for crypto payments
  if (merchantSettings.hederaAccountId) {
    await fxService.captureCreationSnapshot(
      paymentLink.id,
      'HBAR',
      paymentLink.currency
    );
  }
  
  return paymentLink;
}
```

### Pattern 2: Payment Amount Display
```typescript
async function getPaymentAmounts(paymentLink: PaymentLink) {
  const fxService = getFxService();
  
  // Calculate required HBAR
  const hbarCalc = await fxService.calculateCryptoAmount(
    parseFloat(paymentLink.amount.toString()),
    paymentLink.currency,
    'HBAR'
  );
  
  // Calculate required USDC
  const usdcCalc = await fxService.calculateCryptoAmount(
    parseFloat(paymentLink.amount.toString()),
    paymentLink.currency,
    'USDC'
  );
  
  return {
    fiat: {
      amount: paymentLink.amount,
      currency: paymentLink.currency,
      formatted: fxService.formatAmount(
        parseFloat(paymentLink.amount.toString()),
        paymentLink.currency
      ),
    },
    hbar: {
      amount: hbarCalc.targetAmount,
      formatted: fxService.formatAmount(hbarCalc.targetAmount, 'HBAR'),
      rate: hbarCalc.rate,
    },
    usdc: {
      amount: usdcCalc.targetAmount,
      formatted: fxService.formatAmount(usdcCalc.targetAmount, 'USDC'),
      rate: usdcCalc.rate,
    },
  };
}
```

### Pattern 3: Payment Validation
```typescript
async function validateCryptoPayment(
  paymentLink: PaymentLink,
  hbarReceived: number
) {
  const fxService = getFxService();
  
  // Calculate fiat value
  const fiatValue = await fxService.calculateFiatAmount(
    hbarReceived,
    'HBAR',
    paymentLink.currency
  );
  
  // Validate with 0.5% tolerance
  const validation = fxService.validatePaymentAmount(
    parseFloat(paymentLink.amount.toString()),
    fiatValue.targetAmount,
    0.5
  );
  
  if (validation.isUnderpayment) {
    throw new PaymentError('UNDERPAYMENT', {
      required: paymentLink.amount,
      received: fiatValue.targetAmount,
      difference: validation.difference,
    });
  }
  
  return {
    isValid: true,
    fiatValue: fiatValue.targetAmount,
    cryptoAmount: hbarReceived,
    tolerance: validation.withinTolerance,
  };
}
```

### Pattern 4: Settlement with Snapshot
```typescript
async function settleCryptoPayment(
  paymentLinkId: string,
  hbarReceived: number
) {
  const fxService = getFxService();
  const paymentLink = await getPaymentLink(paymentLinkId);
  
  // Capture settlement snapshot
  const snapshot = await fxService.captureSettlementSnapshot(
    paymentLinkId,
    'HBAR',
    paymentLink.currency
  );
  
  // Calculate fiat value
  const fiatValue = await fxService.calculateFiatAmount(
    hbarReceived,
    'HBAR',
    paymentLink.currency
  );
  
  // Update payment link
  await prisma.paymentLink.update({
    where: { id: paymentLinkId },
    data: { status: 'PAID' },
  });
  
  // Create ledger entries with FX info
  await createLedgerEntries({
    paymentLinkId,
    cryptoAmount: hbarReceived,
    fiatAmount: fiatValue.targetAmount,
    rate: snapshot.rate.toString(),
    provider: snapshot.provider,
  });
  
  return {
    success: true,
    snapshot,
    fiatValue: fiatValue.targetAmount,
  };
}
```

---

## Configuration

### Environment Variables

```bash
# Optional - CoinGecko Pro API key for higher rate limits
COINGECKO_API_KEY=your_api_key_here
```

### Custom Provider Configuration

```typescript
import { RateProviderFactory } from '@/lib/fx';

const factory = new RateProviderFactory({
  providers: {
    coingecko: {
      apiKey: process.env.COINGECKO_API_KEY,
      timeout: 10000,
      retries: 2,
    },
    hederaMirror: {
      network: 'mainnet',
      timeout: 10000,
    },
  },
  fallbackEnabled: true,
  maxRetries: 2,
});
```

### Custom Cache Configuration

```typescript
import { RateCache } from '@/lib/fx';

const cache = new RateCache({
  ttlMs: 120000,     // 2 minutes
  maxEntries: 2000,  // Larger cache
});
```

---

## Error Handling

```typescript
import { RateProviderError } from '@/lib/fx';

try {
  const rate = await fxService.getRate('HBAR', 'USD');
} catch (error) {
  if (error instanceof RateProviderError) {
    console.error('Provider:', error.provider);
    console.error('Code:', error.code);
    console.error('Message:', error.message);
    
    // Handle specific error codes
    switch (error.code) {
      case 'UNSUPPORTED_PAIR':
        // Handle unsupported pair
        break;
      case 'API_ERROR':
        // Handle API error
        break;
      case 'ALL_PROVIDERS_FAILED':
        // All providers failed, show error to user
        break;
    }
  }
}
```

---

## Performance

### Benchmarks
- **Cache hit:** < 1ms
- **CoinGecko fetch:** 200-500ms
- **Hedera Mirror fetch:** 300-800ms
- **Calculation:** < 1ms
- **Snapshot creation:** 50-100ms (database write)

### Optimization Tips
1. Use batch `getRates()` for multiple pairs
2. Leverage caching - rates cached for 60s
3. Reuse singleton services
4. Monitor cache hit rate
5. Use health checks for provider monitoring

---

## Monitoring

### Cache Statistics
```typescript
const stats = fxService.getCacheStats();
console.log(stats);
// {
//   size: 45,
//   maxEntries: 1000,
//   ttlMs: 60000,
//   activeCount: 42,
//   expiredCount: 3
// }
```

### Provider Health
```typescript
const health = await fxService.checkProviderHealth();
console.log(health);
// {
//   coingecko: true,
//   hedera_mirror: true
// }
```

### Provider Metadata
```typescript
const metadata = await fxService.getProviderMetadata();
console.log(metadata);
// [
//   {
//     name: 'coingecko',
//     priority: 1,
//     supportedPairs: [...],
//     rateLimit: { requestsPerMinute: 50 }
//   },
//   ...
// ]
```

---

## Testing

### Manual API Testing
```bash
# Test rate fetching
curl "http://localhost:3000/api/fx/rates?base=HBAR&quote=USD"

# Test calculation
curl -X POST http://localhost:3000/api/fx/calculate \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "fromCurrency": "AUD", "toCurrency": "HBAR"}'

# Test health
curl "http://localhost:3000/api/fx/health"
```

### Provider Fallback Testing
```typescript
// Simulate CoinGecko failure (disconnect network, invalid API key, etc.)
// Should automatically fall back to Hedera Mirror Node
const rate = await fxService.getRate('HBAR', 'USD');
console.log(`Provider used: ${rate.provider}`);
// Should be "hedera_mirror" if CoinGecko fails
```

---

## TypeScript Types

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

## Documentation

- **Full Documentation:** [SPRINT7_FX_PRICING_ENGINE.md](../../docs/SPRINT7_FX_PRICING_ENGINE.md)
- **Quick Reference:** [FX_QUICK_REFERENCE.md](../../docs/FX_QUICK_REFERENCE.md)
- **PRD:** [Section 4.3: FX Pricing Engine](../../prd.md#43-fx-pricing-engine)

---

## Support

For issues or questions:
1. Check the [full documentation](../../docs/SPRINT7_FX_PRICING_ENGINE.md)
2. Review [quick reference](../../docs/FX_QUICK_REFERENCE.md)
3. Contact the development team

---

**Version:** 1.0  
**Status:** Production Ready ✅  
**Last Updated:** December 5, 2025













