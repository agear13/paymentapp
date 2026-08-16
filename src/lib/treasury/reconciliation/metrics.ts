import { prisma } from '@/lib/server/prisma';
import { buildTreasuryReconciliationChain, listInvoiceReconciliationSummaries } from '@/lib/treasury/reconciliation/engine';
import type { TreasuryReconciliationMetrics } from '@/lib/treasury/reconciliation/types';

function parseAmount(value: string | null | undefined): number {
  if (!value) return 0;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

export async function computeTreasuryReconciliationMetrics(
  organizationId: string
): Promise<TreasuryReconciliationMetrics> {
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

  let totalCryptoReceived = 0;
  let totalCryptoTransferred = 0;
  let totalExchangeDeposits = 0;
  let totalConvertedToFiatAud = 0;
  let audAwaitingWithdrawal = 0;
  let audAwaitingBankConfirmation = 0;
  let unknownEvents = 0;

  const cryptoAssets = new Set(['USDC', 'USDT', 'HBAR', 'AUDD']);

  for (const event of events) {
    if (event.status === 'UNKNOWN') unknownEvents += 1;

    const meta = event.metadata as Record<string, unknown> | null;
    const amount = parseAmount(event.amount?.toString());

    if (event.event_type === 'ASSET_RECEIVED' && cryptoAssets.has(event.asset ?? '')) {
      totalCryptoReceived += amount;
    }
    if (event.event_type === 'WALLET_TRANSFER' && cryptoAssets.has(event.asset ?? '')) {
      totalCryptoTransferred += amount;
    }
    if (event.event_type === 'EXCHANGE_DEPOSIT' && cryptoAssets.has(event.asset ?? '')) {
      totalExchangeDeposits += amount;
    }
    if (event.event_type === 'CONVERSION' && event.destination_amount) {
      totalConvertedToFiatAud += parseAmount(event.destination_amount.toString());
    }
    if (
      event.event_type === 'FIAT_CREDIT' &&
      meta?.display_as === 'aud_balance_credit' &&
      event.asset === 'AUD'
    ) {
      audAwaitingWithdrawal += amount;
    }
    if (
      event.event_type === 'FIAT_CREDIT' &&
      meta?.display_as === 'aud_withdrawal' &&
      event.asset === 'AUD'
    ) {
      audAwaitingBankConfirmation += amount;
    }
  }

  const summaries = await listInvoiceReconciliationSummaries(organizationId);
  const fullyReconciledChains = summaries.filter((s) => s.chainStatus === 'RECONCILED').length;
  const partialChains = summaries.filter(
    (s) => s.chainStatus === 'PARTIAL' || s.chainStatus.startsWith('AWAITING')
  ).length;
  const exceptionsRequiringReview = summaries.reduce((sum, s) => sum + s.exceptionCount, 0);

  return {
    totalCryptoReceived,
    totalCryptoTransferred,
    totalExchangeDeposits,
    totalConvertedToFiatAud,
    audAwaitingWithdrawal,
    audAwaitingBankConfirmation,
    fullyReconciledChains,
    exceptionsRequiringReview,
    partialChains,
    unknownEvents,
  };
}

export async function getPaymentLinkChainStatus(
  organizationId: string,
  paymentLinkId: string
) {
  const chain = await buildTreasuryReconciliationChain(organizationId, paymentLinkId);
  return chain?.chainStatus ?? null;
}
