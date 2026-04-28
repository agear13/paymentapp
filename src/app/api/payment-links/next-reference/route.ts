import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';

const AUTO_PREFIX = 'INV-';
const PAD_LENGTH = 4;

function formatInvoiceReference(sequence: number): string {
  return `${AUTO_PREFIX}${String(sequence).padStart(PAD_LENGTH, '0')}`;
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;
    const { user } = auth;

    const organizationId = request.nextUrl.searchParams.get('organizationId');
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const canCreate = await checkUserPermission(
      user.id,
      organizationId,
      'create_payment_links'
    );
    if (!canCreate) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    const rows = await prisma.$queryRaw<Array<{ max_sequence: number }>>`
      SELECT COALESCE(MAX((substring(invoice_reference from '^INV-([0-9]+)$'))::int), 0) AS max_sequence
      FROM payment_links
      WHERE organization_id = ${organizationId}::uuid
        AND invoice_reference ~ '^INV-[0-9]+$'
    `;
    const nextSequence = Number(rows[0]?.max_sequence ?? 0) + 1;

    return NextResponse.json({
      data: {
        invoiceReference: formatInvoiceReference(nextSequence),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
