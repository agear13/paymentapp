import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const deep = process.env.HEALTHCHECK_DEEP === '1';

  if (!deep) {
    return NextResponse.json(
      {
        status: 'healthy',
        mode: 'shallow',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        checks: {
          server: 'running',
          database: 'skipped',
        },
      },
      { status: 200 }
    );
  }

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
