import { createHash } from 'node:crypto';

const IP_HASH_SALT =
  process.env.AUTH_IP_HASH_SALT ?? process.env.CSRF_SECRET ?? 'provvypay-auth-ip-salt';

/** One-way hash of client IP for audit storage (not reversible). */
export function hashIpAddress(ip: string | undefined | null): string | undefined {
  if (!ip || ip === 'unknown') return undefined;
  return createHash('sha256').update(`${IP_HASH_SALT}:${ip}`).digest('hex').slice(0, 32);
}
