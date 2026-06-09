import 'server-only';

import { NextRequest } from 'next/server';

export function extractRequestAuditContext(request: NextRequest) {
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    undefined;
  const userAgent = request.headers.get('user-agent') ?? undefined;
  const correlationId = request.headers.get('x-correlation-id') ?? undefined;

  return { ipAddress, userAgent, correlationId };
}
