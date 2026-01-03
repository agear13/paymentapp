import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/server/prisma';

/**
 * GET /api/reports/export
 * 
 * Exports payment data as CSV
 * Includes token type breakdown for all Hedera tokens
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

    // Get all payments
    const payments = await prisma.payment_links.findMany({
      where: {
        organization_id: organizationId,
        ...(Object.keys(dateFilter).length > 0 && {
          created_at: dateFilter,
        }),
      },
      include: {
        payment_events: {
          where: {
            event_type: 'PAYMENT_CONFIRMED',
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Generate CSV
    const csvHeaders = [
      'Date',
      'Short Code',
      'Status',
      'Amount',
      'Currency',
      'Payment Method',
      'Token Type',
      'Description',
      'Invoice Reference',
      'Customer Email',
    ];

    const csvRows = payments.map((payment) => {
      const paymentEvent = payment.payment_events[0];
      const method = paymentEvent?.payment_method || 'N/A';
      
      let tokenType = 'N/A';
      if (method === 'HEDERA' && paymentEvent) {
        const metadata = paymentEvent.metadata as any;
        tokenType = metadata?.tokenType || metadata?.token_type || 'N/A';
      } else if (method === 'STRIPE') {
        tokenType = 'STRIPE';
      }

      return [
        new Date(payment.created_at).toISOString().split('T')[0],
        payment.short_code,
        payment.status,
        payment.amount.toString(),
        payment.currency,
        method,
        tokenType,
        payment.description.replace(/"/g, '""'), // Escape quotes
        payment.invoice_reference || '',
        payment.customer_email || '',
      ];
    });

    // Format as CSV
    const csv = [
      csvHeaders.join(','),
      ...csvRows.map((row) =>
        row.map((cell) => `"${cell}"`).join(',')
      ),
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="payments-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('[Export] Error:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}







