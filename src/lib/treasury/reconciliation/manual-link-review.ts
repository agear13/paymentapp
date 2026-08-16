import { prisma } from '@/lib/server/prisma';
import { buildTreasuryReconciliationChain } from '@/lib/treasury/reconciliation/engine';
import { evidenceFromLink } from '@/lib/treasury/reconciliation/matching';
import type {
  ReconciliationExceptionType,
  TreasuryReconciliationChain,
  TreasuryReconciliationException,
} from '@/lib/treasury/reconciliation/types';

export const MANUAL_LINKABLE_EXCEPTION_TYPES: ReconciliationExceptionType[] = [
  'unknown_wallet_movement',
  'ambiguous_match',
  'wallet_without_exchange',
  'exchange_without_wallet',
  'conversion_without_deposit',
];

export type ManualReconciliationEventDetail = {
  id: string;
  eventType: string;
  status: string;
  asset: string | null;
  destinationAsset: string | null;
  amount: string | null;
  destinationAmount: string | null;
  provider: string;
  occurredAt: string;
  transactionHash: string | null;
  providerReference: string;
  destinationAddress: string | null;
  sourceAddress: string | null;
  invoiceReference: string | null;
  paymentLinkId: string | null;
  existingEvidence: {
    strategy: string | null;
    linkType: string;
    linkStatus: string;
    manual: boolean;
  } | null;
  manualReconciliation: {
    auditId: string;
    linkedAt: string;
    linkedByUserId: string;
    notes: string | null;
    linkStatus: string;
  } | null;
};

export type ManualReconciliationReviewItem = {
  reviewId: string;
  paymentLinkId: string;
  invoiceReference: string | null;
  chainStatus: string;
  exception: TreasuryReconciliationException;
  sourceEvent: ManualReconciliationEventDetail;
  candidateTargetEvents: ManualReconciliationEventDetail[];
  autoLinkFailureReason: string;
};

function isManualLinkable(type: ReconciliationExceptionType): boolean {
  return MANUAL_LINKABLE_EXCEPTION_TYPES.includes(type);
}

function eventTypeOf(
  eventId: string,
  eventsById: Map<string, { event_type: string }>
): string | null {
  return eventsById.get(eventId)?.event_type ?? null;
}

function resolveSourceAndCandidateIds(
  exception: TreasuryReconciliationException,
  eventsById: Map<string, { event_type: string }>,
  chain: TreasuryReconciliationChain
): { sourceEventId: string; candidateTargetEventIds: string[] } | null {
  const related = exception.relatedEventIds;
  const chainAssetReceivedId = chain.nodes.find(
    (n) => n.eventType === 'ASSET_RECEIVED' && n.eventId
  )?.eventId;

  switch (exception.type) {
    case 'unknown_wallet_movement': {
      const sourceId =
        chainAssetReceivedId ??
        related.find((id) => eventTypeOf(id, eventsById) === 'ASSET_RECEIVED');
      const candidates = related.filter(
        (id) => eventTypeOf(id, eventsById) === 'WALLET_TRANSFER'
      );
      if (!sourceId || candidates.length === 0) return null;
      return { sourceEventId: sourceId, candidateTargetEventIds: candidates };
    }
    case 'ambiguous_match': {
      const sourceId = related.find(
        (id) => eventTypeOf(id, eventsById) === 'WALLET_TRANSFER'
      );
      const candidates = related.filter(
        (id) =>
          id !== sourceId && eventTypeOf(id, eventsById) === 'EXCHANGE_DEPOSIT'
      );
      if (!sourceId || candidates.length === 0) return null;
      return { sourceEventId: sourceId, candidateTargetEventIds: candidates };
    }
    case 'wallet_without_exchange': {
      const sourceId = related.find(
        (id) => eventTypeOf(id, eventsById) === 'WALLET_TRANSFER'
      );
      if (!sourceId) return null;
      return { sourceEventId: sourceId, candidateTargetEventIds: [] };
    }
    case 'exchange_without_wallet': {
      const targetId = related.find(
        (id) => eventTypeOf(id, eventsById) === 'EXCHANGE_DEPOSIT'
      );
      const sourceId =
        chain.nodes.find((n) => n.eventType === 'WALLET_TRANSFER' && n.eventId)?.eventId ??
        chain.nodes.find((n) => n.eventType === 'ASSET_RECEIVED' && n.eventId)?.eventId ??
        related.find((id) => eventTypeOf(id, eventsById) === 'WALLET_TRANSFER') ??
        related.find((id) => eventTypeOf(id, eventsById) === 'ASSET_RECEIVED');
      if (!sourceId || !targetId) return null;
      return { sourceEventId: sourceId, candidateTargetEventIds: [targetId] };
    }
    case 'conversion_without_deposit': {
      const targetId = related.find((id) => eventTypeOf(id, eventsById) === 'CONVERSION');
      const sourceId =
        chain.nodes.find((n) => n.eventType === 'EXCHANGE_DEPOSIT' && n.eventId)?.eventId ??
        related.find((id) => eventTypeOf(id, eventsById) === 'EXCHANGE_DEPOSIT');
      if (!sourceId || !targetId) return null;
      return { sourceEventId: sourceId, candidateTargetEventIds: [targetId] };
    }
    default:
      return null;
  }
}

async function loadEventDetails(
  organizationId: string,
  eventIds: string[]
): Promise<Map<string, ManualReconciliationEventDetail>> {
  if (eventIds.length === 0) return new Map();

  const uniqueIds = [...new Set(eventIds)];
  const rows = await prisma.treasury_events.findMany({
    where: { organization_id: organizationId, id: { in: uniqueIds } },
    include: {
      payment_links: { select: { invoice_reference: true, short_code: true } },
      manual_links_as_target: {
        orderBy: { linked_at: 'desc' },
        take: 1,
      },
      target_links: {
        include: {
          source_event: { select: { id: true, event_type: true } },
        },
      },
      source_links: {
        include: {
          target_event: { select: { id: true, event_type: true } },
        },
      },
    },
  });

  const map = new Map<string, ManualReconciliationEventDetail>();
  for (const row of rows) {
    const inboundLink = row.target_links?.[0] ?? row.source_links?.[0] ?? null;
    const evidence = inboundLink ? evidenceFromLink(inboundLink) : null;
    const audit = row.manual_links_as_target?.[0] ?? null;

    map.set(row.id, {
      id: row.id,
      eventType: row.event_type,
      status: row.status,
      asset: row.asset,
      destinationAsset: row.destination_asset,
      amount: row.amount?.toString() ?? null,
      destinationAmount: row.destination_amount?.toString() ?? null,
      provider: row.provider,
      occurredAt: row.occurred_at.toISOString(),
      transactionHash: row.transaction_hash,
      providerReference: row.provider_reference,
      destinationAddress: row.destination_address,
      sourceAddress: row.source_address,
      invoiceReference:
        row.payment_links?.invoice_reference ?? row.payment_links?.short_code ?? null,
      paymentLinkId: row.payment_link_id,
      existingEvidence: evidence
        ? {
            strategy: evidence.strategy,
            linkType: evidence.linkType ?? 'CORRELATION',
            linkStatus: evidence.linkStatus ?? row.status,
            manual: evidence.manual,
          }
        : null,
      manualReconciliation: audit
        ? {
            auditId: audit.id,
            linkedAt: audit.linked_at.toISOString(),
            linkedByUserId: audit.linked_by_user_id,
            notes: audit.notes,
            linkStatus: audit.new_status,
          }
        : null,
    });
  }
  return map;
}

async function loadUnlinkedWalletTransferCandidates(
  organizationId: string,
  paymentLinkId: string,
  assetReceived: { destination_address: string | null; asset: string | null; occurred_at: Date } | null
): Promise<string[]> {
  if (!assetReceived?.destination_address) return [];
  const rows = await prisma.treasury_events.findMany({
    where: {
      organization_id: organizationId,
      event_type: 'WALLET_TRANSFER',
      source_address: assetReceived.destination_address,
      asset: assetReceived.asset ?? undefined,
      payment_link_id: null,
      occurred_at: { gte: assetReceived.occurred_at },
    },
    orderBy: { occurred_at: 'desc' },
    take: 10,
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function loadOrgExchangeDepositCandidates(
  organizationId: string,
  paymentLinkId: string | null | undefined
): Promise<string[]> {
  const deposits = await prisma.treasury_events.findMany({
    where: {
      organization_id: organizationId,
      event_type: 'EXCHANGE_DEPOSIT',
      status: { in: ['UNKNOWN', 'INFERRED'] },
    },
    orderBy: { occurred_at: 'desc' },
    take: 20,
    select: { id: true, payment_link_id: true },
  });

  return deposits
    .filter(
      (d) =>
        !paymentLinkId ||
        !d.payment_link_id ||
        d.payment_link_id === paymentLinkId
    )
    .map((d) => d.id);
}

export async function listManualReconciliationReviewItems(
  organizationId: string
): Promise<ManualReconciliationReviewItem[]> {
  const paidLinks = await prisma.payment_links.findMany({
    where: { organization_id: organizationId, status: 'PAID' },
    select: { id: true },
    orderBy: { updated_at: 'desc' },
    take: 100,
  });

  const items: ManualReconciliationReviewItem[] = [];

  for (const link of paidLinks) {
    const chain = await buildTreasuryReconciliationChain(organizationId, link.id);
    if (!chain) continue;

    const manualExceptions = chain.exceptions.filter((e) => isManualLinkable(e.type));
    if (manualExceptions.length === 0) continue;

    const allRelatedIds = [
      ...new Set(manualExceptions.flatMap((e) => e.relatedEventIds)),
    ];
    const chainEventIds = chain.nodes.map((n) => n.eventId).filter(Boolean) as string[];
    const preloadIds = [...new Set([...allRelatedIds, ...chainEventIds])];

    const eventRows = await prisma.treasury_events.findMany({
      where: { organization_id: organizationId, id: { in: preloadIds } },
      select: { id: true, event_type: true },
    });
    const eventsById = new Map(eventRows.map((e) => [e.id, e]));

    for (const exception of manualExceptions) {
      const resolved = resolveSourceAndCandidateIds(exception, eventsById, chain);
      if (!resolved) continue;

      let candidateIds = resolved.candidateTargetEventIds;
      if (exception.type === 'wallet_without_exchange' && candidateIds.length === 0) {
        candidateIds = await loadOrgExchangeDepositCandidates(
          organizationId,
          exception.paymentLinkId
        );
      }
      if (exception.type === 'unknown_wallet_movement' && candidateIds.length === 0) {
        const assetRow = await prisma.treasury_events.findFirst({
          where: {
            organization_id: organizationId,
            id: resolved.sourceEventId,
            event_type: 'ASSET_RECEIVED',
          },
          select: {
            destination_address: true,
            asset: true,
            occurred_at: true,
          },
        });
        candidateIds = await loadUnlinkedWalletTransferCandidates(
          organizationId,
          link.id,
          assetRow
        );
      }
      if (candidateIds.length === 0) continue;

      const detailIds = [resolved.sourceEventId, ...candidateIds];
      const details = await loadEventDetails(organizationId, detailIds);
      const sourceEvent = details.get(resolved.sourceEventId);
      if (!sourceEvent) continue;

      const candidateTargetEvents = candidateIds
        .map((id) => details.get(id))
        .filter((d): d is ManualReconciliationEventDetail => Boolean(d));

      if (candidateTargetEvents.length === 0) continue;

      if (sourceEvent.eventType === 'BANK_SETTLEMENT') continue;
      if (candidateTargetEvents.some((c) => c.eventType === 'BANK_SETTLEMENT')) continue;

      items.push({
        reviewId: `${link.id}:${exception.type}:${resolved.sourceEventId}`,
        paymentLinkId: link.id,
        invoiceReference: chain.invoiceReference,
        chainStatus: chain.chainStatus,
        exception,
        sourceEvent,
        candidateTargetEvents,
        autoLinkFailureReason: exception.reason,
      });
    }
  }

  return items;
}

export async function getManualReconciliationReviewItem(
  organizationId: string,
  reviewId: string
): Promise<ManualReconciliationReviewItem | null> {
  const items = await listManualReconciliationReviewItems(organizationId);
  return items.find((item) => item.reviewId === reviewId) ?? null;
}
