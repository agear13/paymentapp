import { prisma } from '@/lib/server/prisma';
import type { TreasuryEventStatus, TreasuryEventType } from '@prisma/client';
import {
  detectReconciliationExceptions,
  deriveChainStatus,
} from '@/lib/treasury/reconciliation/exceptions';
import {
  evidenceFromLink,
  findLinkBetween,
  type TreasuryEventSnapshot,
  type TreasuryLinkSnapshot,
} from '@/lib/treasury/reconciliation/matching';
import type {
  LinkEvidence,
  ReconciliationChainNode,
  TreasuryReconciliationChain,
} from '@/lib/treasury/reconciliation/types';
import { getDigitalSurgeSyncMetadata } from '@/lib/treasury/integration/connection-service';

function eventToSnapshot(event: {
  id: string;
  organization_id: string;
  event_type: string;
  status: TreasuryEventStatus;
  transaction_hash: string | null;
  provider_reference: string;
  payment_link_id: string | null;
  source_address: string | null;
  destination_address: string | null;
  amount: { toString(): string } | null;
  destination_amount: { toString(): string } | null;
  destination_asset: string | null;
  exchange_rate: { toString(): string } | null;
  fee_amount: { toString(): string } | null;
  asset: string | null;
  provider: string;
  occurred_at: Date;
  metadata: unknown;
}): TreasuryEventSnapshot & {
  destination_amount: { toString(): string } | null;
  destination_asset: string | null;
  exchange_rate: { toString(): string } | null;
  fee_amount: { toString(): string } | null;
  provider: string;
  occurred_at: Date;
} {
  return event;
}

function isAudWithdrawal(meta: unknown): boolean {
  return (meta as Record<string, unknown> | null)?.display_as === 'aud_withdrawal';
}

function isAudBalanceCredit(meta: unknown): boolean {
  return (meta as Record<string, unknown> | null)?.display_as === 'aud_balance_credit';
}

function buildNode(
  event: ReturnType<typeof eventToSnapshot>,
  stage: string,
  label: string,
  evidence: LinkEvidence | null
): ReconciliationChainNode {
  return {
    stage,
    eventType: event.event_type as TreasuryEventType,
    label,
    eventId: event.id,
    status: event.status,
    asset: event.asset,
    destinationAsset: event.destination_asset,
    amount: event.amount?.toString() ?? null,
    destinationAmount: event.destination_amount?.toString() ?? null,
    feeAmount: event.fee_amount?.toString() ?? null,
    exchangeRate: event.exchange_rate?.toString() ?? null,
    provider: event.provider,
    occurredAt: event.occurred_at.toISOString(),
    transactionReference: event.transaction_hash,
    providerReference: event.provider_reference,
    destinationAddress: event.destination_address,
    evidence,
  };
}

function walletNode(walletAddress: string): ReconciliationChainNode {
  return {
    stage: 'wallet',
    eventType: 'WALLET',
    label: 'Wallet',
    status: 'CONFIRMED',
    asset: null,
    amount: null,
    provider: null,
    occurredAt: null,
    transactionReference: null,
    providerReference: null,
    destinationAddress: walletAddress,
    evidence: null,
  };
}

function readKnownDepositAddresses(metadata: Record<string, unknown> | null): Set<string> {
  const raw = metadata?.deposit_addresses;
  const addresses = new Set<string>();
  if (!raw || typeof raw !== 'object') return addresses;
  for (const value of Object.values(raw as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      for (const addr of value) {
        if (typeof addr === 'string' && addr.trim()) {
          addresses.add(addr.trim().toLowerCase());
        }
      }
    }
  }
  return addresses;
}

export async function buildTreasuryReconciliationChain(
  organizationId: string,
  paymentLinkId: string
): Promise<TreasuryReconciliationChain | null> {
  const link = await prisma.payment_links.findFirst({
    where: { id: paymentLinkId, organization_id: organizationId },
    select: { id: true, invoice_reference: true, short_code: true },
  });
  if (!link) return null;

  const events = await prisma.treasury_events.findMany({
    where: { organization_id: organizationId, payment_link_id: paymentLinkId },
    orderBy: { occurred_at: 'asc' },
  });

  const eventIds = events.map((e) => e.id);
  const links: TreasuryLinkSnapshot[] =
    eventIds.length > 0
      ? await prisma.treasury_event_links.findMany({
          where: {
            organization_id: organizationId,
            OR: [
              { source_event_id: { in: eventIds } },
              { target_event_id: { in: eventIds } },
            ],
          },
        })
      : [];

  const snapshots = events.map(eventToSnapshot);
  const byType = (type: TreasuryEventType | string) =>
    snapshots.filter((e) => e.event_type === type);

  const customerPayment = byType('CUSTOMER_PAYMENT')[0];
  const assetReceived = byType('ASSET_RECEIVED')[0];
  const walletTransfer =
    byType('WALLET_TRANSFER').find((wt) => {
      if (!assetReceived) return true;
      const linkRow = findLinkBetween(links, assetReceived.id, wt.id);
      return Boolean(linkRow);
    }) ?? byType('WALLET_TRANSFER')[0];
  const exchangeDeposit = byType('EXCHANGE_DEPOSIT')[0];
  const conversion = byType('CONVERSION')[0];
  const audBalance = snapshots.find((e) => isAudBalanceCredit(e.metadata));
  const audWithdrawal = snapshots.find((e) => isAudWithdrawal(e.metadata));
  const bankSettlement = byType('BANK_SETTLEMENT').find((e) => e.status === 'CONFIRMED');

  const walletAddress = assetReceived?.destination_address ?? null;

  const dsMetadata = await getDigitalSurgeSyncMetadata(organizationId);
  const knownDepositAddresses = readKnownDepositAddresses(dsMetadata);

  let unknownOutboundMovement = false;
  if (assetReceived && walletAddress && !walletTransfer) {
    const unlinked = await prisma.treasury_events.findFirst({
      where: {
        organization_id: organizationId,
        event_type: 'WALLET_TRANSFER',
        source_address: walletAddress,
        asset: assetReceived.asset ?? undefined,
        payment_link_id: null,
        occurred_at: { gte: assetReceived.occurred_at },
      },
      select: { id: true },
    });
    unknownOutboundMovement = Boolean(unlinked);
  }

  const nodes: ReconciliationChainNode[] = [];

  if (customerPayment) {
    nodes.push(
      buildNode(customerPayment, 'customer_payment', 'Customer payment', null)
    );
  }

  if (assetReceived) {
    const parentLink = customerPayment
      ? findLinkBetween(links, customerPayment.id, assetReceived.id)
      : null;
    nodes.push(
      buildNode(
        assetReceived,
        'asset_received',
        assetReceived.asset ? `${assetReceived.asset} received` : 'Asset received',
        parentLink ? evidenceFromLink(parentLink) : null
      )
    );
  }

  if (walletAddress) {
    nodes.push(walletNode(walletAddress));
  }

  if (walletTransfer) {
    const wtLink = assetReceived
      ? findLinkBetween(links, assetReceived.id, walletTransfer.id)
      : null;
    nodes.push(
      buildNode(
        walletTransfer,
        'wallet_transfer',
        walletTransfer.asset ? `${walletTransfer.asset} sent` : 'Wallet transfer',
        wtLink ? evidenceFromLink(wtLink) : null
      )
    );
  }

  if (exchangeDeposit) {
    const exLink =
      (walletTransfer && findLinkBetween(links, walletTransfer.id, exchangeDeposit.id)) ??
      (assetReceived && findLinkBetween(links, assetReceived.id, exchangeDeposit.id)) ??
      null;
    nodes.push(
      buildNode(
        exchangeDeposit,
        'exchange_deposit',
        exchangeDeposit.asset
          ? `Digital Surge ${exchangeDeposit.asset} deposit`
          : 'Digital Surge deposit',
        exLink ? evidenceFromLink(exLink) : null
      )
    );
  }

  if (conversion) {
    const convLink = exchangeDeposit
      ? findLinkBetween(links, exchangeDeposit.id, conversion.id)
      : null;
    nodes.push(
      buildNode(
        conversion,
        'conversion',
        `${conversion.asset ?? 'Crypto'} → ${conversion.destination_asset ?? 'AUD'}`,
        convLink ? evidenceFromLink(convLink) : null
      )
    );
  }

  if (audBalance) {
    nodes.push(
      buildNode(audBalance, 'fiat_credit', 'AUD at Digital Surge', null)
    );
  }

  if (audWithdrawal) {
    nodes.push(
      buildNode(audWithdrawal, 'fiat_withdrawal', 'AUD withdrawal', null)
    );
  }

  if (bankSettlement) {
    nodes.push(
      buildNode(bankSettlement, 'bank_settlement', 'Bank settlement', null)
    );
  }

  const chainStatus = deriveChainStatus({
    nodes,
    exceptions: [],
    hasConfirmedBankSettlement: Boolean(bankSettlement),
    hasAudWithdrawal: Boolean(audWithdrawal),
    hasWalletTransfer: Boolean(walletTransfer),
    hasExchangeDeposit: Boolean(exchangeDeposit),
    unknownOutboundMovement,
  });

  const exceptions = detectReconciliationExceptions({
    paymentLinkId,
    events: snapshots,
    links,
    nodes,
    chainStatus,
    unknownOutboundMovement,
    knownDepositAddresses,
  });

  const finalStatus = deriveChainStatus({
    nodes,
    exceptions,
    hasConfirmedBankSettlement: Boolean(bankSettlement),
    hasAudWithdrawal: Boolean(audWithdrawal),
    hasWalletTransfer: Boolean(walletTransfer),
    hasExchangeDeposit: Boolean(exchangeDeposit),
    unknownOutboundMovement,
  });

  return {
    paymentLinkId,
    invoiceReference: link.invoice_reference ?? link.short_code,
    chainStatus: finalStatus,
    nodes,
    exceptions,
    links: links.map((l) => ({
      id: l.id,
      sourceEventId: l.source_event_id,
      targetEventId: l.target_event_id,
      linkType: l.link_type,
      linkStatus: l.link_status,
      evidence: l.evidence,
    })),
  };
}

export async function listInvoiceReconciliationSummaries(organizationId: string) {
  const paidLinks = await prisma.payment_links.findMany({
    where: { organization_id: organizationId, status: 'PAID' },
    select: { id: true, invoice_reference: true, short_code: true },
    take: 100,
    orderBy: { updated_at: 'desc' },
  });

  const summaries = [];
  for (const pl of paidLinks) {
    const chain = await buildTreasuryReconciliationChain(organizationId, pl.id);
    if (!chain) continue;
    summaries.push({
      paymentLinkId: pl.id,
      invoiceReference: pl.invoice_reference ?? pl.short_code,
      chainStatus: chain.chainStatus,
      exceptionCount: chain.exceptions.length,
    });
  }
  return summaries;
}
