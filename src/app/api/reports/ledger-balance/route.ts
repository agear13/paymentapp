import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * GET /api/reports/ledger-balance
 * 
 * Returns ledger account balances with breakdown by clearing account
 * Shows balances for all 5 clearing accounts:
 * - Stripe (1050)
 * - Hedera HBAR (1051)
 * - Hedera USDC (1052)
 * - Hedera USDT (1053)
 * - Hedera AUDD (1054)
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

    // Get all ledger accounts
    const accounts = await prisma.ledger_accounts.findMany({
      where: {
        organization_id: organizationId,
      },
      include: {
        ledger_entries: true,
      },
      orderBy: {
        code: 'asc',
      },
    });

    // Calculate balances for each account
    const balances = accounts.map((account) => {
      let balance = 0;

      for (const entry of account.ledger_entries) {
        const amount = parseFloat(entry.amount.toString());
        if (entry.entry_type === 'DEBIT') {
          // Assets increase with debits
          if (
            account.account_type === 'ASSET' ||
            account.account_type === 'EXPENSE'
          ) {
            balance += amount;
          } else {
            balance -= amount;
          }
        } else {
          // CREDIT
          // Assets decrease with credits
          if (
            account.account_type === 'ASSET' ||
            account.account_type === 'EXPENSE'
          ) {
            balance -= amount;
          } else {
            balance += amount;
          }
        }
      }

      return {
        code: account.code,
        name: account.name,
        accountType: account.account_type,
        balance: balance,
        entryCount: account.ledger_entries.length,
      };
    });

    // Separate clearing accounts for reporting
    const clearingAccounts = balances.filter((b) =>
      ['1050', '1051', '1052', '1053', '1054'].includes(b.code)
    );

    const otherAccounts = balances.filter(
      (b) => !['1050', '1051', '1052', '1053', '1054'].includes(b.code)
    );

    return NextResponse.json({
      clearingAccounts: {
        stripe: clearingAccounts.find((a) => a.code === '1050') || null,
        hedera_hbar: clearingAccounts.find((a) => a.code === '1051') || null,
        hedera_usdc: clearingAccounts.find((a) => a.code === '1052') || null,
        hedera_usdt: clearingAccounts.find((a) => a.code === '1053') || null,
        hedera_audd: clearingAccounts.find((a) => a.code === '1054') || null,
      },
      otherAccounts,
      allAccounts: balances,
    });
  } catch (error: any) {
    console.error('[Ledger Balance] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ledger balances' },
      { status: 500 }
    );
  }
}







