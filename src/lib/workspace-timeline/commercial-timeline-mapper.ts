import {
  COMMERCIAL_OS_ROUTES,
  settlementEarningsHref,
  settlementOverviewHref,
} from '@/lib/journey/commercial-os-routes';
import { formatCurrency } from '@/lib/formatters/format-currency';
import {
  REFERRAL_MANAGEMENT_SLUG,
  referralManagementDealId,
} from '@/lib/workflows/referral-management/constants';
import type {
  CommercialTimelineCategory,
  CommercialTimelineEvent,
  CommercialTimelineFilter,
  CommercialTimelineGroup,
  CommercialTimelineImportance,
  CommercialTimelineResult,
  CommercialTimelineSources,
  PaymentEventTimelineRow,
  PaymentLinkTimelineRow,
  TimelineParticipantOption,
} from '@/lib/workspace-timeline/commercial-timeline-types';
import { eventMatchesParticipantFilter } from '@/lib/workspace-timeline/commercial-timeline-related';

const PAYMENT_EVENT_ACTIONS: Record<
  string,
  { action: string; title: string }
> = {
  CREATED: { action: 'invoice_created', title: 'Invoice created' },
  PAYMENT_INITIATED: { action: 'payment_initiated', title: 'Payment initiated' },
  PAYMENT_CONFIRMED: { action: 'payment_received', title: 'Payment received' },
  PAYMENT_FAILED: { action: 'payment_failed', title: 'Payment failed' },
  REFUND_CONFIRMED: { action: 'payment_refunded', title: 'Payment refunded' },
  CRYPTO_PAYMENT_SUBMITTED: {
    action: 'crypto_payment_submitted',
    title: 'Crypto payment submitted',
  },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  STRIPE: 'Stripe',
  HEDERA: 'Hedera',
  WISE: 'Wise',
  EVM_WALLET: 'Crypto wallet',
  CRYPTO: 'Crypto',
  MANUAL_BANK: 'Bank transfer',
  MANUAL: 'Manual',
};

const COMMERCIAL_CATEGORIES = new Set<CommercialTimelineCategory>([
  'payment',
  'agreement',
  'settlement',
  'referral',
  'accounting',
]);

const EVENT_IMPORTANCE: Record<string, CommercialTimelineImportance> = {
  invoice_created: 'primary',
  payment_initiated: 'supporting',
  payment_received: 'primary',
  payment_failed: 'primary',
  payment_refunded: 'primary',
  crypto_payment_submitted: 'supporting',
  invoice_pushed_to_xero: 'supporting',
  payment_reconciled: 'primary',
  reconciliation_issue: 'primary',
  agreement_uploaded: 'primary',
  agreement_extracted: 'supporting',
  agreement_approved: 'primary',
  referral_workflow_created: 'system',
  participant_added: 'supporting',
  referral_link_generated: 'supporting',
  commission_earned: 'primary',
  obligation_created: 'primary',
  release_created: 'supporting',
  release_submitted: 'primary',
  payout_paid: 'primary',
  xero_connected: 'system',
  workspace_provisioned: 'system',
  system_connected: 'system',
};

const EPOCH_MS = 0;

const SAME_SECOND_ORDER: Record<string, number> = {
  invoice_created: 1,
  payment_initiated: 2,
  payment_received: 3,
  commission_earned: 4,
  obligation_created: 5,
  payment_reconciled: 6,
  release_created: 7,
  release_submitted: 8,
  payout_paid: 9,
};

export function isUsableTimelineTimestamp(value: string | Date | null | undefined): boolean {
  return iso(value) != null;
}

function iso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() === EPOCH_MS) return null;
  return date.toISOString();
}

function amountOf(value: number | null | undefined, currency: string | null | undefined) {
  if (value == null || !Number.isFinite(value)) return undefined;
  const code = currency?.trim();
  return code ? { amount: value, currency: code } : { amount: value };
}

function moneyText(amount: number | undefined, currency: string | undefined): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  if (!currency?.trim()) {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }
  return formatCurrency(amount, currency, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function invoiceLabel(link: PaymentLinkTimelineRow | undefined): string | null {
  if (!link) return null;
  return (
    link.xeroInvoiceNumber?.trim() ||
    link.invoiceReference?.trim() ||
    (link.shortCode ? `Invoice ${link.shortCode}` : null)
  );
}

function paymentHref(link: PaymentLinkTimelineRow | undefined): string | undefined {
  if (!link) return undefined;
  return COMMERCIAL_OS_ROUTES.invoiceHrefFromLink(link);
}

function sourceLabel(
  method: string | null | undefined,
  fallback?: string | null
): string | undefined {
  if (method) {
    const mapped = PAYMENT_METHOD_LABELS[method.toUpperCase()];
    if (mapped) return mapped;
  }
  return fallback?.trim() || undefined;
}

function workflowTitle(slug: string | null | undefined): string {
  if (slug === REFERRAL_MANAGEMENT_SLUG) return 'Referral Management';
  if (slug === 'agreement-intelligence') return 'Agreement Intelligence';
  if (!slug) return 'Workflow';
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function joinDetail(parts: Array<string | null | undefined>): string | undefined {
  const text = parts.filter((part): part is string => Boolean(part && part.trim())).join(' · ');
  return text || undefined;
}

function event(
  partial: Omit<CommercialTimelineEvent, 'importance'> & { importance?: CommercialTimelineImportance }
): CommercialTimelineEvent {
  return {
    ...partial,
    occurredAt: iso(partial.occurredAt) ?? partial.occurredAt,
    currency: partial.amount?.currency ?? partial.currency,
    importance: partial.importance ?? EVENT_IMPORTANCE[partial.action] ?? 'supporting',
  };
}

function uniqueNames(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function paymentLinkById(sources: CommercialTimelineSources) {
  return new Map(sources.paymentLinks.map((link) => [link.id, link]));
}

function mapPaymentEvents(
  sources: CommercialTimelineSources,
  links: Map<string, PaymentLinkTimelineRow>
): CommercialTimelineEvent[] {
  const events: CommercialTimelineEvent[] = [];
  const createdLinkIds = new Set<string>();

  for (const row of sources.paymentEvents) {
    const mapped = PAYMENT_EVENT_ACTIONS[row.eventType];
    if (!mapped) continue;

    const occurredAt =
      row.eventType === 'PAYMENT_CONFIRMED'
        ? iso(row.receivedAt) ?? iso(row.createdAt)
        : iso(row.createdAt);
    if (!occurredAt) continue;

    const link = row.paymentLinkId ? links.get(row.paymentLinkId) : undefined;
    if (row.eventType === 'CREATED' && row.paymentLinkId) {
      createdLinkIds.add(row.paymentLinkId);
    }

    const money = amountOf(row.amount ?? link?.amount ?? null, row.currency ?? link?.currency);
    const invoice = invoiceLabel(link);
    const rail = sourceLabel(row.paymentMethod ?? link?.paymentMethod);

    events.push(
      event({
        id: `payment_event:${row.id}`,
        occurredAt,
        category: 'payment',
        action: mapped.action,
        title: mapped.title,
        description: joinDetail([
          money ? moneyText(money.amount, money.currency) : null,
          invoice,
          rail,
          link?.customerName,
        ]),
        amount: money,
        sourceName: rail,
        relationshipName: link?.customerName ?? undefined,
        href: paymentHref(link),
        entityType: link ? 'payment_link' : 'payment_event',
        entityId: link?.id ?? row.id,
        paymentLinkId: row.paymentLinkId ?? undefined,
        paymentEventId: row.id,
        dealId: link?.pilotDealId ?? undefined,
      })
    );
  }

  for (const link of sources.paymentLinks) {
    if (createdLinkIds.has(link.id)) continue;
    const occurredAt = iso(link.createdAt);
    if (!occurredAt) continue;
    const money = amountOf(link.amount, link.currency);
    events.push(
      event({
        id: `payment_link:${link.id}:created`,
        occurredAt,
        category: 'payment',
        action: 'invoice_created',
        title: 'Invoice created',
        description: joinDetail([
          money ? moneyText(money.amount, money.currency) : null,
          invoiceLabel(link),
          sourceLabel(link.paymentMethod),
          link.customerName,
        ]),
        amount: money,
        sourceName: sourceLabel(link.paymentMethod),
        relationshipName: link.customerName ?? undefined,
        href: paymentHref(link),
        entityType: 'payment_link',
        entityId: link.id,
        paymentLinkId: link.id,
        dealId: link.pilotDealId ?? undefined,
      })
    );
  }

  return events;
}

function mapAccounting(
  sources: CommercialTimelineSources,
  links: Map<string, PaymentLinkTimelineRow>
): CommercialTimelineEvent[] {
  const events: CommercialTimelineEvent[] = [];

  if (sources.xeroConnection) {
    const occurredAt = iso(sources.xeroConnection.connectedAt);
    if (occurredAt) {
      events.push(
        event({
          id: `xero_connection:${sources.xeroConnection.id}`,
          occurredAt,
          category: 'connected_system',
          action: 'xero_connected',
          title: 'Xero connected',
          description: 'Accounting ledger linked to this workspace.',
          sourceName: 'Xero',
          href: COMMERCIAL_OS_ROUTES.connectedXero,
          entityType: 'xero_connection',
          entityId: sources.xeroConnection.id,
        })
      );
    }
  }

  for (const sync of sources.xeroSyncs) {
    const occurredAt = iso(sync.createdAt);
    if (!occurredAt) continue;
    const link = links.get(sync.paymentLinkId);
    const invoice = invoiceLabel(link);
    const money = link ? amountOf(link.amount, link.currency) : undefined;

    if (sync.syncType === 'INVOICE' && sync.status === 'SUCCESS') {
      events.push(
        event({
          id: `xero_sync:${sync.id}`,
          occurredAt,
          category: 'accounting',
          action: 'invoice_pushed_to_xero',
          title: 'Invoice pushed to Xero',
          description: joinDetail([
            money ? moneyText(money.amount, money.currency) : null,
            invoice,
            'Xero',
          ]),
          amount: money,
          sourceName: 'Xero',
          relationshipName: link?.customerName ?? undefined,
          href: paymentHref(link) ?? COMMERCIAL_OS_ROUTES.connectedXero,
          entityType: 'xero_sync',
          entityId: sync.id,
          paymentLinkId: sync.paymentLinkId,
          dealId: link?.pilotDealId ?? undefined,
        })
      );
      continue;
    }

    if (sync.syncType === 'PAYMENT' && sync.status === 'SUCCESS') {
      events.push(
        event({
          id: `xero_sync:${sync.id}`,
          occurredAt,
          category: 'accounting',
          action: 'payment_reconciled',
          title: 'Payment reconciled',
          description: joinDetail([
            money ? `${moneyText(money.amount, money.currency)} matched to Xero` : 'Matched to Xero',
            invoice,
          ]),
          amount: money,
          sourceName: 'Xero',
          relationshipName: link?.customerName ?? undefined,
          href: paymentHref(link) ?? COMMERCIAL_OS_ROUTES.connectedXero,
          entityType: 'xero_sync',
          entityId: sync.id,
          paymentLinkId: sync.paymentLinkId,
          dealId: link?.pilotDealId ?? undefined,
        })
      );
      continue;
    }

    if (sync.status === 'FAILED') {
      events.push(
        event({
          id: `xero_sync:${sync.id}`,
          occurredAt,
          category: 'accounting',
          action: 'reconciliation_issue',
          title: 'Reconciliation issue detected',
          description: joinDetail([
            invoice,
            sync.syncType === 'PAYMENT' ? 'Payment sync failed' : 'Invoice sync failed',
            sync.errorMessage,
          ]),
          sourceName: 'Xero',
          relationshipName: link?.customerName ?? undefined,
          href: paymentHref(link) ?? COMMERCIAL_OS_ROUTES.connectedXero,
          entityType: 'xero_sync',
          entityId: sync.id,
          paymentLinkId: sync.paymentLinkId,
          dealId: link?.pilotDealId ?? undefined,
        })
      );
    }
  }

  return events;
}

function mapAgreements(sources: CommercialTimelineSources): CommercialTimelineEvent[] {
  const events: CommercialTimelineEvent[] = [];

  for (const agreement of sources.workflowAgreements) {
    const name =
      agreement.title?.trim() ||
      agreement.originalFilename?.trim() ||
      'Agreement';
    const source = workflowTitle(agreement.workflowSlug);
    const href = agreement.workflowSlug
      ? COMMERCIAL_OS_ROUTES.workflowAgreement(agreement.workflowSlug, agreement.id)
      : COMMERCIAL_OS_ROUTES.workflows;
    const detail = joinDetail([name, source]);

    const createdAt = iso(agreement.createdAt);
    if (createdAt) {
      events.push(
        event({
          id: `workflow_agreement:${agreement.id}:created`,
          occurredAt: createdAt,
          category: 'agreement',
          action: 'agreement_uploaded',
          title: 'Agreement uploaded',
          description: detail,
          sourceName: source,
          relationshipName: name,
          href,
          entityType: 'organization_workflow_agreement',
          entityId: agreement.id,
          agreementId: agreement.id,
          dealId: agreement.dealId ?? undefined,
        })
      );
    }

    const extractedAt = iso(agreement.extractedAt);
    if (extractedAt) {
      events.push(
        event({
          id: `workflow_agreement:${agreement.id}:extracted`,
          occurredAt: extractedAt,
          category: 'agreement',
          action: 'agreement_extracted',
          title: 'Agreement extracted',
          description: detail,
          sourceName: source,
          relationshipName: name,
          href,
          entityType: 'organization_workflow_agreement',
          entityId: agreement.id,
          agreementId: agreement.id,
          dealId: agreement.dealId ?? undefined,
        })
      );
    }

    const approvedAt = iso(agreement.approvedAt);
    if (approvedAt) {
      events.push(
        event({
          id: `workflow_agreement:${agreement.id}:approved`,
          occurredAt: approvedAt,
          category: 'agreement',
          action: 'agreement_approved',
          title: 'Agreement approved',
          description: detail,
          sourceName: source,
          relationshipName: name,
          href,
          entityType: 'organization_workflow_agreement',
          entityId: agreement.id,
          agreementId: agreement.id,
          dealId: agreement.dealId ?? undefined,
        })
      );
    }
  }

  return events;
}

function uniquePaymentLinkIdForPayout(
  payoutId: string,
  items: CommercialTimelineSources['commissionItems']
): string | undefined {
  const links = new Set(
    items
      .filter((item) => item.payoutId === payoutId && item.paymentLinkId)
      .map((item) => item.paymentLinkId as string)
  );
  return links.size === 1 ? [...links][0] : undefined;
}

function mapReferralAndSettlement(sources: CommercialTimelineSources): CommercialTimelineEvent[] {
  const events: CommercialTimelineEvent[] = [];
  const paidPayoutIds = new Set(
    sources.payouts.filter((payout) => payout.status === 'PAID' && payout.paidAt).map((payout) => payout.id)
  );
  const links = paymentLinkById(sources);

  for (const workflow of sources.workflows) {
    if (workflow.templateSlug !== REFERRAL_MANAGEMENT_SLUG) continue;
    const occurredAt = iso(workflow.deployedAt) ?? iso(workflow.createdAt);
    if (!occurredAt) continue;
    events.push(
      event({
        id: `organization_workflow:${workflow.id}:deployed`,
        occurredAt,
        category: 'system',
        action: 'referral_workflow_created',
        title: 'Referral Management deployed',
        description: 'Referral workflow installed in this workspace.',
        sourceName: 'Referral Management',
        href: COMMERCIAL_OS_ROUTES.workflowInstance(REFERRAL_MANAGEMENT_SLUG),
        entityType: 'organization_workflow',
        entityId: workflow.id,
      })
    );
  }

  for (const participant of sources.participants) {
    const occurredAt = iso(participant.createdAt);
    if (!occurredAt) continue;
    const referralSource = participant.dealId.startsWith('rmwf-') ? 'Referral Management' : undefined;
    events.push(
      event({
        id: `participant:${participant.id}:added`,
        occurredAt,
        category: 'referral',
        action: 'participant_added',
        title: 'Participant added',
        description: joinDetail([participant.name, referralSource]),
        participantName: participant.name,
        sourceName: referralSource,
        href: referralSource
          ? COMMERCIAL_OS_ROUTES.workflowParticipant(REFERRAL_MANAGEMENT_SLUG, participant.id)
          : settlementOverviewHref({ participant: participant.id }),
        entityType: 'deal_network_pilot_participant',
        entityId: participant.id,
        participantId: participant.id,
        dealId: participant.dealId,
      })
    );
  }

  for (const link of sources.referralLinks) {
    const occurredAt = iso(link.createdAt);
    if (!occurredAt) continue;
    events.push(
      event({
        id: `referral_link:${link.id}:created`,
        occurredAt,
        category: 'referral',
        action: 'referral_link_generated',
        title: 'Referral link generated',
        description: joinDetail([link.code, link.participantName, 'Referral Management']),
        participantName: link.participantName ?? undefined,
        sourceName: 'Referral Management',
        href: link.participantId
          ? COMMERCIAL_OS_ROUTES.workflowParticipant(REFERRAL_MANAGEMENT_SLUG, link.participantId)
          : COMMERCIAL_OS_ROUTES.workflowInstance(REFERRAL_MANAGEMENT_SLUG),
        entityType: 'referral_link',
        entityId: link.id,
        participantId: link.participantId ?? undefined,
      })
    );
  }

  for (const item of sources.commissionItems) {
    const occurredAt = iso(item.createdAt);
    if (!occurredAt) continue;
    const money = amountOf(item.amount, item.currency);
    events.push(
      event({
        id: `commission_item:${item.id}:earned`,
        occurredAt,
        category: 'referral',
        action: 'commission_earned',
        title: 'Commission earned',
        description: joinDetail([
          money ? moneyText(money.amount, money.currency) : null,
          item.participantName,
          'Referral Management',
        ]),
        amount: money,
        participantName: item.participantName ?? undefined,
        sourceName: 'Referral Management',
        href: settlementEarningsHref({
          source: 'referral-management',
          participant: item.participantId ?? undefined,
        }),
        entityType: 'commission_obligation_item',
        entityId: item.id,
        paymentLinkId: item.paymentLinkId ?? undefined,
        participantId: item.participantId ?? undefined,
        commissionObligationId: item.commissionObligationId ?? undefined,
        payoutId: item.payoutId ?? undefined,
        dealId: item.paymentLinkId ? links.get(item.paymentLinkId)?.pilotDealId ?? undefined : undefined,
      })
    );

    const paidAt = iso(item.paidAt);
    if (paidAt && (!item.payoutId || !paidPayoutIds.has(item.payoutId))) {
      events.push(
        event({
          id: `commission_item:${item.id}:paid`,
          occurredAt: paidAt,
          category: 'settlement',
          action: 'payout_paid',
          title: 'Payout paid',
          description: joinDetail([
            money ? moneyText(money.amount, money.currency) : null,
            item.participantName,
            'Referral Management',
          ]),
          amount: money,
          participantName: item.participantName ?? undefined,
          sourceName: 'Referral Management',
          href: COMMERCIAL_OS_ROUTES.settlementReleases,
          entityType: 'commission_obligation_item',
          entityId: item.id,
          paymentLinkId: item.paymentLinkId ?? undefined,
          participantId: item.participantId ?? undefined,
          commissionObligationId: item.commissionObligationId ?? undefined,
          payoutId: item.payoutId ?? undefined,
          dealId: item.paymentLinkId ? links.get(item.paymentLinkId)?.pilotDealId ?? undefined : undefined,
        })
      );
    }
  }

  for (const obligation of sources.pilotObligations) {
    const occurredAt = iso(obligation.createdAt);
    if (!occurredAt) continue;
    const money = amountOf(obligation.amount, obligation.currency);
    const owed = money
      ? obligation.participantName
        ? `${moneyText(money.amount, money.currency)} owed to ${obligation.participantName}`
        : `${moneyText(money.amount, money.currency)} owed`
      : obligation.participantName
        ? `Owed to ${obligation.participantName}`
        : null;
    const source = obligation.dealId.startsWith('rmwf-') ? 'Referral Management' : undefined;
    events.push(
      event({
        id: `pilot_obligation:${obligation.id}:created`,
        occurredAt,
        category: 'settlement',
        action: 'obligation_created',
        title: 'Obligation created',
        description: joinDetail([owed, source]),
        amount: money,
        participantName: obligation.participantName ?? undefined,
        sourceName: source,
        href: COMMERCIAL_OS_ROUTES.settlementObligation(obligation.id),
        entityType: 'deal_network_pilot_obligation',
        entityId: obligation.id,
        obligationId: obligation.id,
        dealId: obligation.dealId,
        participantId: obligation.participantId ?? undefined,
        paymentEventId: obligation.paymentEventId ?? undefined,
        paymentLinkId: obligation.paymentLinkId ?? undefined,
      })
    );
  }

  for (const batch of sources.payoutBatches) {
    const names = uniqueNames([
      ...(batch.participantNames ?? []),
      ...sources.payouts.filter((payout) => payout.batchId === batch.id).map((payout) => payout.participantName),
    ]);
    const participantLabel = names.join(', ') || undefined;
    const money = amountOf(batch.totalAmount, batch.currency);

    const createdAt = iso(batch.createdAt);
    if (createdAt) {
      events.push(
        event({
          id: `payout_batch:${batch.id}:created`,
          occurredAt: createdAt,
          category: 'settlement',
          action: 'release_created',
          title: 'Release created',
          description: joinDetail([
            money ? moneyText(money.amount, money.currency) : null,
            participantLabel,
            'Settlement',
          ]),
          amount: money,
          participantName: names[0],
          href: COMMERCIAL_OS_ROUTES.settlementReleases,
          entityType: 'payout_batch',
          entityId: batch.id,
          payoutBatchId: batch.id,
        })
      );
    }

    const submittedAt = iso(batch.submittedAt);
    if (submittedAt) {
      events.push(
        event({
          id: `payout_batch:${batch.id}:submitted`,
          occurredAt: submittedAt,
          category: 'settlement',
          action: 'release_submitted',
          title: 'Released',
          description: joinDetail([
            money ? moneyText(money.amount, money.currency) : null,
            participantLabel,
            'Settlement',
          ]),
          amount: money,
          participantName: names[0],
          href: COMMERCIAL_OS_ROUTES.settlementReleases,
          entityType: 'payout_batch',
          entityId: batch.id,
          payoutBatchId: batch.id,
        })
      );
    }
  }

  for (const payout of sources.payouts) {
    const paidAt = iso(payout.paidAt);
    if (payout.status === 'PAID' && paidAt) {
      const money = amountOf(payout.netAmount, payout.currency);
      events.push(
        event({
          id: `payout:${payout.id}:paid`,
          occurredAt: paidAt,
          category: 'settlement',
          action: 'payout_paid',
          title: 'Payout paid',
          description: joinDetail([
            money ? moneyText(money.amount, money.currency) : null,
            payout.participantName,
            'Settlement',
          ]),
          amount: money,
          participantName: payout.participantName ?? undefined,
          sourceName: 'Settlement',
          href: COMMERCIAL_OS_ROUTES.settlementReleases,
          entityType: 'payout',
          entityId: payout.id,
          payoutId: payout.id,
          payoutBatchId: payout.batchId,
          participantId: payout.participantId ?? undefined,
          paymentLinkId: uniquePaymentLinkIdForPayout(payout.id, sources.commissionItems),
        })
      );
    }
  }

  return events;
}

function mapSystem(sources: CommercialTimelineSources): CommercialTimelineEvent[] {
  const events: CommercialTimelineEvent[] = [];
  const createdAt = iso(sources.organizationCreatedAt);
  if (createdAt) {
    events.push(
      event({
        id: `organization:${sources.organizationId}:provisioned`,
        occurredAt: createdAt,
        category: 'system',
        action: 'workspace_provisioned',
        title: 'Commercial OS provisioned',
        description: 'Workspace created for this account.',
        href: COMMERCIAL_OS_ROUTES.workspace,
        entityType: 'organization',
        entityId: sources.organizationId,
      })
    );
  }

  for (const connection of sources.connectedSystems) {
    const occurredAt = iso(connection.createdAt);
    if (!occurredAt) continue;
    events.push(
      event({
        id: `connected_system:${connection.id}`,
        occurredAt,
        category: 'connected_system',
        action: 'system_connected',
        title: `${connection.provider} connected`,
        description: 'Connected system linked to this workspace.',
        sourceName: connection.provider,
        href: COMMERCIAL_OS_ROUTES.connected,
        entityType: 'treasury_integration_connection',
        entityId: connection.id,
      })
    );
  }

  return events;
}

function narrativeRank(action: string): number {
  return SAME_SECOND_ORDER[action] ?? 50;
}

function sortNewestFirst(events: CommercialTimelineEvent[]): CommercialTimelineEvent[] {
  return [...events].sort((a, b) => {
    const delta = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
    if (delta !== 0) return delta;
    const story = narrativeRank(a.action) - narrativeRank(b.action);
    if (story !== 0) return story;
    return a.id.localeCompare(b.id);
  });
}

export function resolveOrganizationDealIds(sources: CommercialTimelineSources): Set<string> {
  const ids = new Set<string>();
  for (const id of sources.organizationDealIds ?? []) {
    if (id.trim()) ids.add(id);
  }
  for (const link of sources.paymentLinks) {
    if (link.organizationId === sources.organizationId && link.pilotDealId?.trim()) {
      ids.add(link.pilotDealId);
    }
  }
  for (const workflow of sources.workflows) {
    if (
      workflow.organizationId === sources.organizationId &&
      workflow.templateSlug === REFERRAL_MANAGEMENT_SLUG
    ) {
      ids.add(referralManagementDealId(workflow.id));
    }
  }
  for (const obligation of sources.pilotObligations) {
    if (obligation.organizationId === sources.organizationId && obligation.dealId.trim()) {
      ids.add(obligation.dealId);
    }
  }
  return ids;
}

export function isParticipantOwnedByOrganization(
  participant: CommercialTimelineSources['participants'][number],
  organizationId: string,
  dealIds: Set<string>
): boolean {
  if (participant.organizationId && participant.organizationId !== organizationId) {
    return false;
  }
  return dealIds.has(participant.dealId);
}

export function isObligationOwnedByOrganization(
  obligation: CommercialTimelineSources['pilotObligations'][number],
  organizationId: string,
  dealIds: Set<string>
): boolean {
  if (obligation.organizationId === organizationId) return true;
  if (obligation.organizationId && obligation.organizationId !== organizationId) return false;
  return dealIds.has(obligation.dealId);
}

function dedupeEvents(events: CommercialTimelineEvent[]): CommercialTimelineEvent[] {
  const seen = new Set<string>();
  const unique: CommercialTimelineEvent[] = [];
  for (const item of events) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  return unique;
}

export function mapCommercialTimeline(sources: CommercialTimelineSources): CommercialTimelineResult {
  const orgLinks = sources.paymentLinks.filter((link) => link.organizationId === sources.organizationId);
  const orgEvents = sources.paymentEvents.filter(
    (row) =>
      row.organizationId === sources.organizationId ||
      (row.paymentLinkId != null && orgLinks.some((link) => link.id === row.paymentLinkId))
  );
  const dealIds = resolveOrganizationDealIds({
    ...sources,
    paymentLinks: orgLinks,
    workflows: sources.workflows.filter((row) => row.organizationId === sources.organizationId),
  });
  const scoped: CommercialTimelineSources = {
    ...sources,
    organizationDealIds: [...dealIds],
    paymentLinks: orgLinks,
    paymentEvents: orgEvents,
    xeroSyncs: sources.xeroSyncs.filter((sync) => orgLinks.some((link) => link.id === sync.paymentLinkId)),
    workflowAgreements: sources.workflowAgreements.filter(
      (row) => row.organizationId === sources.organizationId
    ),
    workflows: sources.workflows.filter((row) => row.organizationId === sources.organizationId),
    participants: sources.participants.filter((row) =>
      isParticipantOwnedByOrganization(row, sources.organizationId, dealIds)
    ),
    pilotObligations: sources.pilotObligations.filter((row) =>
      isObligationOwnedByOrganization(row, sources.organizationId, dealIds)
    ),
    payoutBatches: sources.payoutBatches.filter((row) => row.organizationId === sources.organizationId),
    payouts: sources.payouts.filter((row) => row.organizationId === sources.organizationId),
    referralLinks: sources.referralLinks.filter((row) => row.organizationId === sources.organizationId),
  };

  const links = paymentLinkById(scoped);
  const events = sortNewestFirst(
    dedupeEvents([
      ...mapPaymentEvents(scoped, links),
      ...mapAccounting(scoped, links),
      ...mapAgreements(scoped),
      ...mapReferralAndSettlement(scoped),
      ...mapSystem(scoped),
    ])
  );

  return {
    organizationId: sources.organizationId,
    events,
    hasCommercialActivity: events.some((item) => COMMERCIAL_CATEGORIES.has(item.category)),
  };
}

export function matchesTimelineFilter(
  event: CommercialTimelineEvent,
  filter: CommercialTimelineFilter
): boolean {
  if (filter === 'all') return true;
  if (filter === 'system') {
    return event.category === 'system' || event.category === 'connected_system';
  }
  return event.category === filter;
}

export function filterCommercialTimeline(
  events: CommercialTimelineEvent[],
  options: {
    category?: CommercialTimelineFilter;
    participantId?: string | null;
    relationshipName?: string | null;
    entityQuery?: string | null;
  } = {}
): CommercialTimelineEvent[] {
  const category = options.category ?? 'all';
  const participantId = options.participantId?.trim() ?? '';
  const relationshipName = options.relationshipName?.trim() ?? '';
  const legacyQuery = !participantId && !relationshipName ? options.entityQuery?.trim() ?? '' : '';

  return events.filter((item) => {
    if (!matchesTimelineFilter(item, category)) return false;
    if (participantId) {
      return eventMatchesParticipantFilter(item, participantId, events);
    }
    if (relationshipName) {
      return item.relationshipName === relationshipName;
    }
    if (!legacyQuery) return true;
    return item.relationshipName === legacyQuery;
  });
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function groupCommercialTimeline(
  events: CommercialTimelineEvent[],
  now: Date = new Date()
): CommercialTimelineGroup[] {
  const today = startOfLocalDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const groups = new Map<string, CommercialTimelineGroup>();

  for (const item of events) {
    const occurred = new Date(item.occurredAt);
    const day = startOfLocalDay(occurred);
    let key: string;
    let label: string;

    if (day.getTime() === today.getTime()) {
      key = 'today';
      label = 'Today';
    } else if (day.getTime() === yesterday.getTime()) {
      key = 'yesterday';
      label = 'Yesterday';
    } else {
      key = day.toISOString().slice(0, 10);
      label = occurred.toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: day.getFullYear() === today.getFullYear() ? undefined : 'numeric',
      });
    }

    const group = groups.get(key) ?? { key, label, events: [] };
    group.events.push(item);
    groups.set(key, group);
  }

  return [...groups.values()];
}

export function formatTimelineTime(
  occurredAt: string,
  now: Date = new Date()
): string {
  const occurred = new Date(occurredAt);
  if (Number.isNaN(occurred.getTime())) return '';
  const today = startOfLocalDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const day = startOfLocalDay(occurred);
  if (day.getTime() === today.getTime() || day.getTime() === yesterday.getTime()) {
    return occurred.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
  }
  return occurred.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export function collectTimelineParticipants(events: CommercialTimelineEvent[]): TimelineParticipantOption[] {
  const byId = new Map<string, string>();
  for (const item of events) {
    if (!item.participantId) continue;
    const name = item.participantName?.trim() || item.participantId;
    if (!byId.has(item.participantId)) byId.set(item.participantId, name);
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function collectTimelineRelationshipNames(events: CommercialTimelineEvent[]): string[] {
  const participantNames = new Set(
    events
      .filter((item) => item.participantId && item.participantName?.trim())
      .map((item) => item.participantName!.trim())
  );
  const names = new Set<string>();
  for (const item of events) {
    const name = item.relationshipName?.trim();
    if (!name || participantNames.has(name)) continue;
    names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function collectTimelineEntities(events: CommercialTimelineEvent[]): string[] {
  return [
    ...collectTimelineParticipants(events).map((row) => row.name),
    ...collectTimelineRelationshipNames(events),
  ];
}

/** @internal exported for tests — payment event types that are not commercial moments */
export function isIgnoredPaymentEventType(eventType: string): boolean {
  return !(eventType in PAYMENT_EVENT_ACTIONS);
}

export function paymentEventOccurredAt(row: PaymentEventTimelineRow): string | null {
  if (row.eventType === 'PAYMENT_CONFIRMED') {
    return iso(row.receivedAt) ?? iso(row.createdAt);
  }
  return iso(row.createdAt);
}
