/**
 * Shared CRON_SECRET verification for HTTP-triggered background jobs (B3).
 * Accepts X-Cron-Secret or Authorization: Bearer <CRON_SECRET>.
 */
import { NextRequest, NextResponse } from 'next/server';

export type CronAuthFailure = { kind: 'not_configured' } | { kind: 'unauthorized' };

export function getCronSecret(): string | undefined {
  const secret = process.env.CRON_SECRET?.trim();
  return secret || undefined;
}

export function verifyCronRequest(
  request: NextRequest,
  options?: { allowBearer?: boolean; allowHeader?: boolean }
): CronAuthFailure | null {
  const expected = getCronSecret();
  if (!expected) {
    return { kind: 'not_configured' };
  }

  const allowBearer = options?.allowBearer !== false;
  const allowHeader = options?.allowHeader !== false;

  if (allowHeader) {
    const headerSecret = request.headers.get('x-cron-secret');
    if (headerSecret === expected) {
      return null;
    }
  }

  if (allowBearer) {
    const auth = request.headers.get('authorization');
    if (auth === `Bearer ${expected}`) {
      return null;
    }
  }

  return { kind: 'unauthorized' };
}

export function cronAuthFailureResponse(failure: CronAuthFailure): NextResponse {
  if (failure.kind === 'not_configured') {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  }
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
