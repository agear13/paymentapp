import { PrismaClient } from '@prisma/client';

// Verify DATABASE_URL is set (without logging the actual value for security)
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
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
