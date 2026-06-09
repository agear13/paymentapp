import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/server/prisma';
import { participantRowToDemo } from '@/lib/deal-network-demo/pilot-snapshot.server';
import {
  buildParticipantIdentityReport,
  buildParticipantIdentityRow,
  DEFAULT_IDENTITY_NAME_PATTERNS,
  matchesNamePatterns,
} from '@/lib/deal-network-demo/participant-identity-report';

export const dynamic = 'force-dynamic';

/**
 * GET /api/deal-network-pilot/debug/participant-identity?projectId=<dealId>
 * Read-only identity probe for duplicate-row investigation (Island DJs / Coastal Promotions).
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId')?.trim() || null;
    const patternsParam = searchParams.get('patterns')?.trim();
    const namePatterns = patternsParam
      ? patternsParam.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean)
      : [...DEFAULT_IDENTITY_NAME_PATTERNS];

    const deals = await prisma.deal_network_pilot_deals.findMany({
      where: {
        user_id: user.id,
        ...(projectId ? { id: projectId } : {}),
      },
      select: { id: true, name: true },
    });

    if (projectId && deals.length === 0) {
      return NextResponse.json(
        { error: 'Project not found for current user', projectId },
        { status: 404 }
      );
    }

    const dealIds = deals.map((d) => d.id);
    const dealNameById = new Map(deals.map((d) => [d.id, d.name]));

    const rows = await prisma.deal_network_pilot_participants.findMany({
      where: { deal_id: { in: dealIds } },
      orderBy: { created_at: 'asc' },
    });

    const identityRows = rows
      .map((row) => {
        const participant = participantRowToDemo(row);
        return buildParticipantIdentityRow({
          participant,
          dealId: row.deal_id,
          dealName: dealNameById.get(row.deal_id) ?? row.deal_id,
          createdAt: row.created_at.toISOString(),
        });
      })
      .filter((r) => matchesNamePatterns(r.name, namePatterns));

    const report = buildParticipantIdentityReport({
      rows: identityRows,
      namePatterns,
      projectIdFilter: projectId,
    });

    return NextResponse.json(report);
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const message = err.message ?? String(e);
    if (message.includes('deal_network_pilot')) {
      return NextResponse.json(
        {
          error: 'Pilot tables not available on this database',
          hint: 'Run db:migrate:deploy on the environment backing this app',
        },
        { status: 503 }
      );
    }
    console.error('[participant-identity GET]', e);
    return NextResponse.json({ error: 'Failed to build participant identity report' }, { status: 500 });
  }
}
