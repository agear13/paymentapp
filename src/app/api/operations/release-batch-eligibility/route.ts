import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { resolveOperationalCoordinationSnapshot } from '@/lib/operations/selectors/resolve-operational-coordination.server';
import { deriveReleaseBatchEligibility } from '@/lib/operations/selectors/derive-release-batch-eligibility';

export const dynamic = 'force-dynamic';

/** GET /api/operations/release-batch-eligibility?currency=AUD&minThreshold=50&projectId= */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const currency = (searchParams.get('currency') ?? 'AUD').trim();
    const minThreshold = Number(searchParams.get('minThreshold') ?? '0');
    const projectId = searchParams.get('projectId')?.trim() || undefined;

    const graph = await resolveOperationalCoordinationSnapshot({
      userId: user.id,
      projectId,
    });

    const eligibility = deriveReleaseBatchEligibility(graph, {
      currency,
      minThreshold: Number.isFinite(minThreshold) ? minThreshold : 0,
    });

    return NextResponse.json({ data: eligibility });
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[operations/release-batch-eligibility GET]', e);
    return NextResponse.json({ error: 'Failed to derive release eligibility' }, { status: 500 });
  }
}
