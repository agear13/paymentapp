import type {
  AccountingLayer,
  CommercialLayer,
  SettlementLayer,
} from '@/lib/payments/payment-layers';
import { projectOverviewPath, projectParticipantsPath, projectPlanningPath } from '@/lib/projects/project-routes';
import { formatCommercialRoleBudget } from '@/lib/projects/commercial-roles/format-commercial-role';
import { buildTimelineExplanation } from '@/lib/workspace-timeline/timeline-explanations';
import { buildPaymentLinkLineage, buildObligationLineage, buildFundingLineage } from '@/lib/workspace-timeline/timeline-lineage';
import type {
  TimelineImportance,
  TimelineLayer,
  WorkspaceTimelineEvent,
  WorkspaceTimelineEventType,
  WorkspaceTimelineInput,
  WorkspaceTimelineResult,
} from '@/lib/workspace-timeline/types';
import { deriveCashFlowForecast, deriveTimelineMonthSummary } from '@/lib/workspace-timeline/timeline-summary';

function toDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

type Ctx = {
  today: string;
  dealsById: Map<string, { id: string; name: string; currency: string }>;
};

function projectMeta(ctx: Ctx, projectId: string | null | undefined) {
  if (!projectId) return { projectId: null, projectName: null, currency: 'AUD' };
  const deal = ctx.dealsById.get(projectId);
  return {
    projectId,
    projectName: deal?.name ?? null,
    currency: deal?.currency ?? 'AUD',
  };
}

function layersFromPaymentLink(link: WorkspaceTimelineInput['paymentLinks'][0]): {
  commercial: CommercialLayer | null;
  accounting: AccountingLayer | null;
  settlement: SettlementLayer | null;
} {
  const commercialCurrency = link.commercialCurrency ?? link.invoiceCurrency ?? link.currency;
  const commercialAmount = link.commercialAmount ?? link.amount;
  return {
    commercial: commercialAmount != null ? { currency: commercialCurrency, amount: String(commercialAmount) } : null,
    accounting:
      link.accountingAmount != null && link.accountingCurrency
        ? { currency: link.accountingCurrency, amount: String(link.accountingAmount), exchangeRate: null, capturedAt: null, valuationMethod: null }
        : null,
    settlement:
      link.settlementAmount != null && link.settlementCurrency
        ? { currency: link.settlementCurrency, amount: String(link.settlementAmount), paymentRail: link.paymentMethod ?? null, token: link.settlementCurrency, network: null, transactionHash: null, wallet: null, confirmations: null, providerMetadata: null }
        : null,
  };
}

function paymentLinkStatusToType(link: WorkspaceTimelineInput['paymentLinks'][0]): {
  type: WorkspaceTimelineEventType;
  status: string;
  layer: TimelineLayer;
  title: string;
  date: string | null;
  direction: 'incoming' | 'outgoing' | 'neutral';
  importance: TimelineImportance;
} {
  const paid = ['PAID', 'PAID_UNVERIFIED', 'REQUIRES_REVIEW'].includes(link.status);
  const dueDate = toDateKey(link.dueDate);
  const paidDate = toDateKey(link.paidAt ?? null);

  if (paid) {
    const method = (link.paymentMethod ?? '').toUpperCase();
    const type: WorkspaceTimelineEventType =
      method === 'HEDERA' || method === 'CRYPTO'
        ? 'metamask_payment'
        : method === 'STRIPE'
          ? 'stripe_payment'
          : 'invoice_paid';
    return {
      type,
      status: link.status === 'REQUIRES_REVIEW' ? 'settlement_pending' : 'payment_confirmed',
      layer: link.status === 'REQUIRES_REVIEW' ? 'settlement' : 'accounting',
      title: type === 'stripe_payment' ? 'Stripe payment' : type === 'metamask_payment' ? 'MetaMask payment' : 'Invoice paid',
      date: paidDate ?? dueDate,
      direction: 'incoming',
      importance: 'medium',
    };
  }

  if (link.status === 'OPEN' || link.status === 'DRAFT') {
    return {
      type: 'invoice_due',
      status: 'awaiting_payment',
      layer: 'commercial',
      title: 'Invoice due',
      date: dueDate,
      direction: 'incoming',
      importance: 'high',
    };
  }

  return {
    type: 'expected_payment',
    status: link.status.toLowerCase(),
    layer: 'commercial',
    title: link.description || 'Expected payment',
    date: dueDate,
    direction: 'incoming',
    importance: 'low',
  };
}

/** One evolving event per payment link — status updates, no duplicates. */
function paymentLinkEvents(links: WorkspaceTimelineInput['paymentLinks'], ctx: Ctx): WorkspaceTimelineEvent[] {
  return links.flatMap((link) => {
    const mapped = paymentLinkStatusToType(link);
    if (!mapped.date) return [];

    const { projectId, projectName } = projectMeta(ctx, link.pilotDealId ?? null);
    const layers = layersFromPaymentLink(link);
    const invoiceLabel = link.xeroInvoiceNumber ?? link.invoiceReference ?? `PL-${link.shortCode}`;
    const entityKey = `payment_link:${link.id}`;
    const lineage = buildPaymentLinkLineage(link, mapped.status);
    const explanation = buildTimelineExplanation({
      type: mapped.type,
      status: mapped.status,
      layer: mapped.layer,
      title: mapped.title,
      projectName,
      amount: link.amount,
      currency: link.currency,
    });

    return [
      {
        id: entityKey,
        entityKey,
        type: mapped.type,
        date: mapped.date,
        title: mapped.title,
        subtitle: link.description || invoiceLabel,
        projectId,
        projectName,
        participantId: null,
        participantName: link.customerName,
        sourceEntity: {
          kind: 'payment_link',
          id: link.id,
          label: `Invoice #${invoiceLabel}`,
          href: `/dashboard/payment-links?open=${link.id}`,
        },
        status: mapped.status,
        importance: mapped.importance,
        layer: mapped.layer,
        currency: link.currency,
        amount: link.amount,
        direction: mapped.direction,
        metadata: {
          invoiceNumber: invoiceLabel,
          customer: link.customerName,
          createdAt: link.createdAt,
          paymentMethod: link.paymentMethod ?? null,
          shortCode: link.shortCode,
        },
        lineage,
        explanation,
        commercialLayer: layers.commercial,
        accountingLayer: layers.accounting,
        settlementLayer: layers.settlement,
        linkedEntities: [
          { kind: 'invoice', id: link.id, label: invoiceLabel, href: `/dashboard/payment-links?open=${link.id}` },
          { kind: 'payment_link', id: link.id, label: link.shortCode, href: `/dashboard/payment-links?open=${link.id}` },
          ...(link.customerName
            ? [{ kind: 'customer', id: link.id, label: link.customerName }]
            : []),
        ],
        actions: [
          { label: 'View invoice', href: `/dashboard/payment-links?open=${link.id}` },
          ...(projectId ? [{ label: 'Open project', href: projectOverviewPath(projectId) }] : []),
        ],
        tags: ['revenue', link.currency, mapped.layer, link.paymentMethod?.toLowerCase() ?? 'invoice'],
      },
    ];
  });
}

function obligationEvents(obligations: WorkspaceTimelineInput['obligations'], ctx: Ctx): WorkspaceTimelineEvent[] {
  return obligations.flatMap((row) => {
    const date = toDateKey(row.due_date ?? null);
    if (!date) return [];

    const { projectId, projectName } = projectMeta(ctx, row.deal_id);
    const participantName = row.participant?.name ?? null;
    const isSettlement = row.obligation_type.includes('revenue_share');
    const entityKey = `obligation:${row.id}`;
    const status =
      row.status === 'PAID' || row.status === 'RELEASE_READY'
        ? 'settlement_completed'
        : row.status === 'PENDING'
          ? 'obligation_due'
          : row.status.toLowerCase();

    const type: WorkspaceTimelineEventType =
      status === 'settlement_completed' ? 'settlement_completed' : isSettlement ? 'settlement_pending' : 'obligation_due';

    const layer: TimelineLayer = isSettlement ? 'settlement' : 'commercial';
    const lineage = buildObligationLineage(row);

    return [
      {
        id: entityKey,
        entityKey,
        type,
        date,
        title: participantName ? `${participantName} payment` : 'Obligation due',
        subtitle: row.obligation_type,
        projectId,
        projectName,
        participantId: row.participant?.id ?? null,
        participantName,
        sourceEntity: { kind: 'obligation', id: row.id, label: row.obligation_type, href: '/dashboard/payouts/obligations' },
        status,
        importance: 'high',
        layer,
        currency: row.currency,
        amount: row.amount_owed,
        direction: 'outgoing',
        metadata: { obligationType: row.obligation_type, dueDate: date },
        lineage,
        explanation: buildTimelineExplanation({
          type,
          status,
          layer,
          title: participantName ?? 'Obligation',
          projectName,
          amount: row.amount_owed,
          currency: row.currency,
        }),
        commercialLayer: { currency: row.currency, amount: String(row.amount_owed) },
        accountingLayer: null,
        settlementLayer: isSettlement ? { currency: row.currency, amount: String(row.amount_owed), paymentRail: null, token: null, network: null, transactionHash: null, wallet: null, confirmations: null, providerMetadata: null } : null,
        linkedEntities: [
          ...(projectId ? [{ kind: 'project', id: projectId, label: projectName ?? projectId, href: projectOverviewPath(projectId) }] : []),
          ...(participantName ? [{ kind: 'participant', id: row.participant?.id ?? row.id, label: participantName }] : []),
        ],
        actions: [
          { label: 'View obligations', href: '/dashboard/payouts/obligations' },
          ...(projectId && row.participant?.id
            ? [{ label: 'View participant', href: projectParticipantsPath(projectId) }]
            : []),
        ],
        tags: ['outgoing', 'obligation', row.currency],
      },
    ];
  });
}

function fundingEvents(sources: WorkspaceTimelineInput['fundingSources'], ctx: Ctx): WorkspaceTimelineEvent[] {
  return sources.flatMap((source) => {
    const date = toDateKey(source.expectedSettlementDate);
    if (!date) return [];

    const { projectId, projectName } = projectMeta(ctx, source.projectId);
    const entityKey = `funding_source:${source.id}`;
    const cleared = source.status === 'cleared' || source.status === 'reconciled';

    return [
      {
        id: entityKey,
        entityKey,
        type: cleared ? 'funding_connected' : 'expected_payment',
        date,
        title: source.name,
        subtitle: source.sourceType,
        projectId,
        projectName,
        participantId: null,
        participantName: null,
        sourceEntity: { kind: 'funding_source', id: source.id, label: source.name },
        status: source.status,
        importance: 'medium',
        layer: 'commercial',
        currency: source.currency,
        amount: source.amount,
        direction: 'incoming',
        metadata: { confidence: source.confidenceLevel, sourceType: source.sourceType },
        lineage: buildFundingLineage(source),
        explanation: buildTimelineExplanation({
          type: 'expected_payment',
          status: source.status,
          layer: 'commercial',
          title: source.name,
          projectName,
          amount: source.amount,
          currency: source.currency,
        }),
        commercialLayer: { currency: source.currency, amount: String(source.amount) },
        accountingLayer: null,
        settlementLayer: null,
        linkedEntities: projectId
          ? [{ kind: 'project', id: projectId, label: projectName ?? projectId, href: projectPlanningPath(projectId) }]
          : [],
        actions: projectId
          ? [
              { label: 'Planning', href: projectPlanningPath(projectId) },
              { label: 'Open project', href: projectOverviewPath(projectId) },
            ]
          : [],
        tags: ['funding', source.currency, source.status],
      },
    ];
  });
}

function projectEvents(deals: WorkspaceTimelineInput['deals'], ctx: Ctx): WorkspaceTimelineEvent[] {
  return deals.flatMap((deal) => {
    const date = toDateKey(deal.importedAt ?? deal.lastUpdated ?? null);
    if (!date) return [];

    const entityKey = `project:${deal.id}`;
    return [
      {
        id: entityKey,
        entityKey,
        type: 'project_start',
        date,
        title: 'Project start',
        subtitle: deal.dealName,
        projectId: deal.id,
        projectName: deal.dealName,
        participantId: null,
        participantName: null,
        sourceEntity: { kind: 'project', id: deal.id, label: deal.dealName, href: projectOverviewPath(deal.id) },
        status: 'active',
        importance: 'low',
        layer: 'operational',
        currency: null,
        amount: null,
        direction: 'neutral',
        metadata: { startedAt: date },
        lineage: [{ label: 'Project', layer: 'operational' }],
        explanation: buildTimelineExplanation({
          type: 'project_start',
          status: 'active',
          layer: 'operational',
          title: deal.dealName,
          projectName: deal.dealName,
        }),
        commercialLayer: null,
        accountingLayer: null,
        settlementLayer: null,
        linkedEntities: [{ kind: 'project', id: deal.id, label: deal.dealName, href: projectOverviewPath(deal.id) }],
        actions: [
          { label: 'Open project', href: projectOverviewPath(deal.id) },
          { label: 'Planning', href: projectPlanningPath(deal.id) },
        ],
        tags: ['milestone', 'project'],
      },
    ];
  });
}

function participantEvents(participants: WorkspaceTimelineInput['participants'], ctx: Ctx): WorkspaceTimelineEvent[] {
  const events: WorkspaceTimelineEvent[] = [];

  for (const p of participants) {
    const { projectId, projectName } = projectMeta(ctx, p.dealId ?? null);

    const payoutDate = toDateKey(p.payoutDueDate ?? null);
    if (payoutDate) {
      const entityKey = `participant_payout:${p.id}`;
      events.push({
        id: entityKey,
        entityKey,
        type: 'settlement_pending',
        date: payoutDate,
        title: `${p.name} payout`,
        subtitle: p.role ?? null,
        projectId,
        projectName,
        participantId: p.id,
        participantName: p.name,
        sourceEntity: { kind: 'participant', id: p.id, label: p.name },
        status: 'settlement_pending',
        importance: 'high',
        layer: 'settlement',
        currency: null,
        amount: null,
        direction: 'outgoing',
        metadata: { role: p.role ?? null },
        lineage: [
          { label: 'Participant', layer: 'operational' },
          { label: 'Obligation', layer: 'commercial' },
          { label: 'Settlement', layer: 'settlement' },
        ],
        explanation: buildTimelineExplanation({
          type: 'settlement_pending',
          status: 'settlement_pending',
          layer: 'settlement',
          title: p.name,
          projectName,
        }),
        commercialLayer: null,
        accountingLayer: null,
        settlementLayer: null,
        linkedEntities: projectId
          ? [{ kind: 'participant', id: p.id, label: p.name, href: projectParticipantsPath(projectId) }]
          : [{ kind: 'participant', id: p.id, label: p.name }],
        actions: projectId ? [{ label: 'View participant', href: projectParticipantsPath(projectId) }] : [],
        tags: ['settlement', 'participant', 'outgoing'],
      });
    }

    const approvalDate = toDateKey(p.approvedAt ?? null);
    const pending = p.approvalStatus?.toLowerCase().includes('pending');
    if (approvalDate && !pending) {
      const entityKey = `participant_approval:${p.id}`;
      events.push({
        id: entityKey,
        entityKey,
        type: 'participant_accepted',
        date: approvalDate,
        title: `${p.name} accepted`,
        subtitle: 'Agreement approved',
        projectId,
        projectName,
        participantId: p.id,
        participantName: p.name,
        sourceEntity: { kind: 'participant', id: p.id, label: p.name },
        status: 'approved',
        importance: 'medium',
        layer: 'operational',
        currency: null,
        amount: null,
        direction: 'neutral',
        metadata: { approvedAt: approvalDate },
        lineage: [
          { label: 'Participant', layer: 'operational' },
          { label: 'Agreement', layer: 'commercial' },
          { label: 'Approved', layer: 'operational' },
        ],
        explanation: buildTimelineExplanation({
          type: 'participant_accepted',
          status: 'approved',
          layer: 'operational',
          title: p.name,
          projectName,
        }),
        commercialLayer: null,
        accountingLayer: null,
        settlementLayer: null,
        linkedEntities: projectId
          ? [{ kind: 'participant', id: p.id, label: p.name, href: projectParticipantsPath(projectId) }]
          : [],
        actions: projectId ? [{ label: 'View participant', href: projectParticipantsPath(projectId) }] : [],
        tags: ['approval', 'participant'],
      });
    } else if (pending) {
      const entityKey = `participant_approval:${p.id}`;
      events.push({
        id: entityKey,
        entityKey,
        type: 'participant_approval',
        date: ctx.today,
        title: `${p.name} approval`,
        subtitle: 'Awaiting approval',
        projectId,
        projectName,
        participantId: p.id,
        participantName: p.name,
        sourceEntity: { kind: 'participant', id: p.id, label: p.name },
        status: 'pending_approval',
        importance: 'critical',
        layer: 'operational',
        currency: null,
        amount: null,
        direction: 'neutral',
        metadata: {},
        lineage: [{ label: 'Participant', layer: 'operational' }, { label: 'Approval pending', layer: 'operational' }],
        explanation: buildTimelineExplanation({
          type: 'participant_approval',
          status: 'pending_approval',
          layer: 'operational',
          title: p.name,
          projectName,
        }),
        commercialLayer: null,
        accountingLayer: null,
        settlementLayer: null,
        linkedEntities: projectId
          ? [{ kind: 'participant', id: p.id, label: p.name, href: projectParticipantsPath(projectId) }]
          : [],
        actions: projectId ? [{ label: 'Review approvals', href: `${projectParticipantsPath(projectId)}?focus=approvals` }] : [],
        tags: ['approval', 'participant', 'risk'],
      });
    }
  }

  return events;
}

function roleEvents(deals: WorkspaceTimelineInput['deals'], ctx: Ctx): WorkspaceTimelineEvent[] {
  return deals.flatMap((deal) =>
    (deal.commercialRoles ?? []).map((role) => {
      const entityKey = `commercial_role:${role.id}`;
      return {
        id: entityKey,
        entityKey,
        type: 'budget_review' as const,
        date: ctx.today,
        title: `${role.title} budget`,
        subtitle: formatCommercialRoleBudget(role, deal.projectValueCurrency ?? 'AUD'),
        projectId: deal.id,
        projectName: deal.dealName,
        participantId: role.participantId ?? null,
        participantName: null,
        sourceEntity: { kind: 'commercial_role', id: role.id, label: role.title, href: projectPlanningPath(deal.id) },
        status: role.status,
        importance: 'medium' as const,
        layer: 'commercial' as const,
        currency: deal.projectValueCurrency ?? 'AUD',
        amount: role.budgetType === 'FIXED' ? role.budgetValue : null,
        direction: 'outgoing' as const,
        metadata: { budgetType: role.budgetType, budgetValue: role.budgetValue },
        lineage: [
          { label: 'Budgeted role', layer: 'commercial' },
          { label: 'Participant', layer: 'operational' },
          { label: 'Obligation', layer: 'commercial' },
          { label: 'Settlement', layer: 'settlement' },
        ],
        explanation: buildTimelineExplanation({
          type: 'budget_review',
          status: role.status,
          layer: 'commercial',
          title: role.title,
          projectName: deal.dealName,
          amount: role.budgetType === 'FIXED' ? role.budgetValue : null,
          currency: deal.projectValueCurrency ?? 'AUD',
        }),
        commercialLayer:
          role.budgetType === 'FIXED'
            ? { currency: deal.projectValueCurrency ?? 'AUD', amount: String(role.budgetValue) }
            : null,
        accountingLayer: null,
        settlementLayer: null,
        linkedEntities: [
          { kind: 'budgeted_role', id: role.id, label: role.title, href: projectPlanningPath(deal.id) },
          { kind: 'project', id: deal.id, label: deal.dealName, href: projectOverviewPath(deal.id) },
        ],
        actions: [
          { label: 'Edit in Planning', href: projectPlanningPath(deal.id) },
          { label: 'Open project', href: projectOverviewPath(deal.id) },
        ],
        tags: ['budgeted_role', 'commercial', 'outgoing'],
      };
    })
  );
}

function commercialRiskEvents(input: WorkspaceTimelineInput, ctx: Ctx): WorkspaceTimelineEvent[] {
  const business = input.business;
  if (!business) return [];

  const forecast = business.commercial.forecast;
  if (forecast.forecastPosition.status !== 'deficit') return [];

  const shortfall = Math.abs(forecast.forecastPosition.forecastBalance);
  return [
    {
      id: 'workspace:cash_shortfall',
      entityKey: 'workspace:cash_shortfall',
      type: 'cash_shortfall',
      date: ctx.today,
      title: 'Cash shortfall',
      subtitle: `Forecast deficit across ${business.activeProjects} projects`,
      projectId: null,
      projectName: null,
      participantId: null,
      participantName: null,
      sourceEntity: { kind: 'commercial_forecast', id: 'workspace', label: 'Commercial forecast' },
      status: 'at_risk',
      importance: 'critical',
      layer: 'commercial',
      currency: business.currency,
      amount: shortfall,
      direction: 'outgoing',
      metadata: { shortfall, activeProjects: business.activeProjects },
      lineage: [
        { label: 'Commercial forecast', layer: 'commercial' },
        { label: 'Cash shortfall', layer: 'commercial' },
      ],
      explanation: buildTimelineExplanation({
        type: 'cash_shortfall',
        status: 'at_risk',
        layer: 'commercial',
        title: 'Cash shortfall',
        amount: shortfall,
        currency: business.currency,
      }),
      commercialLayer: { currency: business.currency, amount: String(shortfall) },
      accountingLayer: null,
      settlementLayer: null,
      linkedEntities: [],
      actions: [{ label: 'View dashboard', href: '/dashboard' }],
      tags: ['risk', 'commercial', business.currency],
    },
  ];
}

/**
 * WorkspaceTimelineService — single derived event service for all timeline views.
 * Never duplicates financial calculations; references existing entity data.
 */
export function deriveWorkspaceTimeline(input: WorkspaceTimelineInput, month?: Date): WorkspaceTimelineResult {
  const today = input.currentDate ?? new Date().toISOString().slice(0, 10);
  const ctx: Ctx = {
    today,
    dealsById: new Map(
      input.deals.map((d) => [
        d.id,
        { id: d.id, name: d.dealName, currency: d.projectValueCurrency ?? 'AUD' },
      ])
    ),
  };

  const events = [
    ...paymentLinkEvents(input.paymentLinks, ctx),
    ...obligationEvents(input.obligations, ctx),
    ...fundingEvents(input.fundingSources, ctx),
    ...projectEvents(input.deals, ctx),
    ...participantEvents(input.participants, ctx),
    ...roleEvents(input.deals, ctx),
    ...commercialRiskEvents(input, ctx),
  ].sort((a, b) => {
    const imp = { critical: 0, high: 1, medium: 2, low: 3 };
    return (
      a.date.localeCompare(b.date) ||
      imp[a.importance] - imp[b.importance] ||
      a.title.localeCompare(b.title)
    );
  });

  const monthSummary = deriveTimelineMonthSummary(input, events, month ?? new Date());
  const cashForecast = deriveCashFlowForecast(input, month ?? new Date());

  return { events, monthSummary, cashForecast };
}

/** Filter events to a month window for lazy loading. */
export function eventsForMonth(events: WorkspaceTimelineEvent[], month: Date): WorkspaceTimelineEvent[] {
  const y = month.getFullYear();
  const m = month.getMonth();
  return events.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === y && d.getMonth() === m;
  });
}

export type { WorkspaceTimelineEvent };
