import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { findSourceAgreementForWorkspace } from '@/lib/commercial-os/source-agreement.server';

export const dynamic = 'force-dynamic';

/** GET — org agreement linked via organization_workflow_agreements.pilot_deal_id. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { workspaceId } = await context.params;
    const agreement = await findSourceAgreementForWorkspace(user.id, workspaceId);
    return NextResponse.json({ agreement });
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[commercial-os/source-agreement GET]', e);
    return NextResponse.json({ error: 'Failed to load source agreement' }, { status: 500 });
  }
}
