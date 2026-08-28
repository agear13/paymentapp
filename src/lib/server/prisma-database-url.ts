/**
 * Prisma runtime URL helpers for Supabase / PgBouncer.
 *
 * Supabase transaction-mode pooler (port 6543) multiplexes backends. Prisma's
 * named prepared statements (`s0`, `s1`, …) then collide with 42P05:
 * `prepared statement "s0" already exists`.
 *
 * `pgbouncer=true` tells Prisma to skip the prepared-statement cache.
 * Do not set that flag on DIRECT_DATABASE_URL (direct Postgres :5432 / migrate).
 */

function hasQueryParam(url: string, key: string): boolean {
  const query = url.split('?')[1];
  if (!query) return false;
  return query.split('&').some((part) => part.split('=')[0] === key);
}

function appendQuery(url: string, pair: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}${pair}`;
}

export function isPostgresTransactionPoolerUrl(url: string): boolean {
  return /:6543(?:\/|\?|$)/.test(url);
}

export function resolvePrismaRuntimeDatabaseUrl(
  raw: string,
  options?: { connectionLimit?: string }
): string {
  let url = raw.trim();
  if (!url) return url;

  if (isPostgresTransactionPoolerUrl(url) && !hasQueryParam(url, 'pgbouncer')) {
    url = appendQuery(url, 'pgbouncer=true');
  }

  const limit = options?.connectionLimit?.trim();
  if (limit && !hasQueryParam(url, 'connection_limit')) {
    url = appendQuery(url, `connection_limit=${encodeURIComponent(limit)}`);
  }

  return url;
}
