import { NextRequest, NextResponse } from 'next/server';

import { requireAgreementAnalyzerDashboardForApi } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-auth.server';
import { getAgreementAnalyzerLeadDetail } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-queries.server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ leadId: string }> }
) {
  const auth = await requireAgreementAnalyzerDashboardForApi(request);
  if (auth.response) return auth.response;

  const { leadId } = await context.params;
  const lead = await getAgreementAnalyzerLeadDetail(leadId);

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  return NextResponse.json(lead);
}
