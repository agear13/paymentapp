import { NextResponse } from 'next/server';

import {
  isInfrastructureDomainAllowed,
  resolveCustomerFacingOrigin,
  resolveRequestOrigin,
} from '@/lib/runtime/customer-facing-url';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestOrigin = resolveRequestOrigin({
    nextUrl: { origin: url.origin, protocol: url.protocol },
    headers: {
      get: (name: string) => request.headers.get(name),
    },
  });

  const resolution = resolveCustomerFacingOrigin({
    requestOrigin,
    runtimeOrigin: requestOrigin,
  });

  const infrastructureOverride = resolution.configured
    ? resolution.infrastructureOverride
    : isInfrastructureDomainAllowed();

  return NextResponse.json(
    {
      configured: resolution.configured,
      origin: resolution.configured ? resolution.origin : null,
      infrastructureOverride,
      overrideEnabled: isInfrastructureDomainAllowed(),
      message: resolution.configured ? undefined : resolution.message,
    },
    {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    }
  );
}
