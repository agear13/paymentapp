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

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ query, args }) {
        incrementOperationalApiDbQueryCount();
        return query(args);
      },
    },
  },
}) as unknown as PrismaClient;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = basePrisma as PrismaClient;
}
