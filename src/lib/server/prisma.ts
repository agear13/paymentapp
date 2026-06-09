/**
 * SERVER-ONLY Prisma Client
 *
 * CRITICAL: This module must NEVER be imported by client-side code.
 * Only import from:
 * - API routes (src/app/api/.../route.ts)
 * - Server Components (without 'use client')
 * - Server Actions
 * - Scripts (src/scripts/...)
 */

// Next.js "server-only" is a compile-time hint; it doesn't exist in plain Node scripts.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional dependency for Next bundles only
  require('server-only');
} catch {
  /* scripts / tests */
}
import { PrismaClient } from '@prisma/client';
import { incrementOperationalApiDbQueryCount } from '@/lib/operations/dev/api-route-diagnostics.server';

// Runtime guard: Throw if accidentally imported in browser
if (typeof window !== 'undefined') {
  throw new Error('❌ FATAL: Server-only prisma module imported in the browser! Check your import chain.');
}

// Server-side guard: Throw if DATABASE_URL not set
if (!process.env.DATABASE_URL) {
  throw new Error('❌ FATAL: DATABASE_URL environment variable is not set');
}
// DIRECT_DATABASE_URL is read by the generated client for Prisma CLI / direct connections (see schema directUrl).

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function resolveDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL ?? '';
  const limit = process.env.PRISMA_CONNECTION_LIMIT?.trim();
  if (!limit || raw.includes('connection_limit=')) {
    return raw;
  }
  const separator = raw.includes('?') ? '&' : '?';
  return `${raw}${separator}connection_limit=${encodeURIComponent(limit)}`;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
    datasources: {
      db: {
        url: resolveDatabaseUrl(),
      },
    },
  });
}

const basePrisma = globalForPrisma.prisma ?? createPrismaClient();

// Dev-only query counting adds AsyncLocalStorage overhead on every DB call.
const prismaWithExtensions =
  process.env.NODE_ENV === 'production'
    ? basePrisma
    : basePrisma.$extends({
        query: {
          $allModels: {
            async $allOperations({ query, args }) {
              incrementOperationalApiDbQueryCount();
              return query(args);
            },
          },
        },
      });

export const prisma = prismaWithExtensions as unknown as PrismaClient;

globalForPrisma.prisma = basePrisma;
