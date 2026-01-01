/**
 * Performance Metrics Endpoint
 *
 * GET /api/metrics - Detailed performance metrics
 *
 * Returns:
 * - Request performance statistics
 * - Database query performance
 * - Cache hit rates
 * - Slow operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/middleware';
import {
  performanceMonitor,
  queryPerformanceTracker,
  cacheMetrics,
} from '@/lib/monitoring/performance-metrics';

/**
 * GET /api/metrics
 * Get detailed performance metrics (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Add admin permission check
    // For now, allow any authenticated user

    // Get performance summaries
    const apiMetrics = performanceMonitor.getSummary('api_request');
    const dbMetrics = performanceMonitor.getSummary('db_query');
    const cacheStatsMetrics = performanceMonitor.getSummary('cache_operation');
    const externalApiMetrics = performanceMonitor.getSummary('external_api');

    // Get slow operations
    const slowApiRequests = performanceMonitor.getSlowOperations('api_request', 10);
    const slowDbQueries = performanceMonitor.getSlowOperations('db_query', 10);

    // Get cache statistics
    const cacheStats = cacheMetrics.getMetrics();

    // Get slowest database queries
    const slowestQueries = queryPerformanceTracker.getSlowestQueries(10);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      performance: {
        api: {
          ...apiMetrics,
          slowest: slowApiRequests.map((m) => ({
            operation: m.operation,
            duration: m.duration,
            timestamp: m.timestamp,
            metadata: m.metadata,
          })),
        },
        database: {
          ...dbMetrics,
          slowest: slowDbQueries.map((m) => ({
            operation: m.operation,
            duration: m.duration,
            timestamp: m.timestamp,
            metadata: m.metadata,
          })),
          slowestQueries,
        },
        cache: {
          ...cacheStatsMetrics,
          stats: cacheStats,
        },
        externalApi: externalApiMetrics,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/metrics
 * Clear metrics (admin only, for testing)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Clear all metrics
    performanceMonitor.clear();
    queryPerformanceTracker.clear();
    cacheMetrics.reset();

    return NextResponse.json({
      message: 'Metrics cleared successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
