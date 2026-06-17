import { NextResponse } from 'next/server';
import { evaluateAgreementStorageHealth } from '@/lib/agreement-analyzer/upload-storage/agreement-upload-storage-diagnostics.server';
import { getStorageHealth } from '@/lib/storage/storage-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const deep = process.env.HEALTHCHECK_DEEP === '1';
  const isProduction = process.env.NODE_ENV === 'production';
  const agreementStorage = evaluateAgreementStorageHealth();

  if (isProduction && agreementStorage.misconfigured) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        mode: deep ? 'deep' : 'shallow',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        checks: {
          server: 'running',
          database: deep ? 'pending' : 'skipped',
          agreementStorage: 'misconfigured',
        },
        agreementStorage,
        error: agreementStorage.reason,
      },
      { status: 503 }
    );
  }

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
          agreementStorage: agreementStorage.configured ? 'configured' : 'local_dev',
        },
        agreementStorage: {
          provider: agreementStorage.provider,
          bucket: agreementStorage.bucket,
          environment: agreementStorage.environment,
        },
      },
      { status: 200 }
    );
  }

  try {
    const { prisma } = await import('@/lib/server/prisma');
    await prisma.$queryRaw`SELECT 1`;

    const storageHealth = getStorageHealth();
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: 'connected',
        server: 'running',
        storage: storageHealth.configured ? 'configured' : 'misconfigured',
        agreementStorage: agreementStorage.configured ? 'configured' : 'misconfigured',
      },
      storage: storageHealth,
      agreementStorage,
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
      agreementStorage,
    };

    return NextResponse.json(errorData, { status: 503 });
  }
}
