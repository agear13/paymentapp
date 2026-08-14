import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import { getProvvyLocalNextInvoiceReference } from '@/lib/payment-links/invoice-reference';
import { buildNextInvoiceReferencePayload } from '@/lib/payment-links/next-invoice-reference-response';
import { suggestNextXeroInvoiceNumberForOrg } from '@/lib/xero/xero-invoice-number-suggestion.server';

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

    const xeroSuggestion = await suggestNextXeroInvoiceNumberForOrg(organizationId);
    const provvyReference = await getProvvyLocalNextInvoiceReference(organizationId, prisma);

    return NextResponse.json({
      data: buildNextInvoiceReferencePayload(xeroSuggestion, provvyReference),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
