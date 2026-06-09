import { NextRequest, NextResponse } from 'next/server';

import { getAgreementAnalyzerAnalytics } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-analytics.server';
import { requireAgreementAnalyzerDashboardForApi } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-auth.server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAgreementAnalyzerDashboardForApi(request);
  if (auth.response) return auth.response;

  const analytics = await getAgreementAnalyzerAnalytics();
  return NextResponse.json(analytics);
}
