import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { mapCommercialTimeline } from '@/lib/workspace-timeline/commercial-timeline-mapper';
import {
  summarizeTimelineSourceCompleteness,
  takeBounded,
} from '@/lib/workspace-timeline/commercial-timeline-completeness';
import { REFERRAL_MANAGEMENT_SLUG, referralManagementDealId } from '@/lib/workflows/referral-management/constants';
import { TIMELINE_SOURCE_LIMIT } from '@/lib/workspace-timeline/commercial-timeline-types';
import type {
  CommercialTimelineCompleteness,
  CommercialTimelineResult,
  CommercialTimelineSources,
} from '@/lib/workspace-timeline/commercial-timeline-types';
import { pilotSlugFromParticipantId } from '@/lib/referrals/pilot-referral-slug.server';

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === 'object' && 'toNumber' in value) {
    const parsed = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return Number(value) || 0;
}

export function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return null;
  return date.toISOString();
}

function bounded<T>(rows: T[], name: string, limit = TIMELINE_SOURCE_LIMIT) {
  const { rows: kept, truncated } = takeBounded(rows, limit);
  return {
    rows: kept,
    fetch: { name, fetched: rows.length, limit },
    truncated,
  };
}

export async function loadCommercialTimelineSources(input: {
  organizationId: string;
  userId: string;
}): Promise<{ sources: CommercialTimelineSources; completeness: CommercialTimelineCompleteness }> {
  const { organizationId } = input;
  const overFetch = TIMELINE_SOURCE_LIMIT + 1;

  const [
    organization,
    paymentLinkRows,
    paymentEventRows,
    xeroConnection,
    xeroSyncRows,
    workflowAgreementRows,
    workflowRows,
    payoutBatchRows,
    commissionItemRows,
    referralLinkRows,
    connectedSystemRows,
  ] = await Promise.all([
    prisma.organizations.findUnique({
      where: { id: organizationId },
      select: { id: true, created_at: true },
    }),
    prisma.payment_links.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
      take: overFetch,
      select: {
        id: true,
        organization_id: true,
        short_code: true,
        status: true,
        amount: true,
        currency: true,
        description: true,
        invoice_reference: true,
        xero_invoice_number: true,
        customer_name: true,
        payment_method: true,
        referral_link_id: true,
        pilot_deal_id: true,
        created_at: true,
      },
    }),
    prisma.payment_events.findMany({
      where: {
        OR: [{ organization_id: organizationId }, { payment_links: { organization_id: organizationId } }],
      },
      orderBy: { created_at: 'desc' },
      take: overFetch,
      select: {
        id: true,
        organization_id: true,
        payment_link_id: true,
        event_type: true,
        payment_method: true,
        gross_amount: true,
        amount_received: true,
        currency_received: true,
        received_at: true,
        created_at: true,
      },
    }),
    prisma.xero_connections.findUnique({
      where: { organization_id: organizationId },
      select: { id: true, connected_at: true },
    }),
    prisma.xero_syncs.findMany({
      where: { payment_links: { organization_id: organizationId } },
      orderBy: { created_at: 'desc' },
      take: overFetch,
      select: {
        id: true,
        payment_link_id: true,
        sync_type: true,
        status: true,
        created_at: true,
        xero_invoice_id: true,
        xero_payment_id: true,
        error_message: true,
      },
    }),
    prisma.organization_workflow_agreements.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
      take: overFetch,
      select: {
        id: true,
        organization_id: true,
        title: true,
        original_filename: true,
        created_at: true,
        extracted_at: true,
        approved_at: true,
        bootstrapped_at: true,
        pilot_deal_id: true,
        organization_workflows: { select: { template_slug: true } },
      },
    }),
    prisma.organization_workflows.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
      take: 51,
      select: {
        id: true,
        organization_id: true,
        template_slug: true,
        created_at: true,
        deployed_at: true,
      },
    }),
    prisma.payout_batches.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
      take: overFetch,
      include: {
        payouts: {
          select: {
            id: true,
            organization_id: true,
            batch_id: true,
            user_id: true,
            currency: true,
            net_amount: true,
            status: true,
            paid_at: true,
            failed_reason: true,
            created_at: true,
          },
        },
      },
    }),
    prisma.commission_obligation_items.findMany({
      where: {
        commission_obligations: {
          payment_links: { organization_id: organizationId },
        },
      },
      orderBy: { created_at: 'desc' },
      take: overFetch,
      include: {
        commission_obligations: {
          select: {
            payment_link_id: true,
            referral_links: { select: { slug: true } },
            payment_links: { select: { invoice_reference: true, xero_invoice_number: true } },
          },
        },
      },
    }),
    prisma.referral_links.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
      take: overFetch,
      select: { id: true, organization_id: true, code: true, slug: true, created_at: true },
    }),
    prisma.treasury_integration_connections.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
      take: 51,
      select: { id: true, provider: true, created_at: true },
    }),
  ]);

  const paymentLinks = bounded(paymentLinkRows, 'payment_links');
  const paymentEvents = bounded(paymentEventRows, 'payment_events');
  const xeroSyncs = bounded(xeroSyncRows, 'xero_syncs');
  const workflowAgreements = bounded(workflowAgreementRows, 'workflow_agreements');
  const workflows = bounded(workflowRows, 'workflows', 50);
  const payoutBatches = bounded(payoutBatchRows, 'payout_batches');
  const commissionItems = bounded(commissionItemRows, 'commission_items');
  const referralLinks = bounded(referralLinkRows, 'referral_links');
  const connectedSystems = bounded(connectedSystemRows, 'connected_systems', 50);

  const seedDealIds = [
    ...paymentLinks.rows.map((link) => link.pilot_deal_id).filter((id): id is string => Boolean(id)),
    ...workflows.rows
      .filter((row) => row.template_slug === REFERRAL_MANAGEMENT_SLUG)
      .map((row) => referralManagementDealId(row.id)),
  ];
  const uniqueSeedDealIds = [...new Set(seedDealIds)];

  const participantWhere = {
    OR: [
      { deal: { linked_payment_links: { some: { organization_id: organizationId } } } },
      { obligations: { some: { organization_id: organizationId } } },
      ...(uniqueSeedDealIds.length > 0 ? [{ deal_id: { in: uniqueSeedDealIds } }] : []),
    ],
  };
  const obligationWhere = {
    OR: [
      { organization_id: organizationId },
      { deal: { linked_payment_links: { some: { organization_id: organizationId } } } },
      ...(uniqueSeedDealIds.length > 0 ? [{ deal_id: { in: uniqueSeedDealIds } }] : []),
    ],
  };

  const [participantRows, obligationRows] = await Promise.all([
    prisma.deal_network_pilot_participants.findMany({
      where: participantWhere,
      orderBy: { created_at: 'desc' },
      take: overFetch,
      select: {
        id: true,
        name: true,
        deal_id: true,
        created_at: true,
        authenticated_user_id: true,
      },
    }),
    prisma.deal_network_pilot_obligations.findMany({
      where: obligationWhere,
      orderBy: { created_at: 'desc' },
      take: overFetch,
      select: {
        id: true,
        organization_id: true,
        deal_id: true,
        participant_id: true,
        amount_owed: true,
        currency: true,
        created_at: true,
        payment_event_id: true,
        participant: { select: { name: true } },
        payment_event: { select: { payment_link_id: true } },
      },
    }),
  ]);

  const participants = bounded(participantRows, 'participants');
  const pilotObligations = bounded(obligationRows, 'pilot_obligations');

  const organizationDealIds = [
    ...new Set([
      ...uniqueSeedDealIds,
      ...pilotObligations.rows
        .filter((row) => row.organization_id === organizationId)
        .map((row) => row.deal_id),
    ]),
  ];

  const completeness = summarizeTimelineSourceCompleteness([
    paymentLinks.fetch,
    paymentEvents.fetch,
    xeroSyncs.fetch,
    workflowAgreements.fetch,
    workflows.fetch,
    payoutBatches.fetch,
    commissionItems.fetch,
    referralLinks.fetch,
    connectedSystems.fetch,
    participants.fetch,
    pilotObligations.fetch,
  ]);

  const participantById = new Map(participants.rows.map((row) => [row.id, row]));
  const participantByAuth = new Map(
    participants.rows
      .filter((row) => row.authenticated_user_id)
      .map((row) => [row.authenticated_user_id as string, row])
  );
  const participantBySlug = new Map(
    participants.rows.map((row) => [pilotSlugFromParticipantId(row.id), row])
  );

  const sources: CommercialTimelineSources = {
    organizationId,
    organizationCreatedAt: toIsoOrNull(organization?.created_at),
    organizationDealIds,
    paymentLinks: paymentLinks.rows.flatMap((link) => {
      const createdAt = toIsoOrNull(link.created_at);
      if (!createdAt) return [];
      return [
        {
          id: link.id,
          organizationId: link.organization_id,
          shortCode: link.short_code,
          status: link.status,
          amount: toNumber(link.amount),
          currency: link.currency,
          description: link.description,
          invoiceReference: link.invoice_reference,
          xeroInvoiceNumber: link.xero_invoice_number,
          customerName: link.customer_name,
          paymentMethod: link.payment_method,
          referralLinkId: link.referral_link_id,
          createdAt,
          pilotDealId: link.pilot_deal_id,
        },
      ];
    }),
    paymentEvents: paymentEvents.rows.flatMap((row) => {
      const createdAt = toIsoOrNull(row.created_at);
      if (!createdAt) return [];
      return [
        {
          id: row.id,
          organizationId: row.organization_id,
          paymentLinkId: row.payment_link_id,
          eventType: row.event_type,
          paymentMethod: row.payment_method,
          amount:
            row.gross_amount != null
              ? toNumber(row.gross_amount)
              : row.amount_received != null
                ? toNumber(row.amount_received)
                : null,
          currency: row.currency_received,
          receivedAt: toIsoOrNull(row.received_at),
          createdAt,
        },
      ];
    }),
    xeroConnection: (() => {
      const connectedAt = toIsoOrNull(xeroConnection?.connected_at);
      return xeroConnection && connectedAt ? { id: xeroConnection.id, connectedAt } : null;
    })(),
    xeroSyncs: xeroSyncs.rows.flatMap((sync) => {
      const createdAt = toIsoOrNull(sync.created_at);
      if (!createdAt) return [];
      return [
        {
          id: sync.id,
          paymentLinkId: sync.payment_link_id,
          syncType: sync.sync_type,
          status: sync.status,
          createdAt,
          xeroInvoiceId: sync.xero_invoice_id,
          xeroPaymentId: sync.xero_payment_id,
          errorMessage: sync.error_message,
        },
      ];
    }),
    workflowAgreements: workflowAgreements.rows.flatMap((row) => {
      const createdAt = toIsoOrNull(row.created_at);
      if (!createdAt) return [];
      return [
        {
          id: row.id,
          organizationId: row.organization_id,
          title: row.title,
          originalFilename: row.original_filename,
          workflowSlug: row.organization_workflows.template_slug,
          createdAt,
          extractedAt: toIsoOrNull(row.extracted_at),
          approvedAt: toIsoOrNull(row.approved_at),
          bootstrappedAt: toIsoOrNull(row.bootstrapped_at),
          dealId: row.pilot_deal_id,
        },
      ];
    }),
    workflows: workflows.rows.flatMap((row) => {
      const createdAt = toIsoOrNull(row.created_at);
      const deployedAt = toIsoOrNull(row.deployed_at) ?? createdAt;
      if (!createdAt || !deployedAt) return [];
      return [
        {
          id: row.id,
          organizationId: row.organization_id,
          templateSlug: row.template_slug,
          createdAt,
          deployedAt,
        },
      ];
    }),
    participants: participants.rows.flatMap((row) => {
      const createdAt = toIsoOrNull(row.created_at);
      if (!createdAt) return [];
      return [
        {
          id: row.id,
          name: row.name,
          dealId: row.deal_id,
          createdAt,
          organizationId,
        },
      ];
    }),
    pilotObligations: pilotObligations.rows.flatMap((row) => {
      const createdAt = toIsoOrNull(row.created_at);
      if (!createdAt) return [];
      return [
        {
          id: row.id,
          organizationId: row.organization_id,
          dealId: row.deal_id,
          participantId: row.participant_id,
          participantName:
            row.participant?.name ??
            (row.participant_id ? participantById.get(row.participant_id)?.name ?? null : null),
          amount: toNumber(row.amount_owed),
          currency: row.currency,
          createdAt,
          paymentEventId: row.payment_event_id,
          paymentLinkId: row.payment_event?.payment_link_id ?? null,
        },
      ];
    }),
    payoutBatches: payoutBatches.rows.flatMap((batch) => {
      const createdAt = toIsoOrNull(batch.created_at);
      if (!createdAt) return [];
      return [
        {
          id: batch.id,
          organizationId: batch.organization_id,
          currency: batch.currency,
          totalAmount: toNumber(batch.total_amount),
          createdAt,
          submittedAt: toIsoOrNull(batch.submitted_at),
        },
      ];
    }),
    payouts: payoutBatches.rows.flatMap((batch) =>
      batch.payouts.flatMap((payout) => {
        const createdAt = toIsoOrNull(payout.created_at);
        if (!createdAt) return [];
        const participant =
          participantById.get(payout.user_id) ?? participantByAuth.get(payout.user_id) ?? null;
        return [
          {
            id: payout.id,
            organizationId: payout.organization_id,
            batchId: payout.batch_id,
            userId: payout.user_id,
            participantId: participant?.id ?? null,
            participantName: participant?.name ?? null,
            currency: payout.currency,
            netAmount: toNumber(payout.net_amount),
            status: payout.status,
            paidAt: toIsoOrNull(payout.paid_at),
            failedReason: payout.failed_reason,
            createdAt,
          },
        ];
      })
    ),
    commissionItems: commissionItems.rows.flatMap((item) => {
      const createdAt = toIsoOrNull(item.created_at);
      if (!createdAt) return [];
      const slug = item.commission_obligations.referral_links?.slug ?? null;
      const participant = slug ? participantBySlug.get(slug) ?? null : null;
      const invoice =
        item.commission_obligations.payment_links?.xero_invoice_number ??
        item.commission_obligations.payment_links?.invoice_reference ??
        null;
      return [
        {
          id: item.id,
          amount: toNumber(item.amount),
          currency: item.currency,
          createdAt,
          paidAt: toIsoOrNull(item.paid_at),
          payoutId: item.payout_id,
          paymentLinkId: item.commission_obligations.payment_link_id,
          commissionObligationId: item.commission_obligation_id,
          participantId: participant?.id ?? null,
          participantName: participant?.name ?? null,
          invoiceReference: invoice,
        },
      ];
    }),
    referralLinks: referralLinks.rows.flatMap((row) => {
      const createdAt = toIsoOrNull(row.created_at);
      if (!createdAt) return [];
      const participant = row.slug ? participantBySlug.get(row.slug) ?? null : null;
      return [
        {
          id: row.id,
          organizationId: row.organization_id,
          code: row.code,
          createdAt,
          participantId: participant?.id ?? null,
          participantName: participant?.name ?? null,
        },
      ];
    }),
    connectedSystems: connectedSystems.rows.flatMap((row) => {
      const createdAt = toIsoOrNull(row.created_at);
      if (!createdAt) return [];
      return [{ id: row.id, provider: row.provider, createdAt }];
    }),
  };

  return { sources, completeness };
}

export async function loadCommercialTimelineForOrganization(input: {
  organizationId: string;
  userId: string;
}): Promise<CommercialTimelineResult> {
  const { sources, completeness } = await loadCommercialTimelineSources(input);
  return {
    ...mapCommercialTimeline(sources),
    completeness,
  };
}
