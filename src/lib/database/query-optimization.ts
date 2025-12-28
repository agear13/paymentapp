/**
 * Database Query Optimization Utilities
 * 
 * Performance optimizations for Prisma queries:
 * - Cursor-based pagination (faster than offset for large datasets)
 * - Selective field loading (reduce data transfer)
 * - Efficient counting strategies
 * - Query result caching hints
 */

import { Prisma } from '@prisma/client';

/**
 * 📊 PERFORMANCE: Cursor-based pagination
 * 
 * Benefits over offset-based pagination:
 * - O(log n) instead of O(n) for large offsets
 * - Consistent performance regardless of page number
 * - No "missing rows" when data changes during pagination
 * 
 * Example:
 * - Page 1: SELECT ... LIMIT 20
 * - Page 2: SELECT ... WHERE id > cursor LIMIT 20
 * - Page 1000: Still just as fast as Page 2!
 */
export interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
  direction?: 'forward' | 'backward';
}

export interface CursorPaginationResult<T> {
  data: T[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
}

export function buildCursorPagination<T extends { id: string }>(
  items: T[],
  params: CursorPaginationParams
): CursorPaginationResult<T> {
  const limit = params.limit || 20;
  const hasMore = items.length > limit;

  // Remove extra item if we fetched limit + 1
  const data = hasMore ? items.slice(0, limit) : items;

  return {
    data,
    nextCursor: hasMore && data.length > 0 ? data[data.length - 1].id : null,
    prevCursor: params.cursor || null,
    hasMore,
  };
}

/**
 * 📊 PERFORMANCE: Efficient counting for large datasets
 * 
 * For very large tables (>100k rows), use estimated counts instead of exact counts.
 * PostgreSQL can estimate row counts from statistics without scanning the table.
 */
export async function getEfficientCount(
  prisma: any,
  tableName: string,
  where?: any
): Promise<{ count: number; isEstimate: boolean }> {
  // For simple queries without complex WHERE clauses, use PostgreSQL statistics
  if (!where || Object.keys(where).length === 0) {
    try {
      // Query pg_class for estimated row count
      const result = await prisma.$queryRaw<Array<{ reltuples: number }>>`
        SELECT reltuples::bigint AS reltuples
        FROM pg_class
        WHERE relname = ${tableName}
      `;
      
      if (result[0] && result[0].reltuples > 0) {
        return {
          count: Math.round(result[0].reltuples),
          isEstimate: true,
        };
      }
    } catch (error) {
      // Fall through to exact count
    }
  }

  // For filtered queries, use exact count (but cache the result)
  const exactCount = await prisma[tableName].count({ where });
  return {
    count: exactCount,
    isEstimate: false,
  };
}

/**
 * 📊 PERFORMANCE: Selective field loading strategies
 * 
 * Define different levels of data fetching based on use case:
 * - LIST: Minimal fields for list views
 * - DETAIL: Full data with relations
 * - EXPORT: Everything including audit fields
 */
export const PaymentLinkSelectors = {
  /**
   * Minimal fields for list views (fast)
   * ~50% smaller payload than full object
   */
  LIST: {
    id: true,
    short_code: true,
    amount: true,
    currency: true,
    status: true,
    description: true,
    invoice_reference: true,
    expires_at: true,
    created_at: true,
    updated_at: true,
    organization_id: true,
    // Include latest payment event only
    payment_events: {
      take: 1,
      orderBy: { created_at: 'desc' as const },
      select: {
        id: true,
        event_type: true,
        payment_method: true,
        created_at: true,
      },
    },
  } as const,

  /**
   * Full details with all relations (comprehensive)
   */
  DETAIL: {
    id: true,
    short_code: true,
    amount: true,
    currency: true,
    status: true,
    description: true,
    invoice_reference: true,
    wallet_address: true,
    payment_method: true,
    expires_at: true,
    metadata: true,
    created_at: true,
    updated_at: true,
    organization_id: true,
    payment_events: {
      orderBy: { created_at: 'desc' as const },
    },
    fx_snapshots: {
      orderBy: { captured_at: 'desc' as const },
    },
    ledger_entries: {
      include: {
        ledger_accounts: true,
      },
    },
    xero_syncs: {
      orderBy: { created_at: 'desc' as const },
      take: 10, // Limit to recent syncs
    },
  } as const,

  /**
   * Public view (minimal, no sensitive data)
   */
  PUBLIC: {
    id: true,
    short_code: true,
    amount: true,
    currency: true,
    status: true,
    description: true,
    wallet_address: true,
    payment_method: true,
    expires_at: true,
    created_at: true,
    // Latest FX rates only
    fx_snapshots: {
      where: { snapshot_type: 'CREATION' as const },
      orderBy: { captured_at: 'desc' as const },
      take: 4, // One per token (HBAR, USDC, USDT, AUDD)
    },
    // Recent events only
    payment_events: {
      orderBy: { created_at: 'desc' as const },
      take: 5,
      select: {
        id: true,
        event_type: true,
        created_at: true,
      },
    },
    organizations: {
      select: {
        id: true,
        name: true,
      },
    },
  } as const,

  /**
   * Status polling (ultra-minimal for frequent requests)
   * ~80% smaller than full object
   */
  STATUS: {
    id: true,
    short_code: true,
    status: true,
    amount: true,
    currency: true,
    expires_at: true,
    updated_at: true,
    payment_events: {
      orderBy: { created_at: 'desc' as const },
      take: 3,
      select: {
        id: true,
        event_type: true,
        payment_method: true,
        created_at: true,
      },
    },
  } as const,
};

/**
 * 📊 PERFORMANCE: Batch operations helper
 * 
 * Process large datasets in chunks to avoid memory issues and timeouts
 */
export async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processor(batch);
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * 📊 PERFORMANCE: Query hints for caching
 * 
 * Metadata to help caching layers decide what to cache and for how long
 */
export interface QueryCacheHint {
  key: string;
  ttl: number; // seconds
  tags: string[]; // For cache invalidation
}

export function buildCacheHint(
  resource: string,
  identifier: string,
  ttl: number = 60
): QueryCacheHint {
  return {
    key: `${resource}:${identifier}`,
    ttl,
    tags: [resource, identifier],
  };
}

/**
 * 📊 PERFORMANCE: Index hints for developers
 * 
 * Document which indexes are expected to be used by queries
 */
export const EXPECTED_INDEXES = {
  payment_links: {
    list_by_org: ['organization_id', 'created_at DESC'],
    find_by_short_code: ['short_code UNIQUE'],
    filter_by_status: ['organization_id', 'status', 'created_at DESC'],
    search_by_reference: ['invoice_reference'],
  },
  payment_events: {
    by_link: ['payment_link_id', 'created_at DESC'],
  },
  fx_snapshots: {
    by_link_and_type: ['payment_link_id', 'snapshot_type', 'captured_at DESC'],
  },
  ledger_entries: {
    by_link: ['payment_link_id', 'created_at DESC'],
  },
  xero_syncs: {
    by_link: ['payment_link_id', 'created_at DESC'],
    failed_syncs: ['status', 'created_at DESC'],
  },
} as const;

/**
 * 📊 PERFORMANCE: Explain query plans (development only)
 * 
 * Use this to analyze query performance in development
 */
export async function explainQuery(
  prisma: any,
  query: string
): Promise<any> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Query explanation is only available in development');
  }

  const plan = await prisma.$queryRaw`EXPLAIN ANALYZE ${Prisma.raw(query)}`;
  return plan;
}







