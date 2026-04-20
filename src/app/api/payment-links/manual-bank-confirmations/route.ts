/**
 * GET /api/payment-links/manual-bank-confirmations?organizationId=
 * Recent payer-submitted manual bank confirmations for merchant dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { applyRateLimit } from '@/lib/rate-limit';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    if (!UUID_RE.test(organizationId)) {
      return NextResponse.json({ data: [] });
    }

    const canView = await checkUserPermission(user.id, organizationId, 'view_payment_links');
    if (!canView) {
      return NextResponse.json({ data: [] });
    }

    const rows = await prisma.manual_bank_payment_confirmations.findMany({
      where: {
        status: 'SUBMITTED',
        payment_links: {
          organization_id: organizationId,
          status: { in: ['PAID_UNVERIFIED', 'REQUIRES_REVIEW'] },
        },
      },
      include: {
        payment_links: {
          select: {
            id: true,
            short_code: true,
            description: true,
            amount: true,
            currency: true,
            status: true,
            invoice_reference: true,
            manual_bank_destination_type: true,
            manual_bank_recipient_name: true,
            manual_bank_currency: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    const data = rows.map((r) => ({
      id: r.id,
      status: r.status,
      payerAmountSent: r.payer_amount_sent,
      payerCurrency: r.payer_currency,
      payerDestination: r.payer_destination,
      payerPaymentMethodUsed: r.payer_payment_method_used,
      payerReference: r.payer_reference,
      payerProofDetails: r.payer_proof_details,
      payerNote: r.payer_note,
      verificationStatus: r.verification_status,
      matchConfidence: r.match_confidence,
      verificationIssues: Array.isArray(r.verification_issues) ? (r.verification_issues as string[]) : [],
      merchantInvestigationFlag: r.merchant_investigation_flag,
      merchantAcknowledgedAt: r.merchant_acknowledged_at,
      createdAt: r.created_at,
      paymentLink: {
        id: r.payment_links.id,
        shortCode: r.payment_links.short_code,
        description: r.payment_links.description,
        amount: Number(r.payment_links.amount),
        currency: r.payment_links.currency,
        status: r.payment_links.status,
        invoiceReference: r.payment_links.invoice_reference,
        destinationType: r.payment_links.manual_bank_destination_type,
        recipientName: r.payment_links.manual_bank_recipient_name,
        paymentCurrency: r.payment_links.manual_bank_currency,
      },
    }));

    return NextResponse.json({ data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    loggers.api.error({ error: message }, 'GET manual-bank-confirmations failed');
    return NextResponse.json({ data: [] });
  }
}

