import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: 'connected',
        server: 'running',
      },
    };

    return NextResponse.json(healthData, { status: 200 });
  } catch (error) {
    console.error('Health check failed:', error);

    const errorData = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      checks: {
        database: 'error',
        server: 'running',
      },
    };

    return NextResponse.json(errorData, { status: 503 });
  }
}
