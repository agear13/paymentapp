import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * GET /api/reports/reconciliation
 * 
 * Returns reconciliation report comparing:
 * - Expected balances (from payment links)
 * - Actual balances (from ledger entries)
 * 
 * Includes all payment methods:
 * - Stripe
 * - Hedera HBAR, USDC, USDT, AUDD
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // Get all confirmed payments
    const confirmedPayments = await prisma.payment_links.findMany({
      where: {
        organization_id: organizationId,
        status: 'CONFIRMED',
      },
      include: {
        payment_events: {
          where: {
            event_type: 'PAYMENT_CONFIRMED',
          },
        },
        ledger_entries: true,
      },
    });

    // Initialize reconciliation report
    const report = {
      stripe: {
        expectedRevenue: 0,
        ledgerBalance: 0,
        difference: 0,
        paymentCount: 0,
      },
      hedera_hbar: {
        expectedRevenue: 0,
        ledgerBalance: 0,
        difference: 0,
        paymentCount: 0,
      },
      hedera_usdc: {
        expectedRevenue: 0,
        ledgerBalance: 0,
        difference: 0,
        paymentCount: 0,
      },
      hedera_usdt: {
        expectedRevenue: 0,
        ledgerBalance: 0,
        difference: 0,
        paymentCount: 0,
      },
      hedera_audd: {
        expectedRevenue: 0,
        ledgerBalance: 0,
        difference: 0,
        paymentCount: 0,
      },
    };

    // Get ledger accounts
    const accounts = await prisma.ledger_accounts.findMany({
      where: {
        organization_id: organizationId,
        code: {
          in: ['1050', '1051', '1052', '1053', '1054'],
        },
      },
      include: {
        ledger_entries: true,
      },
    });

    // Calculate ledger balances
    const accountBalances: Record<string, number> = {};
    for (const account of accounts) {
      let balance = 0;
      for (const entry of account.ledger_entries) {
        const amount = parseFloat(entry.amount.toString());
        if (entry.entry_type === 'DEBIT') {
          balance += amount;
        } else {
          balance -= amount;
        }
      }
      accountBalances[account.code] = balance;
    }

    // Process payments and calculate expected revenue
    for (const payment of confirmedPayments) {
      const paymentEvent = payment.payment_events[0];
      if (!paymentEvent) continue;

      const amount = parseFloat(payment.amount.toString());
      const method = paymentEvent.payment_method;

      if (method === 'STRIPE') {
        report.stripe.expectedRevenue += amount;
        report.stripe.paymentCount++;
      } else if (method === 'HEDERA') {
        const metadata = paymentEvent.metadata as any;
        const tokenType = metadata?.tokenType || metadata?.token_type;

        if (tokenType === 'HBAR') {
          report.hedera_hbar.expectedRevenue += amount;
          report.hedera_hbar.paymentCount++;
        } else if (tokenType === 'USDC') {
          report.hedera_usdc.expectedRevenue += amount;
          report.hedera_usdc.paymentCount++;
        } else if (tokenType === 'USDT') {
          report.hedera_usdt.expectedRevenue += amount;
          report.hedera_usdt.paymentCount++;
        } else if (tokenType === 'AUDD') {
          report.hedera_audd.expectedRevenue += amount;
          report.hedera_audd.paymentCount++;
        }
      }
    }

    // Set ledger balances from clearing accounts
    report.stripe.ledgerBalance = accountBalances['1050'] || 0;
    report.hedera_hbar.ledgerBalance = accountBalances['1051'] || 0;
    report.hedera_usdc.ledgerBalance = accountBalances['1052'] || 0;
    report.hedera_usdt.ledgerBalance = accountBalances['1053'] || 0;
    report.hedera_audd.ledgerBalance = accountBalances['1054'] || 0;

    // Calculate differences
    report.stripe.difference = report.stripe.expectedRevenue - report.stripe.ledgerBalance;
    report.hedera_hbar.difference =
      report.hedera_hbar.expectedRevenue - report.hedera_hbar.ledgerBalance;
    report.hedera_usdc.difference =
      report.hedera_usdc.expectedRevenue - report.hedera_usdc.ledgerBalance;
    report.hedera_usdt.difference =
      report.hedera_usdt.expectedRevenue - report.hedera_usdt.ledgerBalance;
    report.hedera_audd.difference =
      report.hedera_audd.expectedRevenue - report.hedera_audd.ledgerBalance;

    // Calculate overall status
    const totalDifference =
      Math.abs(report.stripe.difference) +
      Math.abs(report.hedera_hbar.difference) +
      Math.abs(report.hedera_usdc.difference) +
      Math.abs(report.hedera_usdt.difference) +
      Math.abs(report.hedera_audd.difference);

    const isReconciled = totalDifference < 0.01; // Allow for rounding errors

    return NextResponse.json({
      report,
      isReconciled,
      totalDifference,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Reconciliation] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate reconciliation report' },
      { status: 500 }
    );
  }
}







