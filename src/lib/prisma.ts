import { PrismaClient } from '@prisma/client';

// Verify DATABASE_URL is set (without logging the actual value for security)
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
} else if (process.env.NODE_ENV !== 'production') {
  // Only log connection status in development (not the actual URL)
  const dbUrl = process.env.DATABASE_URL;
  const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@'); // Mask password
  console.log('Prisma connected to:', maskedUrl);
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
