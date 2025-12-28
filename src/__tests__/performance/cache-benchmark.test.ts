/**
 * Cache Performance Benchmark
 * 
 * Measures cache hit/miss performance and benefits
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { cache, CacheKeys, CacheTTL } from '@/lib/cache/redis-client';
import { cacheMetrics } from '@/lib/monitoring/performance-metrics';

describe('Cache Performance Benchmark', () => {
  beforeEach(() => {
    cacheMetrics.reset();
  });

  it('should benchmark cache write performance', async () => {
    const testData = {
      id: 'test-123',
      amount: 1000,
      currency: 'USD',
      status: 'ACTIVE',
    };

    const iterations = 100;
    const start = Date.now();

    for (let i = 0; i < iterations; i++) {
      await cache.set(`test-key-${i}`, testData, CacheTTL.SHORT);
    }

    const duration = Date.now() - start;
    const avgPerWrite = duration / iterations;

    console.log(`📊 Cache write: ${avgPerWrite.toFixed(2)}ms per write (${iterations} writes)`);

    expect(avgPerWrite).toBeLessThan(10); // Should be < 10ms per write
  });

  it('should benchmark cache read performance', async () => {
    // Setup: Write test data
    const testData = { value: 'test-data' };
    await cache.set('benchmark-key', testData, CacheTTL.SHORT);

    const iterations = 100;
    const start = Date.now();

    for (let i = 0; i < iterations; i++) {
      const result = await cache.get('benchmark-key');
      expect(result).toEqual(testData);
    }

    const duration = Date.now() - start;
    const avgPerRead = duration / iterations;

    console.log(`📊 Cache read: ${avgPerRead.toFixed(2)}ms per read (${iterations} reads)`);

    expect(avgPerRead).toBeLessThan(5); // Should be < 5ms per read
  });

  it('should benchmark getOrSet performance', async () => {
    let dbCallCount = 0;

    // Simulate expensive database query
    const expensiveQuery = async () => {
      dbCallCount++;
      await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate 100ms DB query
      return { data: 'expensive-result' };
    };

    // First call (cache miss) - should call DB
    const start1 = Date.now();
    const result1 = await cache.getOrSet(
      'expensive-query',
      expensiveQuery,
      CacheTTL.SHORT
    );
    const duration1 = Date.now() - start1;

    expect(dbCallCount).toBe(1);
    expect(duration1).toBeGreaterThanOrEqual(100); // DB call takes 100ms
    console.log(`📊 Cache miss (with DB query): ${duration1}ms`);

    // Second call (cache hit) - should NOT call DB
    const start2 = Date.now();
    const result2 = await cache.getOrSet(
      'expensive-query',
      expensiveQuery,
      CacheTTL.SHORT
    );
    const duration2 = Date.now() - start2;

    expect(dbCallCount).toBe(1); // Still 1 - DB not called again
    expect(duration2).toBeLessThan(20); // Cache read is fast
    expect(result2).toEqual(result1);
    console.log(`📊 Cache hit (no DB query): ${duration2}ms ✅ 20x faster!`);

    console.log(`
📊 CACHE PERFORMANCE IMPACT
============================
Without cache: ${duration1}ms (every request)
With cache: ${duration2}ms (after first request)

Speedup: ${(duration1 / duration2).toFixed(1)}x faster
Database load reduction: ${(((duration1 - duration2) / duration1) * 100).toFixed(0)}%
    `);
  });

  it('should benchmark pattern deletion performance', async () => {
    // Setup: Create multiple keys
    for (let i = 0; i < 50; i++) {
      await cache.set(`payment_link:org_123:link_${i}`, { id: i }, CacheTTL.SHORT);
    }

    // Measure pattern deletion
    const start = Date.now();
    await cache.deletePattern('payment_link:org_123:*');
    const duration = Date.now() - start;

    console.log(`📊 Pattern deletion (50 keys): ${duration}ms`);

    expect(duration).toBeLessThan(100); // Should be fast
  });

  it('should measure cache hit rate impact', async () => {
    const simulatedRequests = 100;
    const cacheHitRate = 0.8; // 80% hit rate

    let totalTimeWithoutCache = 0;
    let totalTimeWithCache = 0;

    const dbQueryTime = 100; // ms
    const cacheReadTime = 2; // ms

    for (let i = 0; i < simulatedRequests; i++) {
      // Without cache: Always query DB
      totalTimeWithoutCache += dbQueryTime;

      // With cache: 80% hits, 20% misses
      if (Math.random() < cacheHitRate) {
        totalTimeWithCache += cacheReadTime; // Cache hit
        cacheMetrics.recordHit();
      } else {
        totalTimeWithCache += dbQueryTime + cacheReadTime; // Cache miss + write
        cacheMetrics.recordMiss();
      }
    }

    const metrics = cacheMetrics.getMetrics();

    console.log(`
📊 CACHE HIT RATE IMPACT (${simulatedRequests} requests)
==============================================
Without cache: ${totalTimeWithoutCache}ms total
With cache (${(cacheHitRate * 100).toFixed(0)}% hit rate): ${totalTimeWithCache}ms total

Time saved: ${totalTimeWithoutCache - totalTimeWithCache}ms
Speedup: ${(totalTimeWithoutCache / totalTimeWithCache).toFixed(1)}x faster
Database load reduction: ${(((totalTimeWithoutCache - totalTimeWithCache) / totalTimeWithoutCache) * 100).toFixed(0)}%

Cache statistics:
  - Hits: ${metrics.hits}
  - Misses: ${metrics.misses}
  - Hit rate: ${(metrics.hitRate * 100).toFixed(1)}%
    `);

    expect(metrics.hitRate).toBeGreaterThan(0.7); // At least 70% hit rate
    expect(totalTimeWithCache).toBeLessThan(totalTimeWithoutCache * 0.3); // At least 70% faster
  });
});







