import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const querySchema = z.object({
  organizationId: z.string().uuid(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * GET /api/reports/revenue-summary
 * 
 * Returns revenue summary with breakdown by:
 * - Stripe
 * - Hedera - HBAR
 * - Hedera - USDC
 * - Hedera - USDT
 * - Hedera - AUDD
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    // Get all confirmed payments
    const payments = await prisma.payment_links.findMany({
      where: {
        organization_id: organizationId,
        status: 'CONFIRMED',
        ...(Object.keys(dateFilter).length > 0 && {
          updated_at: dateFilter,
        }),
      },
      include: {
        payment_events: {
          where: {
            event_type: 'PAYMENT_CONFIRMED',
          },
        },
      },
    });

    // Initialize counters
    const summary = {
      totalRevenue: 0,
      totalPayments: payments.length,
      breakdown: {
        stripe: {
          count: 0,
          revenue: 0,
          percentage: 0,
        },
        hedera_hbar: {
          count: 0,
          revenue: 0,
          percentage: 0,
        },
        hedera_usdc: {
          count: 0,
          revenue: 0,
          percentage: 0,
        },
        hedera_usdt: {
          count: 0,
          revenue: 0,
          percentage: 0,
        },
        hedera_audd: {
          count: 0,
          revenue: 0,
          percentage: 0,
        },
      },
    };

    // Process each payment
    for (const payment of payments) {
      const paymentEvent = payment.payment_events[0];
      if (!paymentEvent) continue;

      const amount = parseFloat(payment.amount.toString());
      summary.totalRevenue += amount;

      const method = paymentEvent.payment_method;

      if (method === 'STRIPE') {
        summary.breakdown.stripe.count++;
        summary.breakdown.stripe.revenue += amount;
      } else if (method === 'HEDERA') {
        // Determine token type from metadata or currency
        const metadata = paymentEvent.metadata as any;
        const tokenType = metadata?.tokenType || metadata?.token_type;

        if (tokenType === 'HBAR') {
          summary.breakdown.hedera_hbar.count++;
          summary.breakdown.hedera_hbar.revenue += amount;
        } else if (tokenType === 'USDC') {
          summary.breakdown.hedera_usdc.count++;
          summary.breakdown.hedera_usdc.revenue += amount;
        } else if (tokenType === 'USDT') {
          summary.breakdown.hedera_usdt.count++;
          summary.breakdown.hedera_usdt.revenue += amount;
        } else if (tokenType === 'AUDD') {
          summary.breakdown.hedera_audd.count++;
          summary.breakdown.hedera_audd.revenue += amount;
        }
      }
    }

    // Calculate percentages
    if (summary.totalRevenue > 0) {
      summary.breakdown.stripe.percentage =
        (summary.breakdown.stripe.revenue / summary.totalRevenue) * 100;
      summary.breakdown.hedera_hbar.percentage =
        (summary.breakdown.hedera_hbar.revenue / summary.totalRevenue) * 100;
      summary.breakdown.hedera_usdc.percentage =
        (summary.breakdown.hedera_usdc.revenue / summary.totalRevenue) * 100;
      summary.breakdown.hedera_usdt.percentage =
        (summary.breakdown.hedera_usdt.revenue / summary.totalRevenue) * 100;
      summary.breakdown.hedera_audd.percentage =
        (summary.breakdown.hedera_audd.revenue / summary.totalRevenue) * 100;
    }

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error('[Revenue Summary] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue summary' },
      { status: 500 }
    );
  }
}







