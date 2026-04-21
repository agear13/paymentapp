/**
 * GET — funded vs owed summary for a pilot deal (Strait project funding layer).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { applyRateLimit } from '@/lib/rate-limit';
import {
  countLinkedPilotInvoices,
  isStraitProjectDeal,
  projectFundingTierFromAmounts,
  sumObligationsAmountForDeal,
  sumPilotFundingForDeal,
} from '@/lib/deal-network-demo/pilot-project-funding.server';
import { pilotDealOwnedByUser } from '@/lib/deal-network-demo/pilot-deal-invoice-link.server';
import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dealId } = await params;
    const allowed = await pilotDealOwnedByUser(user.id, dealId);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const snapshot = await getPilotSnapshotForUser(user.id);
    const deal = snapshot.deals.find((d) => d.id === dealId);
    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    if (!isStraitProjectDeal(deal)) {
      return NextResponse.json({
        straitProject: false,
        fundedTotal: 0,
        owedTotal: 0,
        projectFundingStatus: 'UNFUNDED' as const,
        linkedInvoiceCount: 0,
      });
    }

    const [fundedTotal, owedTotal, linkedInvoiceCount] = await Promise.all([
      sumPilotFundingForDeal(dealId),
      sumObligationsAmountForDeal(user.id, dealId),
      countLinkedPilotInvoices(dealId),
    ]);

    const projectFundingStatus = projectFundingTierFromAmounts(fundedTotal, owedTotal);

    return NextResponse.json({
      straitProject: true,
      fundedTotal,
      owedTotal,
      projectFundingStatus,
      linkedInvoiceCount,
    });
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[funding-summary]', e);
    return NextResponse.json({ error: 'Failed to load funding summary' }, { status: 500 });
  }
}
