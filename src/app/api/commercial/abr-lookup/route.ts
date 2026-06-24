import { NextRequest, NextResponse } from 'next/server';
import { lookupAbn } from '@/lib/commercial/abr-lookup.server';

/**
 * GET /api/commercial/abr-lookup?abn=...&notApplicable=false
 *
 * Live ABR lookup with graceful fallback to checksum validation.
 * Does not block submission when ABR is unavailable.
 */
export async function GET(request: NextRequest) {
  const abn = request.nextUrl.searchParams.get('abn') ?? '';
  const notApplicable = request.nextUrl.searchParams.get('notApplicable') === 'true';

  const result = await lookupAbn(abn, notApplicable);
  return NextResponse.json(result);
}
