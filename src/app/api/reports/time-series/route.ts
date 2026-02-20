import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/server/prisma';

/**
 * GET /api/reports/time-series
 * 
 * Returns time-series revenue data with token breakdown
 * Includes all 4 Hedera tokens: HBAR, USDC, USDT, AUDD
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
    const interval = searchParams.get('interval') || 'day'; // day, week, month

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
    } else {
      // Default to last 30 days
      dateFilter.gte = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    // Get all paid payment links
    const payments = await prisma.payment_links.findMany({
      where: {
        organization_id: organizationId,
        status: 'PAID',
        updated_at: dateFilter,
      },
      include: {
        payment_events: {
          where: {
            event_type: 'PAYMENT_CONFIRMED',
          },
        },
      },
      orderBy: {
        updated_at: 'asc',
      },
    });

    // Group by time interval
    const grouped = new Map<string, any>();

    for (const payment of payments) {
      const paymentEvent = payment.payment_events[0];
      if (!paymentEvent) continue;

      const date = new Date(payment.updated_at);
      let key: string;

      // Format date based on interval
      if (interval === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (interval === 'week') {
        const weekNum = Math.ceil((date.getDate() - date.getDay() + 1) / 7);
        key = `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      } else {
        // day
        key = date.toISOString().split('T')[0];
      }

      // Initialize if not exists
      if (!grouped.has(key)) {
        grouped.set(key, {
          date: key,
          total: 0,
          stripe: 0,
          hedera_hbar: 0,
          hedera_usdc: 0,
          hedera_usdt: 0,
          hedera_audd: 0,
          count: 0,
        });
      }

      const entry = grouped.get(key)!;
      const amount = parseFloat(payment.amount.toString());
      entry.total += amount;
      entry.count++;

      const method = paymentEvent.payment_method;

      if (method === 'STRIPE') {
        entry.stripe += amount;
      } else if (method === 'HEDERA') {
        const metadata = paymentEvent.metadata as any;
        const tokenType = metadata?.tokenType || metadata?.token_type;

        if (tokenType === 'HBAR') {
          entry.hedera_hbar += amount;
        } else if (tokenType === 'USDC') {
          entry.hedera_usdc += amount;
        } else if (tokenType === 'USDT') {
          entry.hedera_usdt += amount;
        } else if (tokenType === 'AUDD') {
          entry.hedera_audd += amount;
        }
      }
    }

    // Convert to array and sort
    const series = Array.from(grouped.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return NextResponse.json({
      series,
      interval,
      startDate: dateFilter.gte.toISOString(),
      endDate: dateFilter.lte ? dateFilter.lte.toISOString() : new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Time Series] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch time series data' },
      { status: 500 }
    );
  }
}







