# Sprint 19: Performance Optimization

**Sprint Duration:** December 15-21, 2025  
**Status:** Planning  
**Focus:** Optimize for production load with AUDD (4-token system) performance

---

## 🎯 Sprint Objectives

1. **Optimize FX snapshot creation** for 4 tokens (HBAR, USDC, USDT, AUDD)
2. **Improve database query performance** for payment flows
3. **Enhance API response times** (target: <200ms p95)
4. **Optimize FX rate caching** for 4-token fetching
5. **Reduce bundle size** and improve frontend performance
6. **Achieve <600ms TTFB** for payment pages

---

## 📊 Current Performance Baseline

### API Response Times (Estimated)
- Payment link creation: ~500ms
- FX rate fetching (4 tokens): ~800ms (4 x 200ms sequential)
- Payment status polling: ~150ms
- Ledger posting: ~300ms
- Xero sync: ~1200ms

### Database Queries
- Payment link lookup: ~50ms
- FX snapshot creation (4 tokens): ~200ms (4 sequential inserts)
- Ledger entries: ~100ms
- Dashboard list: ~300ms (no pagination)

### FX Rate Caching
- Current TTL: 60 seconds
- Cache hit rate: ~40% (estimated)
- 4 separate API calls per link creation

### Frontend
- Bundle size: ~2.5MB (unoptimized)
- TTFB: ~800ms
- FCP: ~1.2s

---

## 📦 Deliverables

### 1. Database Optimization ⭐

#### A. Add Missing Indexes
**Priority: HIGH**

Current indexes analyzed, need to add:

```sql
-- FX Snapshots: Critical for 4-token queries
CREATE INDEX idx_fx_snapshots_link_type_token 
ON fx_snapshots(payment_link_id, snapshot_type, token_type);

-- FX Snapshots: Query by token type
CREATE INDEX idx_fx_snapshots_token_captured 
ON fx_snapshots(token_type, captured_at DESC);

-- Ledger Entries: Query by account and date
CREATE INDEX idx_ledger_entries_account_posted 
ON ledger_entries(account_code, posted_at DESC);

-- Payment Events: Query by type and date
CREATE INDEX idx_payment_events_type_created 
ON payment_events(event_type, created_at DESC);

-- Payment Links: Query by currency
CREATE INDEX idx_payment_links_currency_created 
ON payment_links(currency, created_at DESC);

-- Payment Links: Expiry checking
CREATE INDEX idx_payment_links_status_expires 
ON payment_links(status, expires_at) 
WHERE status = 'OPEN';
```

**Files to create:**
- `src/prisma/migrations/20251215_add_performance_indexes/migration.sql`

#### B. Optimize Slow Queries

**Query 1: Payment Link with All Relations**
```typescript
// BEFORE: N+1 queries
const link = await prisma.paymentLink.findUnique({
  where: { shortCode },
  include: {
    fxSnapshots: true, // Separate query
    paymentEvents: true, // Separate query
    ledgerEntries: true, // Separate query
  }
})

// AFTER: Single query with selective fields
const link = await prisma.paymentLink.findUnique({
  where: { shortCode },
  select: {
    id: true,
    amount: true,
    currency: true,
    status: true,
    // Only include what's needed
    fxSnapshots: {
      where: { snapshotType: 'CREATION' }, // Filter in DB
      orderBy: { capturedAt: 'desc' },
    }
  }
})
```

**Query 2: FOUR FX Snapshots - Batch Insert**
```typescript
// BEFORE: 4 sequential inserts (~200ms)
for (const token of ['HBAR', 'USDC', 'USDT', 'AUDD']) {
  await prisma.fxSnapshot.create({ data: snapshot })
}

// AFTER: Single batch insert (~50ms)
await prisma.fxSnapshot.createMany({
  data: [
    { /* HBAR snapshot */ },
    { /* USDC snapshot */ },
    { /* USDT snapshot */ },
    { /* AUDD snapshot */ },
  ]
})
```

**Query 3: Dashboard List with Pagination**
```typescript
// BEFORE: Fetch all links (slow for large datasets)
const links = await prisma.paymentLink.findMany({
  where: { organizationId },
  include: { fxSnapshots: true }
})

// AFTER: Cursor-based pagination
const links = await prisma.paymentLink.findMany({
  where: { organizationId },
  take: 20,
  cursor: cursor ? { id: cursor } : undefined,
  orderBy: { createdAt: 'desc' },
  select: {
    // Only essential fields for list view
    id: true,
    shortCode: true,
    amount: true,
    currency: true,
    status: true,
    createdAt: true,
  }
})
```

**Files to update:**
- `src/lib/payment-link/payment-link-service.ts`
- `src/app/api/payment-links/route.ts`

#### C. Connection Pooling

**Current:** Default Prisma connection pool  
**Optimize:** Configure for production load

```typescript
// src/lib/prisma.ts
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
})

// Add connection pooling
const poolConfig = {
  connection_limit: 20, // Adjust based on load
  pool_timeout: 10,
}
```

---

### 2. FX Rate Optimization ⭐⭐⭐

#### A. Parallel Rate Fetching for 4 Tokens

**Priority: CRITICAL - This is the biggest win!**

**Problem:** Currently fetching rates sequentially  
**Solution:** Fetch all 4 tokens in parallel

```typescript
// BEFORE: Sequential (~800ms)
const hbarRate = await fxService.getRate('HBAR', 'AUD')
const usdcRate = await fxService.getRate('USDC', 'AUD')
const usdtRate = await fxService.getRate('USDT', 'AUD')
const auddRate = await fxService.getRate('AUDD', 'AUD')

// AFTER: Parallel (~200ms)
const [hbarRate, usdcRate, usdtRate, auddRate] = await Promise.all([
  fxService.getRate('HBAR', 'AUD'),
  fxService.getRate('USDC', 'AUD'),
  fxService.getRate('USDT', 'AUD'),
  fxService.getRate('AUDD', 'AUD'),
])
```

**Files to update:**
- `src/lib/fx/fx-snapshot-service.ts`
- `src/lib/fx/rate-calculator.ts`

#### B. Batch Rate Fetching API

```typescript
// New method for fetching multiple rates at once
async function fetchRatesBatch(pairs: Array<[Currency, Currency]>): Promise<ExchangeRate[]> {
  // Single API call to CoinGecko for multiple pairs
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${currencies}`
  )
  
  // Parse and return all rates
  return parseMultipleRates(response)
}
```

**Files to create:**
- `src/lib/fx/providers/batch-rate-fetcher.ts`

#### C. Improved Cache Strategy

**Current:** 60-second TTL, individual rates  
**Optimize:** Pre-warm cache, batch updates

```typescript
// Pre-warm cache on app startup
async function prewarmRateCache() {
  const tokens = ['HBAR', 'USDC', 'USDT', 'AUDD']
  const currencies = ['USD', 'AUD']
  
  const pairs = tokens.flatMap(token => 
    currencies.map(currency => [token, currency])
  )
  
  await fetchRatesBatch(pairs)
  
  // Schedule regular updates
  setInterval(() => fetchRatesBatch(pairs), 45000) // Every 45s
}
```

**Files to update:**
- `src/lib/fx/rate-cache.ts`
- `src/app/api/fx/rates/route.ts`

#### D. Increase Cache TTL for Stablecoins

```typescript
// AUDD, USDC, USDT are stable - can cache longer
const getCacheTTL = (tokenType: TokenType) => {
  if (tokenType === 'HBAR') return 60000 // 60 seconds (volatile)
  return 300000 // 5 minutes for stablecoins
}
```

---

### 3. API Performance Optimization

#### A. Response Compression

```typescript
// src/middleware.ts
import { compress } from 'compression'

export function middleware(req: Request) {
  // Enable compression for JSON responses
  if (req.headers.get('accept')?.includes('application/json')) {
    return compress(req)
  }
}
```

#### B. API Response Caching

```typescript
// Cache GET endpoints with Redis or in-memory
const CACHE_TTL = {
  'payment-link': 30, // 30 seconds
  'fx-rates': 60, // 60 seconds
  'merchant-settings': 300, // 5 minutes
}

// Use HTTP Cache-Control headers
res.setHeader('Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate`)
```

#### C. Optimize Payload Sizes

```typescript
// Return only necessary fields
type PaymentLinkListItem = Pick<
  PaymentLink,
  'id' | 'shortCode' | 'amount' | 'currency' | 'status' | 'createdAt'
>

// Add compression for large responses
if (response.size > 1024) {
  compress(response)
}
```

**Files to update:**
- `src/app/api/payment-links/route.ts`
- `src/app/api/fx/rates/route.ts`

---

### 4. Frontend Optimization

#### A. Code Splitting

```typescript
// Lazy load heavy components
const PaymentLinkDetail = lazy(() => import('@/components/PaymentLinkDetail'))
const XeroSettings = lazy(() => import('@/components/XeroSettings'))
const Analytics = lazy(() => import('@/components/Analytics'))

// Use Suspense
<Suspense fallback={<LoadingSpinner />}>
  <PaymentLinkDetail />
</Suspense>
```

#### B. Bundle Size Optimization

**Current:** ~2.5MB  
**Target:** <1MB

```bash
# Analyze bundle
npm run build -- --analyze

# Remove unused dependencies
npm prune

# Use smaller alternatives
- date-fns → date-fns/esm (tree-shakeable)
- lodash → lodash-es
```

#### C. Image Optimization

```typescript
// Use Next.js Image component
import Image from 'next/image'

<Image
  src="/logo.png"
  width={200}
  height={50}
  alt="Provvypay"
  loading="lazy"
  quality={85}
/>
```

---

### 5. Edge Optimization (Vercel)

#### A. Edge Functions for FX Rates

```typescript
// src/app/api/fx/rates/route.ts
export const runtime = 'edge' // Run on Vercel Edge Network
export const preferredRegion = ['syd1', 'iad1', 'sin1'] // Close to users

export async function GET(req: Request) {
  // Served from edge, <100ms TTFB
  const rates = await fetchRatesFromEdge()
  return Response.json(rates)
}
```

#### B. Static Asset Caching

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}
```

---

## 🎯 Performance Targets

### API Response Times
| Endpoint | Current | Target | Improvement |
|----------|---------|--------|-------------|
| Create payment link | 500ms | 250ms | 50% |
| Fetch FX rates (4 tokens) | 800ms | 200ms | 75% |
| Payment status poll | 150ms | 100ms | 33% |
| Dashboard list | 300ms | 150ms | 50% |
| Ledger posting | 300ms | 200ms | 33% |

### Database Performance
| Query | Current | Target | Improvement |
|-------|---------|--------|-------------|
| FX snapshot batch insert | 200ms | 50ms | 75% |
| Payment link with relations | 150ms | 75ms | 50% |
| Dashboard pagination | 300ms | 100ms | 67% |

### Frontend Performance
| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Bundle size | 2.5MB | 1MB | 60% |
| TTFB | 800ms | 400ms | 50% |
| FCP | 1.2s | 600ms | 50% |
| TTI | 2.5s | 1.5s | 40% |

---

## 🔧 Implementation Plan

### Phase 1: Database Optimization (Days 1-2)
**Priority: HIGH**

- [ ] Add missing indexes (FX snapshots, ledger, events)
- [ ] Optimize FX snapshot batch insert
- [ ] Implement cursor-based pagination
- [ ] Configure connection pooling
- [ ] Test query performance

**Expected Improvement:** 50-75% faster database queries

### Phase 2: FX Rate Optimization (Days 3-4)
**Priority: CRITICAL**

- [ ] Implement parallel rate fetching for 4 tokens ⭐
- [ ] Create batch rate fetching API
- [ ] Pre-warm cache on startup
- [ ] Increase TTL for stablecoins (AUDD, USDC, USDT)
- [ ] Add cache monitoring

**Expected Improvement:** 75% faster rate fetching (800ms → 200ms)

### Phase 3: API Optimization (Day 5)
**Priority: MEDIUM**

- [ ] Enable response compression
- [ ] Add API response caching
- [ ] Optimize payload sizes
- [ ] Add cache-control headers
- [ ] Implement request deduplication

**Expected Improvement:** 33-50% faster API responses

### Phase 4: Frontend Optimization (Day 6)
**Priority: MEDIUM**

- [ ] Implement code splitting
- [ ] Optimize bundle size
- [ ] Add image optimization
- [ ] Lazy load heavy components
- [ ] Enable compression

**Expected Improvement:** 60% smaller bundle, 50% faster TTFB

### Phase 5: Edge Optimization (Day 7)
**Priority: LOW**

- [ ] Move FX rate endpoint to Edge
- [ ] Configure static asset caching
- [ ] Add geographic routing
- [ ] Test TTFB from different regions

**Expected Improvement:** <600ms TTFB globally

---

## 📊 Monitoring & Metrics

### Performance Monitoring

```typescript
// Add performance tracking
import { performance } from 'perf_hooks'

async function trackPerformance(operation: string, fn: () => Promise<any>) {
  const start = performance.now()
  const result = await fn()
  const duration = performance.now() - start
  
  logger.info({ operation, duration }, 'Performance metric')
  
  return result
}

// Usage
await trackPerformance('fx-rate-fetch-4-tokens', async () => {
  return await fetchAllRates()
})
```

### Key Metrics to Track

1. **FX Rate Fetching**
   - Sequential vs parallel timing
   - Cache hit rate
   - API response times

2. **Database Queries**
   - Query execution time
   - Connection pool utilization
   - Slow query log

3. **API Endpoints**
   - p50, p95, p99 response times
   - Request rate
   - Error rate

4. **Frontend**
   - Bundle size changes
   - TTFB, FCP, TTI
   - Core Web Vitals

---

## 🧪 Testing Strategy

### Performance Tests

```typescript
// src/__tests__/performance/fx-rate-fetching.perf.test.ts
describe('FX Rate Fetching Performance', () => {
  it('should fetch 4 token rates in <250ms (parallel)', async () => {
    const start = performance.now()
    
    await Promise.all([
      fxService.getRate('HBAR', 'AUD'),
      fxService.getRate('USDC', 'AUD'),
      fxService.getRate('USDT', 'AUD'),
      fxService.getRate('AUDD', 'AUD'),
    ])
    
    const duration = performance.now() - start
    expect(duration).toBeLessThan(250)
  })
  
  it('should use cache for repeated requests', async () => {
    // First request (cache miss)
    await fxService.getRate('AUDD', 'AUD')
    
    // Second request (cache hit)
    const start = performance.now()
    await fxService.getRate('AUDD', 'AUD')
    const duration = performance.now() - start
    
    expect(duration).toBeLessThan(10) // Cache should be <10ms
  })
})
```

### Load Tests

```typescript
// Test with concurrent requests
import { performance } from 'k6'

export default function() {
  const responses = http.batch([
    ['GET', 'http://localhost:3000/api/payment-links'],
    ['GET', 'http://localhost:3000/api/fx/rates?base=AUDD&quote=AUD'],
    ['POST', 'http://localhost:3000/api/payment-links', { amount: 100 }],
  ])
  
  check(responses, {
    'all requests completed': (r) => r.every(res => res.status === 200),
    'p95 < 600ms': (r) => p95(r.map(res => res.timings.duration)) < 600,
  })
}
```

---

## 📝 Documentation Updates

### Files to Create
- `PERFORMANCE_OPTIMIZATION_GUIDE.md` - Best practices
- `CACHING_STRATEGY.md` - Cache configuration
- `DATABASE_OPTIMIZATION.md` - Query optimization tips

### Files to Update
- `FX_QUICK_REFERENCE.md` - Add parallel fetching examples
- `README.md` - Add performance benchmarks

---

## 🎉 Success Criteria

### Must Have (P0)
- [ ] FX rate fetching for 4 tokens <250ms (75% improvement)
- [ ] Database indexes added for all critical queries
- [ ] Batch FX snapshot insert implemented
- [ ] API response times improved by 30%+
- [ ] Performance tests passing

### Should Have (P1)
- [ ] Bundle size reduced to <1.5MB
- [ ] TTFB <600ms globally
- [ ] Cache hit rate >60%
- [ ] Dashboard pagination implemented

### Nice to Have (P2)
- [ ] Edge functions deployed
- [ ] Load testing completed
- [ ] Performance monitoring dashboard
- [ ] Bundle analysis automation

---

## 🚀 Expected Results

### Performance Improvements
- **75% faster FX rate fetching** (800ms → 200ms) ⭐
- **50% faster payment link creation** (500ms → 250ms)
- **67% faster dashboard loading** (300ms → 100ms)
- **60% smaller bundle size** (2.5MB → 1MB)
- **50% faster TTFB** (800ms → 400ms)

### Business Impact
- **Better user experience** - Faster page loads
- **Lower infrastructure costs** - Fewer API calls
- **Higher conversion rates** - Faster checkout
- **Better SEO** - Improved Core Web Vitals
- **Scalability** - Handle 10x more traffic

---

## 📋 Task List

- [ ] Add database performance indexes
- [ ] Optimize FX snapshot batch insert
- [ ] Implement parallel FX rate fetching ⭐
- [ ] Add batch rate fetching API
- [ ] Pre-warm FX rate cache
- [ ] Implement API response caching
- [ ] Add response compression
- [ ] Implement code splitting
- [ ] Optimize bundle size
- [ ] Add performance monitoring
- [ ] Create performance tests
- [ ] Run load tests
- [ ] Document optimizations

---

**Sprint 19 Ready to Start!** 🚀

**Critical Path:** Parallel FX rate fetching → Batch DB inserts → API caching

**Estimated Impact:** 50-75% performance improvement across the board!

---

*Sprint 19 Plan - December 15, 2025*

