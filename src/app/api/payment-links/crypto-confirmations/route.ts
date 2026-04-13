/**
 * GET /api/payment-links/crypto-confirmations?organizationId=
 * Recent assisted crypto submissions (PAID_UNVERIFIED / REQUIRES_REVIEW) for the merchant dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { applyRateLimit } from '@/lib/rate-limit';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';

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

    const canView = await checkUserPermission(user.id, organizationId, 'view_payment_links');
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rows = await prisma.crypto_payment_confirmations.findMany({
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
            crypto_network: true,
            crypto_address: true,
            crypto_currency: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    const data = rows.map((r) => ({
      id: r.id,
      status: r.status,
      payerNetwork: r.payer_network,
      payerAmountSent: r.payer_amount_sent,
      payerWalletAddress: r.payer_wallet_address,
      payerCurrency: r.payer_currency,
      payerTxHash: r.payer_tx_hash,
      verificationStatus: r.verification_status,
      matchConfidence: r.match_confidence,
      verificationIssues: Array.isArray(r.verification_issues)
        ? (r.verification_issues as string[])
        : [],
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
        cryptoNetwork: r.payment_links.crypto_network,
        cryptoAddress: r.payment_links.crypto_address,
        cryptoCurrency: r.payment_links.crypto_currency,
      },
    }));

    return NextResponse.json({ data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    loggers.api.error({ error: message }, 'GET crypto-confirmations failed');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
