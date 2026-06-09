import { NextRequest, NextResponse } from 'next/server';

import { requireAgreementAnalyzerDashboardForApi } from '@/lib/agreement-analyzer/dashboard/agreement-analyzer-dashboard-auth.server';
import {
  type AgreementAnalyzerLifecycleAction,
  updateAgreementAnalyzerLeadLifecycle,
} from '@/lib/agreement-analyzer/lead-lifecycle.server';

export const dynamic = 'force-dynamic';

const LIFECYCLE_ACTIONS: AgreementAnalyzerLifecycleAction[] = [
  'QUALIFIED',
  'DEMO_BOOKED',
  'CUSTOMER',
];

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ leadId: string }> }
) {
  const auth = await requireAgreementAnalyzerDashboardForApi(request);
  if (auth.response) return auth.response;

  const { leadId } = await context.params;
  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  const action = body?.action;

  if (!action || !LIFECYCLE_ACTIONS.includes(action as AgreementAnalyzerLifecycleAction)) {
    return NextResponse.json({ error: 'Invalid lifecycle action' }, { status: 400 });
  }

  const transitioned = await updateAgreementAnalyzerLeadLifecycle(
    leadId,
    action as AgreementAnalyzerLifecycleAction
  );

  if (!transitioned) {
    return NextResponse.json(
      { error: 'Lead lifecycle could not be updated from its current stage' },
      { status: 409 }
    );
  }

  return NextResponse.json({ success: true, action });
}
