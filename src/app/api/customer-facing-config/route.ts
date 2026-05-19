import { NextResponse } from 'next/server';

import {
  resolveCustomerFacingOrigin,
  resolveRequestOrigin,
} from '@/lib/runtime/customer-facing-url';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const resolution = resolveCustomerFacingOrigin({
    requestOrigin: resolveRequestOrigin({
      nextUrl: { origin: url.origin, protocol: url.protocol },
      headers: {
        get: (name: string) => request.headers.get(name),
      },
    }),
  });

  return NextResponse.json(
    {
      configured: resolution.configured,
      origin: resolution.configured ? resolution.origin : null,
      message: resolution.configured ? undefined : resolution.message,
    },
    {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    }
  );
}
