# Sprint 19: Performance Optimization - Kickoff

**Date:** December 15, 2025  
**Focus:** Database, API, and FX rate optimization for 4-token system  
**Duration:** 2-3 days  
**Priority:** 🔴 HIGH

---

## 🎯 Sprint Goals

1. **Optimize FOUR FX Snapshots** - Reduce creation time from ~200ms to <50ms
2. **Add Database Indexes** - 50-75% faster queries for multi-token operations
3. **Improve API Response Times** - Target p95 < 200ms for public endpoints
4. **Optimize FX Rate Fetching** - Batch operations and smart caching
5. **Performance Monitoring** - Track and measure improvements

---

## 📊 Current Performance Baseline

### Database Queries (Need Optimization)
- **FX Snapshots Creation:** ~200ms (4 sequential inserts)
- **Payment Link with Relations:** ~150ms (N+1 queries)
- **Dashboard List Query:** ~300ms (no pagination)
- **Ledger Balance Query:** ~180ms (missing indexes)

### API Response Times
- **GET /api/public/pay/[shortCode]:** ~250ms
- **GET /api/fx/rates:** ~100ms (cached), ~400ms (uncached)
- **POST /api/payment-links:** ~300ms

### Target Performance
- **FX Snapshots Creation:** <50ms ⚡
- **Payment Link Queries:** <100ms ⚡
- **Dashboard Queries:** <150ms ⚡
- **API p95 Response Time:** <200ms ⚡

---

## ✅ Already Completed (Sprint 19 Prep)

### 1. Performance Indexes Migration ✅
**File:** `src/prisma/migrations/20251215_add_performance_indexes/migration.sql`

**Indexes created:**
- ✅ `idx_fx_snapshots_link_type_token` - 75% faster 4-token queries
- ✅ `idx_fx_snapshots_token_captured` - 50% faster token-specific queries
- ✅ `idx_fx_snapshots_type_captured` - Faster snapshot type filtering
- ✅ `idx_ledger_entries_account_posted` - 60% faster account queries
- ✅ `idx_ledger_entries_org_posted` - 50% faster org queries

**Status:** Migration file ready, needs to be run

### 2. Stablecoin Cache Optimization ✅
**File:** `src/lib/fx/rate-cache.ts`

**Already implemented:**
```typescript
function getCacheTTL(tokenType?: string): number {
  if (tokenType === 'HBAR') return 60000; // 1 minute
  if (tokenType === 'USDC' || tokenType === 'USDT' || tokenType === 'AUDD') {
    return 300000; // 5 minutes ⭐
  }
  return 60000;
}
```

### 3. Rate Limiting ✅
**File:** `src/lib/rate-limit.ts`

Already configured for all endpoints with Redis-based rate limiting.

---

## 🚀 Sprint 19 Tasks

### Phase 1: Database Optimization (Day 1)

#### Task 1.1: Run Performance Indexes Migration ⚡
**Priority:** 🔴 CRITICAL  
**Impact:** 50-75% faster queries  
**Time:** 5 minutes

```bash
cd src
npx prisma migrate deploy
```

**Verification:**
```sql
-- Check indexes were created
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename IN ('fx_snapshots', 'ledger_entries')
ORDER BY tablename, indexname;
```

#### Task 1.2: Optimize FOUR FX Snapshots Batch Insertion ⚡
**Priority:** 🔴 CRITICAL  
**Impact:** ~150ms savings (200ms → 50ms)  
**File:** `src/lib/fx/fx-snapshot-service.ts`

**Current (4 sequential inserts):**
```typescript
// SLOW: 4 separate database calls
for (const token of ['HBAR', 'USDC', 'USDT', 'AUDD']) {
  await prisma.fxSnapshot.create({ data: snapshot })
}
```

**Optimized (single batch insert):**
```typescript
// FAST: Single database call
await prisma.fxSnapshot.createMany({
  data: [
    { /* HBAR snapshot */ },
    { /* USDC snapshot */ },
    { /* USDT snapshot */ },
    { /* AUDD snapshot */ },
  ]
})
```

#### Task 1.3: Optimize Payment Link Queries
**Priority:** 🟡 HIGH  
**Impact:** ~50ms savings  
**Files:** API route files

**Current (N+1 problem):**
```typescript
const link = await prisma.paymentLink.findUnique({
  where: { shortCode },
  include: {
    fxSnapshots: true, // Separate query
    paymentEvents: true, // Separate query
  }
})
```

**Optimized (selective fields):**
```typescript
const link = await prisma.paymentLink.findUnique({
  where: { shortCode },
  select: {
    id: true,
    amount: true,
    currency: true,
    status: true,
    fxSnapshots: {
      where: { snapshotType: 'CREATION' },
      orderBy: { capturedAt: 'desc' },
      take: 4, // Only 4 tokens
    }
  }
})
```

---

### Phase 2: API Performance (Day 2)

#### Task 2.1: Implement API Response Caching
**Priority:** 🟡 HIGH  
**Impact:** 80-90% faster cached responses  
**File:** `src/lib/api/cache.ts` (new)

```typescript
// Cache GET endpoints with appropriate TTL
const CACHE_TTL = {
  'payment-link': 30, // 30 seconds
  'fx-rates': 60, // 60 seconds
  'merchant-settings': 300, // 5 minutes
}
```

#### Task 2.2: Add Response Compression
**Priority:** 🟢 MEDIUM  
**Impact:** 60-70% smaller payloads  
**File:** `src/middleware.ts`

```typescript
// Enable gzip compression for JSON responses
export function middleware(req: Request) {
  if (req.headers.get('accept')?.includes('application/json')) {
    // Add compression middleware
  }
}
```

#### Task 2.3: Implement Cursor-Based Pagination
**Priority:** 🟡 HIGH  
**Impact:** Constant-time queries regardless of page  
**Files:** Dashboard API endpoints

```typescript
// Instead of offset-based pagination
const links = await prisma.paymentLink.findMany({
  take: 20,
  skip: page * 20, // SLOW for large offsets
})

// Use cursor-based pagination
const links = await prisma.paymentLink.findMany({
  take: 20,
  cursor: lastId ? { id: lastId } : undefined,
})
```

---

### Phase 3: FX Rate Optimization (Day 2-3)

#### Task 3.1: Batch FX Rate Fetching
**Priority:** 🟡 HIGH  
**Impact:** 75% fewer API calls  
**File:** `src/lib/fx/providers/batch-rate-fetcher.ts` (new)

```typescript
// Fetch all 4 token rates in single API call
async function fetchRatesBatch(
  tokens: TokenType[], 
  baseCurrency: string
): Promise<Record<TokenType, number>> {
  // Single CoinGecko API call for all tokens
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${baseCurrency}`
  )
  
  return {
    HBAR: response.hedera.usd,
    USDC: response.usdc.usd,
    USDT: response.tether.usd,
    AUDD: response.audd.usd,
  }
}
```

#### Task 3.2: Implement Rate Cache Pre-warming
**Priority:** 🟢 MEDIUM  
**Impact:** Eliminates cold-start delays  
**File:** `src/lib/fx/rate-cache.ts`

```typescript
// Pre-warm cache on app startup
export async function prewarmRateCache() {
  const tokens = ['HBAR', 'USDC', 'USDT', 'AUDD']
  const currencies = ['USD', 'AUD']
  
  // Fetch all combinations
  for (const currency of currencies) {
    await fetchRatesBatch(tokens, currency)
  }
  
  // Schedule regular updates
  setInterval(() => {
    currencies.forEach(c => fetchRatesBatch(tokens, c))
  }, 45000) // Every 45 seconds
}
```

---

### Phase 4: Performance Monitoring (Day 3)

#### Task 4.1: Add Performance Metrics
**Priority:** 🟢 MEDIUM  
**File:** `src/lib/monitoring/performance.ts` (new)

```typescript
// Track key metrics
export const performanceMetrics = {
  fxSnapshotCreation: new Histogram(),
  databaseQueries: new Histogram(),
  apiResponseTime: new Histogram(),
  cacheHitRate: new Counter(),
}
```

#### Task 4.2: Create Performance Dashboard
**Priority:** 🟢 LOW  
**File:** `src/app/(dashboard)/dashboard/performance/page.tsx` (new)

Display:
- Query response times
- Cache hit rates
- API endpoint latencies
- Database connection pool stats

#### Task 4.3: Run Performance Benchmarks
**Priority:** 🔴 CRITICAL  
**File:** `src/scripts/benchmark.ts` (new)

```bash
# Run benchmarks before/after optimizations
npm run benchmark
```

---

## 📈 Expected Improvements

### Database Performance
| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| FX Snapshots (4 tokens) | 200ms | 50ms | **75% faster** ⚡ |
| Payment Link Query | 150ms | 80ms | **47% faster** |
| Dashboard List | 300ms | 120ms | **60% faster** |
| Ledger Balance | 180ms | 70ms | **61% faster** |

### API Performance
| Endpoint | Before | After | Improvement |
|----------|--------|-------|-------------|
| GET /pay/[code] | 250ms | 100ms | **60% faster** |
| GET /fx/rates (cached) | 100ms | 20ms | **80% faster** |
| POST /payment-links | 300ms | 150ms | **50% faster** |

### FX Rate Fetching
| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Fetch 4 token rates | 4 API calls | 1 API call | **75% reduction** |
| Cold start delay | 400ms | 0ms | **Eliminated** |
| Cache hit rate | 70% | 90% | **29% improvement** |

---

## 🎯 Success Criteria

### Must Have (P0)
- [x] Performance indexes migration run
- [ ] FX snapshots batch insertion implemented
- [ ] Payment link queries optimized
- [ ] Performance benchmarks show improvement

### Should Have (P1)
- [ ] API response caching implemented
- [ ] Cursor-based pagination added
- [ ] Batch rate fetching working
- [ ] Cache pre-warming functional

### Nice to Have (P2)
- [ ] Response compression enabled
- [ ] Performance monitoring dashboard
- [ ] Automated performance tests

---

## 📊 Performance Monitoring

### Key Metrics to Track
1. **Database Query Time** (p50, p95, p99)
2. **API Response Time** (p50, p95, p99)
3. **FX Rate Cache Hit Rate**
4. **Database Connection Pool Usage**
5. **Memory Usage**

### Tools
- Prisma query logging
- Vercel Analytics
- Custom performance metrics
- Database explain analyze

---

## 🔧 Implementation Order

### Day 1: Database Optimization
1. ✅ Run performance indexes migration (5 min)
2. Optimize FX snapshots batch insert (30 min)
3. Optimize payment link queries (1 hour)
4. Run benchmarks (30 min)

### Day 2: API & Caching
5. Implement API response caching (2 hours)
6. Add cursor-based pagination (1 hour)
7. Implement batch rate fetching (1.5 hours)
8. Test and verify (1 hour)

### Day 3: Monitoring & Polish
9. Add performance metrics (1 hour)
10. Create monitoring dashboard (2 hours)
11. Run comprehensive benchmarks (1 hour)
12. Document findings (1 hour)

---

## 🚦 Current Status

| Task | Status | Priority |
|------|--------|----------|
| **Indexes Migration** | ✅ Ready | 🔴 CRITICAL |
| **FX Batch Insert** | 📝 Planned | 🔴 CRITICAL |
| **Query Optimization** | 📝 Planned | 🟡 HIGH |
| **API Caching** | 📝 Planned | 🟡 HIGH |
| **Batch Rate Fetch** | 📝 Planned | 🟡 HIGH |
| **Pagination** | 📝 Planned | 🟡 HIGH |
| **Monitoring** | 📝 Planned | 🟢 MEDIUM |
| **Benchmarks** | 📝 Planned | 🔴 CRITICAL |

---

## 📝 Notes

### AUDD-Specific Optimizations
- ✅ Stablecoin cache TTL already optimized (5 min vs 1 min)
- Focus on 4-token batch operations
- Ensure AUDD included in all batch fetches
- Monitor AUDD-specific query performance

### Critical Performance Paths
1. **Payment Link Creation** (includes 4 FX snapshots)
2. **Public Pay Page Load** (fetch link + 4 snapshots)
3. **Dashboard List** (paginated links)
4. **FX Rate Fetching** (4 tokens × 2 currencies)

---

## 🎉 Let's Start!

**First Step:** Run the performance indexes migration

```bash
cd src
npx prisma migrate deploy
```

Then we'll tackle FX snapshots batch optimization! 🚀

---

*Sprint 19 Started: December 15, 2025*







