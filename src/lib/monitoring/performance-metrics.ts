/**
 * Performance Monitoring and Metrics
 * 
 * Tracks and reports application performance metrics:
 * - API response times
 * - Database query performance
 * - Cache hit rates
 * - Error rates
 * - Resource usage
 * 
 * 📊 MONITORING BENEFITS:
 * - Identify slow endpoints
 * - Track performance regressions
 * - Optimize based on real data
 * - Alert on performance issues
 */

import { loggers, logPerformance } from '../logger';
import { cache } from '../cache/redis-client';

/**
 * Performance metric types
 */
export type MetricType =
  | 'api_request'
  | 'db_query'
  | 'cache_operation'
  | 'external_api'
  | 'computation';

/**
 * Performance metric data
 */
export interface PerformanceMetric {
  type: MetricType;
  operation: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, any>;
  success: boolean;
}

/**
 * Performance thresholds (in milliseconds)
 */
export const PERFORMANCE_THRESHOLDS = {
  api_request: {
    fast: 100,
    acceptable: 500,
    slow: 1000,
  },
  db_query: {
    fast: 10,
    acceptable: 50,
    slow: 100,
  },
  cache_operation: {
    fast: 1,
    acceptable: 5,
    slow: 10,
  },
  external_api: {
    fast: 100,
    acceptable: 500,
    slow: 2000,
  },
  computation: {
    fast: 50,
    acceptable: 200,
    slow: 500,
  },
} as const;

/**
 * Performance metrics store
 */
class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly MAX_METRICS = 1000; // Keep last 1000 metrics in memory

  /**
   * Record a performance metric
   */
  record(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Trim to max size
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift();
    }

    // Log if slow
    const threshold = PERFORMANCE_THRESHOLDS[metric.type];
    if (metric.duration > threshold.slow) {
      loggers.api.warn(
        {
          ...metric.metadata,
          duration: metric.duration,
          operation: metric.operation,
        },
        `Slow ${metric.type}: ${metric.operation}`
      );
    }

    // Log performance
    logPerformance(metric.operation, metric.duration, {
      type: metric.type,
      success: metric.success,
      ...metric.metadata,
    });
  }

  /**
   * Measure execution time of a function
   */
  async measure<T>(
    type: MetricType,
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const start = Date.now();
    let success = true;
    let error: any;

    try {
      return await fn();
    } catch (err) {
      success = false;
      error = err;
      throw err;
    } finally {
      const duration = Date.now() - start;

      this.record({
        type,
        operation,
        duration,
        timestamp: new Date(),
        metadata: {
          ...metadata,
          ...(error ? { error: error.message } : {}),
        },
        success,
      });
    }
  }

  /**
   * Get metrics summary
   */
  getSummary(type?: MetricType): {
    count: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    successRate: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    const filtered = type
      ? this.metrics.filter((m) => m.type === type)
      : this.metrics;

    if (filtered.length === 0) {
      return {
        count: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        successRate: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    const durations = filtered.map((m) => m.duration).sort((a, b) => a - b);
    const successes = filtered.filter((m) => m.success).length;

    return {
      count: filtered.length,
      avgDuration:
        durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      successRate: successes / filtered.length,
      p50: this.percentile(durations, 0.5),
      p95: this.percentile(durations, 0.95),
      p99: this.percentile(durations, 0.99),
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get slow operations
   */
  getSlowOperations(type?: MetricType, limit: number = 10): PerformanceMetric[] {
    const filtered = type
      ? this.metrics.filter((m) => m.type === type)
      : this.metrics;

    return filtered
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Clear metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Export metrics for analysis
   */
  export(): PerformanceMetric[] {
    return [...this.metrics];
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Decorator for automatic performance tracking
 * 
 * @example
 * ```typescript
 * class PaymentService {
 *   @trackPerformance('db_query', 'create_payment_link')
 *   async createPaymentLink(data: any) {
 *     return await prisma.payment_links.create({ data });
 *   }
 * }
 * ```
 */
export function trackPerformance(type: MetricType, operation: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return performanceMonitor.measure(
        type,
        operation,
        () => originalMethod.apply(this, args)
      );
    };

    return descriptor;
  };
}

/**
 * Middleware for API request performance tracking
 */
export async function withPerformanceTracking<T>(
  operation: string,
  handler: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  return performanceMonitor.measure('api_request', operation, handler, metadata);
}

/**
 * Cache hit rate tracker
 */
class CacheMetrics {
  private hits = 0;
  private misses = 0;
  private errors = 0;

  recordHit(): void {
    this.hits++;
  }

  recordMiss(): void {
    this.misses++;
  }

  recordError(): void {
    this.errors++;
  }

  getMetrics(): {
    hits: number;
    misses: number;
    errors: number;
    total: number;
    hitRate: number;
  } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      errors: this.errors,
      total,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.errors = 0;
  }
}

export const cacheMetrics = new CacheMetrics();

/**
 * Database query performance tracker
 */
export class QueryPerformanceTracker {
  private queries: Map<string, number[]> = new Map();

  recordQuery(query: string, duration: number): void {
    const existing = this.queries.get(query) || [];
    existing.push(duration);
    this.queries.set(query, existing);

    // Log slow queries
    if (duration > PERFORMANCE_THRESHOLDS.db_query.slow) {
      loggers.database.warn(
        { query, duration },
        'Slow database query detected'
      );
    }
  }

  getSlowestQueries(limit: number = 10): Array<{
    query: string;
    avgDuration: number;
    count: number;
    maxDuration: number;
  }> {
    const results: Array<{
      query: string;
      avgDuration: number;
      count: number;
      maxDuration: number;
    }> = [];

    for (const [query, durations] of this.queries.entries()) {
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const maxDuration = Math.max(...durations);

      results.push({
        query,
        avgDuration,
        count: durations.length,
        maxDuration,
      });
    }

    return results
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, limit);
  }

  clear(): void {
    this.queries.clear();
  }
}

export const queryPerformanceTracker = new QueryPerformanceTracker();

/**
 * Health check metrics
 */
export interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  performance: {
    avgApiResponse: number;
    avgDbQuery: number;
    cacheHitRate: number;
  };
  errors: {
    lastHour: number;
    last24Hours: number;
  };
}

/**
 * Get current health metrics
 */
export function getHealthMetrics(): HealthMetrics {
  const apiSummary = performanceMonitor.getSummary('api_request');
  const dbSummary = performanceMonitor.getSummary('db_query');
  const cacheSummary = cacheMetrics.getMetrics();

  const memUsage = process.memoryUsage();
  const memPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;

  // Determine health status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  if (
    apiSummary.avgDuration > PERFORMANCE_THRESHOLDS.api_request.slow ||
    dbSummary.avgDuration > PERFORMANCE_THRESHOLDS.db_query.slow ||
    memPercentage > 90
  ) {
    status = 'degraded';
  }

  if (
    apiSummary.successRate < 0.95 ||
    dbSummary.successRate < 0.95 ||
    memPercentage > 95
  ) {
    status = 'unhealthy';
  }

  return {
    status,
    uptime: process.uptime(),
    memory: {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: memPercentage,
    },
    performance: {
      avgApiResponse: apiSummary.avgDuration,
      avgDbQuery: dbSummary.avgDuration,
      cacheHitRate: cacheSummary.hitRate,
    },
    errors: {
      lastHour: 0, // TODO: Implement error tracking
      last24Hours: 0,
    },
  };
}

/**
 * 📊 USAGE EXAMPLES
 * 
 * 1. Track API request performance:
 * ```typescript
 * export async function GET(req: NextRequest) {
 *   return withPerformanceTracking('list_payment_links', async () => {
 *     const data = await prisma.payment_links.findMany();
 *     return NextResponse.json(data);
 *   }, { organizationId: 'org_123' });
 * }
 * ```
 * 
 * 2. Track database query performance:
 * ```typescript
 * const start = Date.now();
 * const result = await prisma.$queryRaw`SELECT * FROM payment_links`;
 * queryPerformanceTracker.recordQuery('SELECT payment_links', Date.now() - start);
 * ```
 * 
 * 3. Track cache performance:
 * ```typescript
 * const cached = await cache.get(key);
 * if (cached) {
 *   cacheMetrics.recordHit();
 * } else {
 *   cacheMetrics.recordMiss();
 * }
 * ```
 * 
 * 4. View metrics:
 * ```typescript
 * // Get summary
 * const summary = performanceMonitor.getSummary('api_request');
 * console.log(`Avg API response time: ${summary.avgDuration}ms`);
 * console.log(`P95: ${summary.p95}ms`);
 * console.log(`Success rate: ${summary.successRate * 100}%`);
 * 
 * // Get slow operations
 * const slowOps = performanceMonitor.getSlowOperations('api_request', 5);
 * console.log('Top 5 slowest operations:', slowOps);
 * 
 * // Get health status
 * const health = getHealthMetrics();
 * console.log('System health:', health.status);
 * ```
 */







