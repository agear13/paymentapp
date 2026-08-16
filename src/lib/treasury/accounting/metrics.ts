import { prisma } from '@/lib/server/prisma';
import { listInvoiceReconciliationSummaries } from '@/lib/treasury/reconciliation/engine';
import type { TreasuryAccountingMetrics } from '@/lib/treasury/accounting/types';

function parseAmount(value: string | null | undefined): number {
  if (!value) return 0;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

export async function computeTreasuryAccountingMetrics(
  organizationId: string
): Promise<TreasuryAccountingMetrics> {
  const events = await prisma.treasury_events.findMany({
    where: { organization_id: organizationId },
    select: {
      event_type: true,
      status: true,
      asset: true,
      amount: true,
      destination_amount: true,
      metadata: true,
      payment_link_id: true,
    },
  });

  const cryptoAssets = new Set(['USDC', 'USDT', 'HBAR', 'AUDD']);
  let cryptoAwaitingConversion = 0;
  let audAtExchange = 0;
  let audAwaitingBankConfirmation = 0;
  let exchangeFeesTotal = 0;

  const linksWithAssetReceived = new Set<string>();
  const linksWithExchangeDeposit = new Set<string>();
  const linksWithConversion = new Set<string>();

  for (const event of events) {
    const meta = event.metadata as Record<string, unknown> | null;
    const amount = parseAmount(event.amount?.toString());

    if (event.event_type === 'ASSET_RECEIVED' && event.payment_link_id) {
      linksWithAssetReceived.add(event.payment_link_id);
      if (cryptoAssets.has(event.asset ?? '')) {
        cryptoAwaitingConversion += amount;
      }
    }
    if (event.event_type === 'EXCHANGE_DEPOSIT' && event.payment_link_id) {
      linksWithExchangeDeposit.add(event.payment_link_id);
    }
    if (event.event_type === 'CONVERSION' && event.payment_link_id) {
      linksWithConversion.add(event.payment_link_id);
    }
    if (
      event.event_type === 'FIAT_CREDIT' &&
      meta?.display_as === 'aud_balance_credit' &&
      event.asset === 'AUD'
    ) {
      audAtExchange += amount;
    }
    if (
      event.event_type === 'FIAT_CREDIT' &&
      meta?.display_as === 'aud_withdrawal' &&
      event.asset === 'AUD'
    ) {
      audAwaitingBankConfirmation += amount;
    }
    if (meta?.display_as === 'fee') {
      exchangeFeesTotal += amount;
    }
  }

  for (const linkId of linksWithConversion) {
    if (linksWithAssetReceived.has(linkId)) {
      const received = events
        .filter(
          (e) =>
            e.payment_link_id === linkId &&
            e.event_type === 'ASSET_RECEIVED' &&
            cryptoAssets.has(e.asset ?? '')
        )
        .reduce((sum, e) => sum + parseAmount(e.amount?.toString()), 0);
      cryptoAwaitingConversion = Math.max(0, cryptoAwaitingConversion - received);
    }
  }

  const paymentsNotAtExchange = [...linksWithAssetReceived].filter(
    (id) => !linksWithExchangeDeposit.has(id)
  ).length;

  const unreconciledConversions = [...linksWithConversion].filter((id) => {
    const chainEvents = events.filter((e) => e.payment_link_id === id);
    return !chainEvents.some(
      (e) => e.event_type === 'BANK_SETTLEMENT' && e.status === 'CONFIRMED'
    );
  }).length;

  const summaries = await listInvoiceReconciliationSummaries(organizationId);
  const fullyReconciledChains = summaries.filter((s) => s.chainStatus === 'RECONCILED').length;
  const itemsRequiringAccountantReview = summaries.reduce(
    (sum, s) => sum + s.exceptionCount,
    0
  );

  return {
    cryptoAwaitingConversion,
    paymentsNotAtExchange,
    unreconciledConversions,
    audAtExchange,
    audAwaitingBankConfirmation,
    exchangeFeesTotal,
    itemsRequiringAccountantReview,
    fullyReconciledChains,
  };
}
