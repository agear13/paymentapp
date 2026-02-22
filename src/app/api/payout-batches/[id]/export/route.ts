/**
 * Export Payout Batch CSV
 * GET /api/payout-batches/[id]/export
 * 
 * NOTE: This API is restricted to beta admins during BETA_LOCKDOWN_MODE
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { isBetaAdminEmail } from '@/lib/auth/admin';
import { applyRateLimit } from '@/lib/rate-limit';

function checkBetaLockdown(userEmail?: string | null): NextResponse | null {
  const betaLockdownEnabled = process.env.BETA_LOCKDOWN_MODE !== 'false';
  if (betaLockdownEnabled && !isBetaAdminEmail(userEmail)) {
    return NextResponse.json(
      { error: 'Forbidden: This feature is restricted during beta' },
      { status: 403 }
    );
  }
  return null;
}

function escapeCsv(val: string | null | undefined): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;
    const { user } = auth;

    const lockdownResponse = checkBetaLockdown(user.email);
    if (lockdownResponse) return lockdownResponse;

    const { id } = await params;

    const batch = await prisma.payout_batches.findUnique({
      where: { id },
      include: {
        payouts: {
          include: {
            payout_methods: { select: { method_type: true, handle: true, notes: true } },
          },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const canView = await checkUserPermission(user.id, batch.organization_id, 'view_payment_links');
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const headers = [
      'payee_user_id',
      'method_type',
      'handle',
      'notes',
      'amount',
      'currency',
    ];
    const rows = batch.payouts.map((p) => [
      escapeCsv(p.user_id),
      escapeCsv(p.payout_methods?.method_type ?? ''),
      escapeCsv(p.payout_methods?.handle ?? ''),
      escapeCsv(p.payout_methods?.notes ?? ''),
      escapeCsv(Number(p.net_amount).toFixed(2)),
      escapeCsv(p.currency),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="payout-batch-${batch.id.slice(0, 8)}.csv"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
