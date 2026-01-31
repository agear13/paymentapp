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
  require('server-only')
} catch {}
import { PrismaClient } from '@prisma/client';

// Runtime guard: Throw if accidentally imported in browser
if (typeof window !== 'undefined') {
  throw new Error('❌ FATAL: Server-only prisma module imported in the browser! Check your import chain.');
}

// Server-side guard: Throw if DATABASE_URL not set
if (!process.env.DATABASE_URL) {
  throw new Error('❌ FATAL: DATABASE_URL environment variable is not set');
}

// Global singleton with logging flag
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  __prismaLogged?: boolean;
};

// Create PrismaClient singleton
// In dev mode, globalForPrisma.prisma persists across hot reloads to prevent re-instantiation
export const prisma =
  globalForPrisma.prisma ??
  (() => {
    // Only log once per process when actually creating a new instance
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.DATABASE_URL &&
      !globalForPrisma.__prismaLogged
    ) {
      const dbUrl = process.env.DATABASE_URL;
      const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@'); // Mask password
      console.log(`🔌 Prisma client instantiated (pid=${process.pid}), connected to: ${maskedUrl}`);
      globalForPrisma.__prismaLogged = true;
    }

    return new PrismaClient({
      log: ['error', 'warn'],
    });
  })();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

