import { prisma } from '@/lib/server/prisma';
import type { TreasuryEventStatus, TreasuryEventType } from '@prisma/client';
import type { TreasuryLifecycleStep } from '@/lib/treasury/events/types';
import { buildTreasuryReconciliationChain } from '@/lib/treasury/reconciliation/engine';
import type {
  ReconciliationChainNode,
  ReconciliationChainStatus,
  TreasuryReconciliationException,
} from '@/lib/treasury/reconciliation/types';
function stepStatusFromEvents(
  events: Array<{ status: TreasuryEventStatus }>,
  required = false
): TreasuryLifecycleStep['status'] {
  if (events.length === 0) {
    return required ? 'UNKNOWN' : 'NOT_APPLICABLE';
  }
  if (events.some((e) => e.status === 'EXCEPTION')) return 'EXCEPTION';
  if (events.every((e) => e.status === 'CONFIRMED')) return 'CONFIRMED';
  if (events.some((e) => e.status === 'INFERRED')) return 'INFERRED';
  return 'UNKNOWN';
}

export type InvoiceTreasuryReconciliation = {
  paymentLinkId: string;
  invoiceReference: string | null;
  chainStatus: ReconciliationChainStatus;
  steps: TreasuryLifecycleStep[];
  nodes: ReconciliationChainNode[];
  exceptions: TreasuryReconciliationException[];
  walletAddress: string | null;
  assetLabel: string | null;
  events: Array<{    id: string;
    eventType: TreasuryEventType;
    status: TreasuryEventStatus;
    asset: string | null;
    amount: string | null;
    provider: string;
    occurredAt: string;
    destinationAddress: string | null;
  }>;
};

export async function buildInvoiceTreasuryReconciliation(
  organizationId: string,
  paymentLinkId: string
): Promise<InvoiceTreasuryReconciliation | null> {
  const link = await prisma.payment_links.findFirst({
    where: { id: paymentLinkId, organization_id: organizationId },
    select: {
      id: true,
      invoice_reference: true,
      short_code: true,
      status: true,
    },
  });

  if (!link) return null;

  const engineChain = await buildTreasuryReconciliationChain(organizationId, paymentLinkId);

  const directEvents = await prisma.treasury_events.findMany({    where: { organization_id: organizationId, payment_link_id: paymentLinkId },
    orderBy: { occurred_at: 'asc' },
  });

  const byType = (type: TreasuryEventType) =>
    directEvents.filter((e) => e.event_type === type);

  const customerPayments = byType('CUSTOMER_PAYMENT');
  const assetReceived = byType('ASSET_RECEIVED');
  const walletTransfers = byType('WALLET_TRANSFER');
  const exchangeDeposits = byType('EXCHANGE_DEPOSIT');
  const conversions = byType('CONVERSION');

  const assetReceivedIds = assetReceived.map((e) => e.id);
  const walletTransferLinks =
    assetReceivedIds.length > 0
      ? await prisma.treasury_event_links.findMany({
          where: {
            organization_id: organizationId,
            source_event_id: { in: assetReceivedIds },
            link_type: 'PARENT_CHILD',
            target_event: { event_type: 'WALLET_TRANSFER' },
          },
          include: {
            target_event: {
              select: {
                id: true,
                status: true,
                asset: true,
                amount: true,
                destination_address: true,
                occurred_at: true,
              },
            },
          },
          orderBy: { created_at: 'asc' },
        })
      : [];

  const linkedWalletTransfer = walletTransferLinks[0]?.target_event ?? walletTransfers[0] ?? null;

  const hasConfirmedPayment = await prisma.payment_events.findFirst({
    where: { payment_link_id: paymentLinkId, event_type: 'PAYMENT_CONFIRMED' },
    select: { id: true },
  });

  const xeroSync = await prisma.xero_syncs.findFirst({
    where: { payment_link_id: paymentLinkId, sync_type: 'PAYMENT', status: 'SUCCESS' },
    select: { id: true },
  });

  const primaryAsset = assetReceived[0] ?? customerPayments[0];
  const walletAddress = assetReceived[0]?.destination_address ?? null;
  const assetLabel = primaryAsset
    ? `${primaryAsset.amount?.toString() ?? ''} ${primaryAsset.asset ?? ''}`.trim()
    : null;

  const fiatCredits = byType('FIAT_CREDIT');
  const bankSettlements = byType('BANK_SETTLEMENT');
  const primaryExchangeDeposit = exchangeDeposits[0] ?? null;
  const primaryConversion = conversions[0] ?? null;
  const audBalanceCredit =
    fiatCredits.find(
      (e) =>
        e.asset === 'AUD' &&
        e.amount != null &&
        !e.amount.toString().startsWith('-') &&
        (e.metadata as Record<string, unknown> | null)?.display_as !== 'fee'
    ) ?? null;
  const audWithdrawal =
    fiatCredits.find(
      (e) =>
        e.asset === 'AUD' &&
        (e.metadata as Record<string, unknown> | null)?.display_as === 'aud_withdrawal'
    ) ?? null;
  const confirmedBankSettlement =
    bankSettlements.find((e) => e.status === 'CONFIRMED') ?? null;

  const hasLaterTreasuryActivity =
    exchangeDeposits.length > 0 || conversions.length > 0 || fiatCredits.length > 0;

  let unknownOutboundMovement = false;
  const primaryAssetReceived = assetReceived[0];
  if (primaryAssetReceived && walletAddress && !linkedWalletTransfer) {
    const unlinkedOutbound = await prisma.treasury_events.findFirst({
      where: {
        organization_id: organizationId,
        event_type: 'WALLET_TRANSFER',
        source_address: walletAddress,
        asset: primaryAssetReceived.asset ?? undefined,
        payment_link_id: null,
        occurred_at: { gte: primaryAssetReceived.occurred_at },
      },
      select: { id: true },
    });
    unknownOutboundMovement = Boolean(unlinkedOutbound);
  }

  function buildExchangeLifecycleSteps(): TreasuryLifecycleStep[] {
    const steps: TreasuryLifecycleStep[] = [];

    if (primaryExchangeDeposit) {
      const depositDetail = primaryExchangeDeposit.amount
        ? `${primaryExchangeDeposit.amount.toString()} ${primaryExchangeDeposit.asset ?? ''}`.trim()
        : undefined;
      steps.push({
        stage: 'exchange_deposit',
        label: primaryExchangeDeposit.asset
          ? `Digital Surge ${primaryExchangeDeposit.asset} deposit`
          : 'Digital Surge deposit',
        status: stepStatusFromEvents([primaryExchangeDeposit], true),
        eventId: primaryExchangeDeposit.id,
        detail: depositDetail,
      });
    } else if (linkedWalletTransfer || unknownOutboundMovement) {
      steps.push({
        stage: 'awaiting_exchange',
        label: 'Awaiting exchange activity',
        status: 'UNKNOWN',
        detail: 'Digital Surge deposit not yet confirmed',
      });
    }

    if (primaryConversion) {
      const rateMeta = (primaryConversion.metadata as Record<string, unknown> | null)
        ?.digital_surge as Record<string, unknown> | undefined;
      const rate =
        primaryConversion.exchange_rate?.toString() ??
        (typeof rateMeta?.exchange_rate === 'string' ? rateMeta.exchange_rate : null);
      steps.push({
        stage: 'conversion',
        label: `${primaryConversion.asset ?? 'Crypto'} → ${primaryConversion.destination_asset ?? 'AUD'}`,
        status: stepStatusFromEvents([primaryConversion], Boolean(primaryExchangeDeposit)),
        eventId: primaryConversion.id,
        detail: rate ? `Rate: ${rate}` : undefined,
      });
    } else if (primaryExchangeDeposit) {
      steps.push({
        stage: 'conversion',
        label: 'Conversion',
        status: 'UNKNOWN',
        detail: 'Awaiting confirmation',
      });
    }

    if (audBalanceCredit) {
      steps.push({
        stage: 'aud_balance',
        label: 'AUD at Digital Surge',
        status: stepStatusFromEvents([audBalanceCredit], Boolean(primaryConversion)),
        eventId: audBalanceCredit.id,
        detail: `${audBalanceCredit.amount?.toString() ?? ''} AUD`.trim(),
      });
    } else if (primaryConversion) {
      steps.push({
        stage: 'aud_balance',
        label: 'AUD balance / awaiting confirmation',
        status: 'UNKNOWN',
        detail: 'AUD held at exchange; bank settlement not confirmed',
      });
    }

    if (audWithdrawal) {
      const dsMeta = (audWithdrawal.metadata as Record<string, unknown> | null)?.digital_surge as
        | Record<string, unknown>
        | undefined;
      const providerStatus =
        typeof dsMeta?.provider_withdrawal_status === 'string'
          ? dsMeta.provider_withdrawal_status
          : null;
      steps.push({
        stage: 'aud_withdrawal',
        label: 'AUD withdrawal',
        status: stepStatusFromEvents([audWithdrawal], false),
        eventId: audWithdrawal.id,
        detail: providerStatus
          ? `${audWithdrawal.amount?.toString() ?? ''} AUD — ${providerStatus}`.trim()
          : `${audWithdrawal.amount?.toString() ?? ''} AUD`.trim(),
      });
    }

    if (confirmedBankSettlement) {
      steps.push({
        stage: 'bank_settlement',
        label: 'Bank settlement',
        status: 'CONFIRMED',
        eventId: confirmedBankSettlement.id,
        detail: confirmedBankSettlement.amount?.toString() ?? undefined,
      });
    } else if (audWithdrawal) {
      steps.push({
        stage: 'awaiting_bank_confirmation',
        label: 'Awaiting bank confirmation',
        status: 'UNKNOWN',
        detail: 'Digital Surge withdrawal observed; bank receipt not confirmed',
      });
    }

    return steps;
  }

  const exchangeLifecycleSteps = buildExchangeLifecycleSteps();

  const sentAssetLabel = linkedWalletTransfer?.asset ?? primaryAsset?.asset ?? 'Asset';

  const steps: TreasuryLifecycleStep[] = [
    {
      stage: 'invoice',
      label: 'Invoice',
      status: 'CONFIRMED',
    },
    {
      stage: 'payment',
      label: 'Customer payment',
      status: hasConfirmedPayment ? 'CONFIRMED' : stepStatusFromEvents(customerPayments, true),
      eventId: customerPayments[0]?.id,
    },
    {
      stage: 'crypto_received',
      label: primaryAsset?.asset ? `${primaryAsset.asset} received` : 'Asset received',
      status: stepStatusFromEvents(assetReceived, Boolean(hasConfirmedPayment)),
      eventId: assetReceived[0]?.id,
      detail: assetLabel ?? undefined,
    },
    ...(walletAddress
      ? [
          {
            stage: 'wallet' as const,
            label: 'Wallet',
            status: 'CONFIRMED' as const,
            detail: walletAddress,
          },
        ]
      : []),
    ...(linkedWalletTransfer
      ? [
          {
            stage: 'wallet_sent' as const,
            label: `${sentAssetLabel} sent`,
            status: stepStatusFromEvents([linkedWalletTransfer], true),
            eventId: linkedWalletTransfer.id,
            detail: linkedWalletTransfer.amount
              ? `${linkedWalletTransfer.amount.toString()} ${linkedWalletTransfer.asset ?? ''}`.trim()
              : undefined,
          },
          ...(linkedWalletTransfer.destination_address
            ? [
                {
                  stage: 'wallet_destination' as const,
                  label: 'Destination wallet',
                  status: 'CONFIRMED' as const,
                  detail: linkedWalletTransfer.destination_address,
                },
              ]
            : []),
          ...exchangeLifecycleSteps,
        ]
      : unknownOutboundMovement
        ? [
            {
              stage: 'unknown_wallet_movement' as const,
              label: 'Unknown wallet movement — review required',
              status: 'UNKNOWN' as const,
              detail: 'Outbound transfer observed without deterministic invoice link',
            },
            ...exchangeLifecycleSteps,
          ]
        : exchangeLifecycleSteps.length > 0
          ? exchangeLifecycleSteps
          : [
              {
                stage: 'awaiting_treasury',
                label: 'Awaiting treasury activity',
                status: hasLaterTreasuryActivity ? 'INFERRED' : 'UNKNOWN',
                detail: hasLaterTreasuryActivity
                  ? 'Downstream treasury events detected'
                  : 'Not converted, moved, or reconciled',
              },
            ]),
    {
      stage: 'xero',
      label: 'Xero',
      status: xeroSync ? 'CONFIRMED' : 'UNKNOWN',
    },
  ];

  return {
    paymentLinkId,
    invoiceReference: link.invoice_reference ?? link.short_code,
    chainStatus: engineChain?.chainStatus ?? 'PARTIAL',
    steps,
    nodes: engineChain?.nodes ?? [],
    exceptions: engineChain?.exceptions ?? [],
    walletAddress,
    assetLabel,
    events: directEvents.map((e) => ({      id: e.id,
      eventType: e.event_type,
      status: e.status,
      asset: e.asset,
      amount: e.amount?.toString() ?? null,
      provider: e.provider,
      occurredAt: e.occurred_at.toISOString(),
      destinationAddress: e.destination_address,
    })),
  };
}

import type { TreasuryActivityFilter } from '@/lib/treasury/reconciliation/types';

function matchesActivityFilter(
  row: {
    status: string;
    eventType: string;
    metadata?: unknown;
  },
  filter: TreasuryActivityFilter
): boolean {
  if (filter === 'all') return true;
  if (filter === 'unknown') return row.status === 'UNKNOWN';
  if (filter === 'exceptions') return row.status === 'EXCEPTION';
  if (filter === 'needs_review') {
    return row.status === 'UNKNOWN' || row.status === 'INFERRED' || row.status === 'EXCEPTION';
  }
  if (filter === 'awaiting_bank') {
    return (
      (row.metadata as Record<string, unknown> | null)?.display_as === 'aud_withdrawal'
    );
  }
  if (filter === 'ambiguous') {
    return row.status === 'UNKNOWN' && row.eventType === 'EXCHANGE_DEPOSIT';
  }
  return true;
}

export async function listTreasuryActivity(
  organizationId: string,
  options?: { limit?: number; paymentLinkId?: string; filter?: TreasuryActivityFilter }
) {  const rows = await prisma.treasury_events.findMany({
    where: {
      organization_id: organizationId,
      ...(options?.paymentLinkId ? { payment_link_id: options.paymentLinkId } : {}),
    },
    orderBy: { occurred_at: 'desc' },
    take: options?.filter && options.filter !== 'all' ? 500 : (options?.limit ?? 100),
    include: {
      payment_links: {
        select: { invoice_reference: true, short_code: true },
      },
    },
  });

  const filtered = rows
    .map((row) => ({
      id: row.id,
      occurredAt: row.occurred_at.toISOString(),
      eventType: row.event_type,
      asset: row.asset,
      destinationAsset: row.destination_asset,
      amount: row.amount?.toString() ?? null,
      destinationAmount: row.destination_amount?.toString() ?? null,
      provider: row.provider,
      status: row.status,
      metadata: row.metadata,
      invoiceReference:
        row.payment_links?.invoice_reference ?? row.payment_links?.short_code ?? null,
      paymentLinkId: row.payment_link_id,
    }))
    .filter((row) => matchesActivityFilter(row, options?.filter ?? 'all'))
    .slice(0, options?.limit ?? 100);

  return filtered;
}