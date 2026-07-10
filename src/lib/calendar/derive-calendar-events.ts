import type { CommercialLayer, AccountingLayer, SettlementLayer } from '@/lib/payments/payment-layers';
import { projectOverviewPath, projectParticipantsPath, projectPlanningPath } from '@/lib/projects/project-routes';
import { formatCommercialRoleBudget } from '@/lib/projects/commercial-roles/format-commercial-role';
import type {
  CalendarDerivationContext,
  CalendarDerivationInput,
  CalendarEvent,
  CalendarEventAction,
  CalendarPaymentLinkInput,
} from '@/lib/calendar/types';

function toDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function projectMeta(
  ctx: CalendarDerivationContext,
  projectId: string | null | undefined
): { projectId: string | null; projectName: string | null } {
  if (!projectId) return { projectId: null, projectName: null };
  const deal = ctx.dealsById.get(projectId);
  return { projectId, projectName: deal?.name ?? null };
}

function layersFromPaymentLink(link: CalendarPaymentLinkInput): {
  commercial: CommercialLayer | null;
  accounting: AccountingLayer | null;
  settlement: SettlementLayer | null;
} {
  const commercialCurrency = link.commercialCurrency ?? link.invoiceCurrency ?? link.currency;
  const commercialAmount = link.commercialAmount ?? link.amount;
  const commercial: CommercialLayer | null =
    commercialAmount != null
      ? { currency: commercialCurrency, amount: String(commercialAmount) }
      : null;

  const accounting: AccountingLayer | null =
    link.accountingAmount != null && link.accountingCurrency
      ? {
          currency: link.accountingCurrency,
          amount: String(link.accountingAmount),
          exchangeRate: null,
          capturedAt: null,
          valuationMethod: null,
        }
      : null;

  const settlement: SettlementLayer | null =
    link.settlementAmount != null && link.settlementCurrency
      ? {
          currency: link.settlementCurrency,
          amount: String(link.settlementAmount),
          paymentRail: null,
          token: link.settlementCurrency,
          network: null,
          transactionHash: null,
          wallet: null,
          confirmations: null,
          providerMetadata: null,
        }
      : null;

  return { commercial, accounting, settlement };
}

function paymentLinkEvents(
  links: CalendarPaymentLinkInput[],
  ctx: CalendarDerivationContext
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const link of links) {
    const dueDate = toDateKey(link.dueDate);
    if (!dueDate) continue;
    if (['PAID', 'CANCELED', 'EXPIRED'].includes(link.status)) continue;

    const { projectId, projectName } = projectMeta(ctx, link.pilotDealId ?? null);
    const layers = layersFromPaymentLink(link);
    const invoiceLabel = link.xeroInvoiceNumber ?? link.invoiceReference ?? link.shortCode;

    const actions: CalendarEventAction[] = [
      { label: 'View invoice', href: `/dashboard/payment-links?open=${link.id}` },
    ];
    if (projectId) {
      actions.push({ label: 'Open project', href: projectOverviewPath(projectId) });
    }

    events.push({
      id: `payment-link-due:${link.id}`,
      title: link.description?.trim() || 'Invoice due',
      type: 'expected_revenue',
      date: dueDate,
      amount: link.amount,
      currency: link.currency,
      direction: 'incoming',
      status: link.status,
      projectId,
      projectName,
      participantId: null,
      participantName: link.customerName,
      sourceType: link.xeroInvoiceNumber ? 'invoice' : 'payment_link',
      sourceId: link.id,
      sourceMetadata: {
        invoiceNumber: invoiceLabel,
        customer: link.customerName,
        createdAt: link.createdAt,
        dueDate,
        shortCode: link.shortCode,
      },
      commercialLayer: layers.commercial,
      accountingLayer: layers.accounting,
      settlementLayer: layers.settlement,
      actionHref: `/dashboard/payment-links?open=${link.id}`,
      actions,
      tags: ['revenue', link.currency, link.status.toLowerCase()],
    });
  }

  return events;
}

function fundingSourceEvents(
  sources: CalendarDerivationInput['fundingSources'],
  ctx: CalendarDerivationContext
): CalendarEvent[] {
  return sources.flatMap((source) => {
    const date = toDateKey(source.expectedSettlementDate);
    if (!date) return [];

    const { projectId, projectName } = projectMeta(ctx, source.projectId);
    const isIncoming = source.status !== 'cleared' && source.status !== 'reconciled';

    return [
      {
        id: `funding-source:${source.id}`,
        title: source.name,
        type: isIncoming ? 'expected_revenue' : 'money_outgoing',
        date,
        amount: source.amount,
        currency: source.currency,
        direction: isIncoming ? 'incoming' : 'neutral',
        status: source.status,
        projectId,
        projectName,
        participantId: null,
        participantName: null,
        sourceType: 'funding_source',
        sourceId: source.id,
        sourceMetadata: {
          sourceType: source.sourceType,
          confidence: source.confidenceLevel,
          expectedDate: date,
        },
        commercialLayer: { currency: source.currency, amount: String(source.amount) },
        accountingLayer: null,
        settlementLayer: null,
        actionHref: projectId ? projectPlanningPath(projectId) : null,
        actions: projectId
          ? [
              { label: 'Open project', href: projectOverviewPath(projectId) },
              { label: 'Planning', href: projectPlanningPath(projectId) },
            ]
          : [],
        tags: ['funding', source.currency, source.status],
      },
    ];
  });
}

function commercialRoleEvents(
  deals: CalendarDerivationInput['deals'],
  ctx: CalendarDerivationContext
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const today = ctx.today;

  for (const deal of deals) {
    const roles = deal.commercialRoles ?? [];
    for (const role of roles) {
      events.push({
        id: `commercial-role:${deal.id}:${role.id}`,
        title: `${role.title} payment`,
        type: 'money_outgoing',
        date: today,
        amount: role.budgetType === 'FIXED' ? role.budgetValue : null,
        currency: deal.projectValueCurrency ?? 'AUD',
        direction: 'outgoing',
        status: role.status,
        projectId: deal.id,
        projectName: deal.dealName,
        participantId: role.participantId ?? null,
        participantName: null,
        sourceType: 'commercial_role',
        sourceId: role.id,
        sourceMetadata: {
          roleTitle: role.title,
          budget: formatCommercialRoleBudget(role, deal.projectValueCurrency ?? 'AUD'),
          budgetType: role.budgetType,
          paymentDate: 'Settlement release',
        },
        commercialLayer:
          role.budgetType === 'FIXED'
            ? {
                currency: deal.projectValueCurrency ?? 'AUD',
                amount: String(role.budgetValue),
              }
            : null,
        accountingLayer: null,
        settlementLayer: null,
        actionHref: projectPlanningPath(deal.id),
        actions: [
          { label: 'Edit in Planning', href: projectPlanningPath(deal.id) },
          { label: 'Open project', href: projectOverviewPath(deal.id) },
        ],
        tags: ['budgeted_role', role.budgetType.toLowerCase()],
      });
    }
  }

  return events;
}

function obligationEvents(
  obligations: CalendarDerivationInput['obligations'],
  ctx: CalendarDerivationContext
): CalendarEvent[] {
  return obligations.flatMap((row) => {
    const date = toDateKey(row.due_date ?? null);
    if (!date) return [];

    const { projectId, projectName } = projectMeta(ctx, row.deal_id);
    const participantName = row.participant?.name ?? null;
    const participantId = row.participant?.id ?? null;

    return [
      {
        id: `obligation:${row.id}`,
        title: participantName ? `${participantName} payment` : 'Supplier payment',
        type: 'money_outgoing',
        date,
        amount: row.amount_owed,
        currency: row.currency,
        direction: 'outgoing',
        status: row.status,
        projectId,
        projectName,
        participantId,
        participantName,
        sourceType: row.obligation_type.includes('revenue_share') ? 'settlement' : 'obligation',
        sourceId: row.id,
        sourceMetadata: {
          obligationType: row.obligation_type,
          participantRole: row.participant?.role ?? null,
          dueDate: date,
        },
        commercialLayer: { currency: row.currency, amount: String(row.amount_owed) },
        accountingLayer: null,
        settlementLayer: null,
        actionHref: projectId ? `/dashboard/payouts/obligations` : null,
        actions: [
          ...(projectId
            ? [{ label: 'Open project', href: projectOverviewPath(projectId) }]
            : []),
          ...(participantId && projectId
            ? [{ label: 'View participant', href: projectParticipantsPath(projectId) }]
            : []),
          { label: 'View obligations', href: '/dashboard/payouts/obligations' },
        ],
        tags: ['obligation', row.currency, row.status.toLowerCase()],
      },
    ];
  });
}

function participantEvents(
  participants: CalendarDerivationInput['participants'],
  ctx: CalendarDerivationContext
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const p of participants) {
    const payoutDate = toDateKey(p.payoutDueDate ?? null);
    if (payoutDate) {
      const { projectId, projectName } = projectMeta(ctx, p.dealId ?? null);
      events.push({
        id: `participant-payout:${p.id}`,
        title: `${p.name} payout`,
        type: 'money_outgoing',
        date: payoutDate,
        amount: null,
        currency: null,
        direction: 'outgoing',
        status: 'scheduled',
        projectId,
        projectName,
        participantId: p.id,
        participantName: p.name,
        sourceType: 'participant',
        sourceId: p.id,
        sourceMetadata: {
          role: p.role ?? null,
          payoutDueDate: payoutDate,
        },
        commercialLayer: null,
        accountingLayer: null,
        settlementLayer: null,
        actionHref: projectId ? projectParticipantsPath(projectId) : null,
        actions: projectId
          ? [
              { label: 'View participant', href: projectParticipantsPath(projectId) },
              { label: 'Open project', href: projectOverviewPath(projectId) },
            ]
          : [],
        tags: ['participant', 'payout'],
      });
    }

    const approvalDate = toDateKey(p.approvedAt ?? null);
    if (approvalDate) {
      const { projectId, projectName } = projectMeta(ctx, p.dealId ?? null);
      events.push({
        id: `participant-approval:${p.id}`,
        title: `${p.name} approved`,
        type: 'project_milestone',
        date: approvalDate,
        amount: null,
        currency: null,
        direction: 'neutral',
        status: 'approved',
        projectId,
        projectName,
        participantId: p.id,
        participantName: p.name,
        sourceType: 'approval',
        sourceId: p.id,
        sourceMetadata: {
          approvedAt: approvalDate,
        },
        commercialLayer: null,
        accountingLayer: null,
        settlementLayer: null,
        actionHref: projectId ? projectParticipantsPath(projectId) : null,
        actions: projectId
          ? [{ label: 'View participant', href: projectParticipantsPath(projectId) }]
          : [],
        tags: ['approval', 'milestone'],
      });
    }
  }

  return events;
}

function projectMilestoneEvents(
  deals: CalendarDerivationInput['deals'],
  ctx: CalendarDerivationContext
): CalendarEvent[] {
  return deals.flatMap((deal) => {
    const startDate = toDateKey(deal.importedAt ?? deal.lastUpdated ?? null);
    if (!startDate) return [];

    return [
      {
        id: `project-start:${deal.id}`,
        title: 'Project start',
        type: 'project_milestone' as const,
        date: startDate,
        amount: null,
        currency: null,
        direction: 'neutral' as const,
        status: 'active',
        projectId: deal.id,
        projectName: deal.dealName,
        participantId: null,
        participantName: null,
        sourceType: 'project' as const,
        sourceId: deal.id,
        sourceMetadata: {
          startedAt: startDate,
        },
        commercialLayer: null,
        accountingLayer: null,
        settlementLayer: null,
        actionHref: projectOverviewPath(deal.id),
        actions: [
          { label: 'Open project', href: projectOverviewPath(deal.id) },
          { label: 'Planning', href: projectPlanningPath(deal.id) },
        ],
        tags: ['milestone', 'project'],
      },
    ];
  });
}

const TASK_TYPE_CATEGORY: Record<string, CalendarEvent['type']> = {
  configure_earnings: 'operational_task',
  generate_agreement: 'operational_task',
  send_approval: 'operational_task',
  chase_approval: 'operational_task',
  connect_payment_provider: 'operational_task',
  enable_revenue_collection: 'operational_task',
  request_invoice: 'operational_task',
  chase_invoice: 'operational_task',
  review_invoice: 'operational_task',
  verify_bank_details: 'operational_task',
  verify_tax_details: 'operational_task',
  export_to_xero: 'operational_task',
  upload_funding_evidence: 'operational_task',
  release_payment: 'money_outgoing',
  archive_agreement: 'operational_task',
  resolve_invoice_discrepancy: 'operational_task',
  add_missing_participant_details: 'operational_task',
};

function taskEvents(
  tasks: CalendarDerivationInput['tasks'],
  ctx: CalendarDerivationContext
): CalendarEvent[] {
  return tasks.flatMap((task) => {
    const date = toDateKey(task.dueDate);
    if (!date) return [];

    const projectId = task.id.includes(':') ? null : null;

    return [
      {
        id: `task:${task.id}`,
        title: task.title,
        type: TASK_TYPE_CATEGORY[task.taskType] ?? 'operational_task',
        date,
        amount: null,
        currency: null,
        direction: 'neutral',
        status: task.status,
        projectId,
        projectName: null,
        participantId: task.participantId ?? null,
        participantName: task.participantName ?? null,
        sourceType: 'commercial_task',
        sourceId: task.id,
        sourceMetadata: {
          taskType: task.taskType,
          priority: task.priority,
          commercialImpact: task.commercialImpact,
          isOverdue: task.isOverdue,
        },
        commercialLayer: null,
        accountingLayer: null,
        settlementLayer: null,
        actionHref: task.actionHref ?? null,
        actions: task.actionHref
          ? [{ label: task.action, href: task.actionHref }]
          : [],
        tags: ['task', task.taskType, task.priority],
      },
    ];
  });
}

/**
 * Unified calendar event derivation.
 * References existing objects — does not duplicate financial calculations.
 */
export function deriveCalendarEvents(input: CalendarDerivationInput): CalendarEvent[] {
  const today = input.currentDate ?? new Date().toISOString().slice(0, 10);
  const ctx: CalendarDerivationContext = {
    today,
    dealsById: new Map(
      input.deals.map((d) => [d.id, { id: d.id, name: d.dealName }])
    ),
  };

  const events = [
    ...paymentLinkEvents(input.paymentLinks, ctx),
    ...fundingSourceEvents(input.fundingSources, ctx),
    ...commercialRoleEvents(input.deals, ctx),
    ...obligationEvents(input.obligations, ctx),
    ...participantEvents(input.participants, ctx),
    ...projectMilestoneEvents(input.deals, ctx),
    ...taskEvents(input.tasks, ctx),
  ];

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}
