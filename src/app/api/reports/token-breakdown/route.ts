import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/server/prisma';

/**
 * GET /api/reports/token-breakdown
 * 
 * Returns payment breakdown by token type:
 * - Stripe
 * - Hedera - HBAR
 * - Hedera - USDC
 * - Hedera - USDT
 * - Hedera - AUDD ← CRITICAL: Must be included
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Get all confirmed payments with their events
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

    // Initialize token breakdown with all supported tokens
    const breakdown = [
      {
        label: 'Stripe',
        value: 0,
        count: 0,
        revenue: 0,
        color: '#635BFF', // Stripe brand color
      },
      {
        label: 'Hedera - HBAR',
        value: 0,
        count: 0,
        revenue: 0,
        color: '#82A4F8', // Hedera blue
      },
      {
        label: 'Hedera - USDC',
        value: 0,
        count: 0,
        revenue: 0,
        color: '#2775CA', // USDC blue
      },
      {
        label: 'Hedera - USDT',
        value: 0,
        count: 0,
        revenue: 0,
        color: '#26A17B', // USDT green
      },
      {
        label: 'Hedera - AUDD',
        value: 0,
        count: 0,
        revenue: 0,
        color: '#00843D', // Australian green
      },
    ];

    let totalRevenue = 0;

    // Process each payment
    for (const payment of payments) {
      const paymentEvent = payment.payment_events[0];
      if (!paymentEvent) continue;

      const amount = parseFloat(payment.amount.toString());
      totalRevenue += amount;

      const method = paymentEvent.payment_method;

      if (method === 'STRIPE') {
        breakdown[0].count++;
        breakdown[0].revenue += amount;
      } else if (method === 'HEDERA') {
        const metadata = paymentEvent.metadata as any;
        const tokenType = metadata?.tokenType || metadata?.token_type;

        if (tokenType === 'HBAR') {
          breakdown[1].count++;
          breakdown[1].revenue += amount;
        } else if (tokenType === 'USDC') {
          breakdown[2].count++;
          breakdown[2].revenue += amount;
        } else if (tokenType === 'USDT') {
          breakdown[3].count++;
          breakdown[3].revenue += amount;
        } else if (tokenType === 'AUDD') {
          breakdown[4].count++;
          breakdown[4].revenue += amount;
        }
      }
    }

    // Calculate percentages
    breakdown.forEach((item) => {
      item.value = totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0;
    });

    return NextResponse.json({
      breakdown,
      totalRevenue,
      totalPayments: payments.length,
    });
  } catch (error: any) {
    console.error('[Token Breakdown] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token breakdown' },
      { status: 500 }
    );
  }
}







