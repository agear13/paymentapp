/**
 * TEMPORARY — dev config for /dev/pinch sandbox page.
 * GET /api/pinch/dev-config
 */

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  return NextResponse.json({
    testPayerId: process.env.PINCH_TEST_PAYER_ID?.trim() || null,
  });
}
