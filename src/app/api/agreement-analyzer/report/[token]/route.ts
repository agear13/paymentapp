/**
 * GET /api/agreement-analyzer/report/[token]
 * Public read-only endpoint for obligation report status and payload.
 */

import { NextRequest, NextResponse } from 'next/server';

import {
  getPublicObligationReportByToken,
  markObligationReportViewed,
} from '@/lib/agreement-analyzer/public-report.server';
import { applyRateLimit } from '@/lib/rate-limit';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const rateLimitType =
    request.nextUrl.searchParams.get('poll') === '1' ? 'polling' : 'public';
  const rateLimitResult = await applyRateLimit(request, rateLimitType);
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 });
  }

  const report = await getPublicObligationReportByToken(token);
  if (!report) {
    return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  }

  if (report.status === 'COMPLETED' && !report.viewedAt) {
    await markObligationReportViewed(report.reportAccessToken);
    report.viewedAt = new Date().toISOString();
  }

  return NextResponse.json({ success: true, data: report });
}
