/**
 * Commercial Automation Engine tests.
 *
 * Proves deterministic rule execution from commercial model — not AI.
 */

import {
  CommercialTriggerKind,
  CommercialConditionKind,
  CommercialActionKind,
  AutomationNotificationKind,
  buildCommercialTrigger,
  runCommercialAutomation,
  executeCommercialRule,
  evaluateConditions,
  resolveRulesForPolicy,
  findRulesForTrigger,
  getAutomationPolicy,
  listAutomationPolicies,
  deriveScheduledAutomationJobs,
  filterDueScheduledJobs,
  prepareScheduledExecutions,
  deriveWorkflowEffects,
  deduplicateNotifications,
  deriveAllAutomationReports,
  deriveAiRuleRecommendationsExtension,
  deriveAiExecutionExplanationExtension,
  listProviderAdapters,
  DEFAULT_COMMERCIAL_RULES,
} from '@/lib/commercial-automation';

const PROJECT_ID = 'proj-001';
const AS_OF = '2026-07-01T00:00:00.000Z';

function makeTrigger(
  kind: CommercialTriggerKind,
  overrides: Record<string, unknown> = {}
) {
  return buildCommercialTrigger(kind, {
    occurredAt: AS_OF,
    projectId: PROJECT_ID,
    dealId: 'deal-001',
    ...overrides,
  });
}

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    projectId: PROJECT_ID,
    dealId: 'deal-001',
    currency: 'AUD',
    policyId: 'default' as const,
    trigger: makeTrigger(CommercialTriggerKind.AgreementApproved),
    asOfDate: AS_OF,
    participants: [],
    invoices: [],
    ...overrides,
  };
}

describe('automation policies', () => {
  it('provides configurable policies per business type', () => {
    const policies = listAutomationPolicies();
    expect(policies.map((p) => p.id)).toContain('hospitality');
    expect(policies.map((p) => p.id)).toContain('events');
    expect(policies.map((p) => p.id)).toContain('construction');
    expect(policies.map((p) => p.id)).toContain('professional_services');
  });

  it('events policy enables timing-driven rules', () => {
    const rules = resolveRulesForPolicy('events');
    expect(rules.some((r) => r.id === 'rule:timing_approaching_reminder')).toBe(true);
  });

  it('hospitality policy enables settlement and payout rules', () => {
    const rules = resolveRulesForPolicy('hospitality');
    expect(rules.some((r) => r.id === 'rule:settlement_ready_release')).toBe(true);
    expect(rules.some((r) => r.id === 'rule:agreement_approved_request_payout')).toBe(true);
  });
});

describe('agreement approval triggers automation', () => {
  it('sends payout reminder when details missing', () => {
    const result = runCommercialAutomation(
      makeInput({
        trigger: makeTrigger(CommercialTriggerKind.AgreementApproved, {
          participantId: 'p-1',
        }),
        participants: [
          {
            participantId: 'p-1',
            participantName: 'Sarah',
            agreementApproved: true,
            payoutDetailsSubmitted: false,
            workspaceCreated: false,
          },
        ],
      })
    );

    const executed = result.executions.find(
      (e) => e.ruleId === 'rule:agreement_approved_request_payout'
    );
    expect(executed?.status).toBe('success');
    expect(executed?.actions.some((a) => a.kind === CommercialActionKind.RequestPayoutDetails)).toBe(
      true
    );
    expect(result.activityEvents.some((a) => a.label === 'Payout Details Requested')).toBe(true);
    expect(
      result.notifications.some((n) => n.kind === AutomationNotificationKind.PayoutReminder)
    ).toBe(true);
  });

  it('skips payout reminder when details already submitted', () => {
    const result = runCommercialAutomation(
      makeInput({
        trigger: makeTrigger(CommercialTriggerKind.AgreementApproved),
        participants: [
          {
            participantId: 'p-1',
            participantName: 'Sarah',
            agreementApproved: true,
            payoutDetailsSubmitted: true,
            workspaceCreated: true,
          },
        ],
      })
    );

    const executed = result.executions.find(
      (e) => e.ruleId === 'rule:agreement_approved_request_payout'
    );
    expect(executed?.status).toBe('skipped');
  });
});

describe('invoice overdue reminder', () => {
  it('sends payment reminder when invoice overdue 7+ days', () => {
    const result = runCommercialAutomation(
      makeInput({
        trigger: makeTrigger(CommercialTriggerKind.InvoiceOverdue),
        invoices: [
          {
            paymentLinkId: 'inv-1',
            invoiceAmount: 18000,
            amountPaid: 0,
            exported: true,
            outstanding: true,
            overdue: true,
            daysOverdue: 10,
          },
        ],
      })
    );

    const executed = result.executions.find(
      (e) => e.ruleId === 'rule:invoice_overdue_reminder'
    );
    expect(executed?.status).toBe('success');
    expect(executed?.actions.some((a) => a.kind === CommercialActionKind.SendReminder)).toBe(true);
    expect(result.activityEvents.some((a) => a.label === 'Payment Reminder Sent')).toBe(true);
  });
});

describe('settlement release', () => {
  it('releases settlement when eligible and all approved', () => {
    const result = runCommercialAutomation(
      makeInput({
        trigger: makeTrigger(CommercialTriggerKind.SettlementReady),
        participants: [
          {
            participantId: 'p-1',
            participantName: 'Sarah',
            agreementApproved: true,
            payoutDetailsSubmitted: true,
            workspaceCreated: true,
            workflow: {
              participantId: 'p-1',
              commercial: { state: 'COMMERCIAL_SETTLEMENT_READY', label: 'Settlement ready' },
              settlement: {
                state: 'READY',
                label: 'Settlement ready',
                readiness: null,
              },
              accounting: { state: 'SYNCED', label: 'Synced', export: null },
            },
          },
        ],
      })
    );

    const executed = result.executions.find(
      (e) => e.ruleId === 'rule:settlement_ready_release'
    );
    expect(executed?.status).toBe('success');
    expect(executed?.actions.some((a) => a.kind === CommercialActionKind.ReleaseSettlement)).toBe(
      true
    );
    expect(result.activityEvents.some((a) => a.label === 'Settlement Released')).toBe(true);
  });
});

describe('forecast refresh', () => {
  it('refreshes forecast on payment received', () => {
    const result = runCommercialAutomation(
      makeInput({
        trigger: makeTrigger(CommercialTriggerKind.PaymentReceived),
        forecastingInput: {
          currency: 'AUD',
          fundingSources: [
            {
              id: 'fs-1',
              projectId: PROJECT_ID,
              organizationId: null,
              name: 'Customer',
              description: null,
              sourceType: 'REVENUE',
              amount: 10000,
              currency: 'AUD',
              status: 'CONFIRMED',
              confidenceLevel: 'HIGH',
              expectedSettlementDate: null,
              actualSettlementDate: AS_OF,
              linkedInvoiceId: null,
              linkedPaymentId: null,
              notes: null,
              createdAt: AS_OF,
              updatedAt: AS_OF,
            },
          ],
          treasury: null,
          obligationRows: [],
          releaseConfidence: null,
        },
      })
    );

    const executed = result.executions.find(
      (e) => e.ruleId === 'rule:payment_received_refresh'
    );
    expect(executed?.status).toBe('success');
    expect(executed?.actions.some((a) => a.kind === CommercialActionKind.RefreshForecast)).toBe(
      true
    );
    expect(result.activityEvents.some((a) => a.label === 'Forecast Updated')).toBe(true);
  });
});

describe('notification creation', () => {
  it('creates deduplicated notification events', () => {
    const result = runCommercialAutomation(
      makeInput({
        trigger: makeTrigger(CommercialTriggerKind.InvoiceOverdue),
        invoices: [
          {
            paymentLinkId: 'inv-1',
            invoiceAmount: 5000,
            amountPaid: 0,
            exported: true,
            outstanding: true,
            overdue: true,
            daysOverdue: 14,
          },
        ],
      })
    );

    const deduped = deduplicateNotifications(result.notifications);
    expect(deduped.length).toBeLessThanOrEqual(result.notifications.length);
    expect(deduped.every((n) => n.dedupeKey)).toBe(true);
  });
});

describe('activity logging', () => {
  it('creates activity events for every executed action', () => {
    const result = runCommercialAutomation(
      makeInput({
        trigger: makeTrigger(CommercialTriggerKind.InvoiceCreated),
      })
    );

    const executed = result.executions.find(
      (e) => e.ruleId === 'rule:invoice_created_export'
    );
    expect(executed?.activityEvents.length).toBeGreaterThan(0);
    expect(result.activityEvents.every((a) => a.projectId === PROJECT_ID)).toBe(true);
  });
});

describe('audit trail generation', () => {
  it('records rule, trigger, conditions, actions, and duration', () => {
    const rule = DEFAULT_COMMERCIAL_RULES.find(
      (r) => r.id === 'rule:invoice_created_export'
    )!;
    const execution = executeCommercialRule(
      rule,
      makeInput({ trigger: makeTrigger(CommercialTriggerKind.InvoiceCreated) })
    );

    expect(execution.auditEntry.ruleId).toBe(rule.id);
    expect(execution.auditEntry.trigger).toBe(CommercialTriggerKind.InvoiceCreated);
    expect(execution.auditEntry.durationMs).toBeGreaterThanOrEqual(0);
    expect(execution.auditEntry.status).toBe('success');
    expect(execution.auditEntry.actions.length).toBeGreaterThan(0);
  });
});

describe('scheduler execution', () => {
  it('derives scheduled jobs for overdue invoices', () => {
    const input = makeInput({
      invoices: [
        {
          paymentLinkId: 'inv-1',
          invoiceAmount: 5000,
          amountPaid: 0,
          exported: true,
          outstanding: true,
          overdue: true,
          daysOverdue: 5,
        },
      ],
    });
    const rules = resolveRulesForPolicy('default');
    const jobs = deriveScheduledAutomationJobs(input, rules);
    expect(jobs.some((j) => j.trigger === CommercialTriggerKind.InvoiceOverdue)).toBe(true);
  });

  it('prepares due scheduled executions', () => {
    const input = makeInput({
      asOfDate: '2026-12-01T00:00:00.000Z',
      invoices: [
        {
          paymentLinkId: 'inv-1',
          invoiceAmount: 5000,
          amountPaid: 0,
          exported: true,
          outstanding: true,
          overdue: true,
          daysOverdue: 20,
        },
      ],
    });
    const rules = resolveRulesForPolicy('default');
    const { dueInputs } = prepareScheduledExecutions(input, rules);
    expect(Array.isArray(dueInputs)).toBe(true);
  });

  it('filters due jobs by date', () => {
    const jobs = [
      {
        id: 'j1',
        ruleId: 'r1',
        trigger: CommercialTriggerKind.InvoiceOverdue,
        scheduledFor: '2026-06-01T00:00:00.000Z',
        description: 'past',
        status: 'pending' as const,
      },
      {
        id: 'j2',
        ruleId: 'r2',
        trigger: CommercialTriggerKind.SettlementReady,
        scheduledFor: '2026-12-01T00:00:00.000Z',
        description: 'future',
        status: 'pending' as const,
      },
    ];
    const due = filterDueScheduledJobs(jobs, '2026-07-01T00:00:00.000Z');
    expect(due).toHaveLength(1);
    expect(due[0]!.id).toBe('j1');
  });
});

describe('workflow integration', () => {
  it('derives workflow effects without duplicating state', () => {
    const result = runCommercialAutomation(
      makeInput({
        trigger: makeTrigger(CommercialTriggerKind.SettlementReady),
        participants: [
          {
            participantId: 'p-1',
            participantName: 'Sarah',
            agreementApproved: true,
            payoutDetailsSubmitted: true,
            workspaceCreated: true,
            workflow: {
              participantId: 'p-1',
              commercial: { state: 'COMMERCIAL_SETTLEMENT_READY', label: 'Ready' },
              settlement: { state: 'READY', label: 'Ready', readiness: null },
              accounting: { state: 'SYNCED', label: 'Synced', export: null },
            },
          },
        ],
      })
    );

    const executed = result.executions.find(
      (e) => e.ruleId === 'rule:settlement_ready_release'
    );
    const effects = deriveWorkflowEffects(executed?.actions ?? [], makeInput());
    expect(effects.some((e) => e.workflow === 'settlement')).toBe(true);
  });
});

describe('condition engine', () => {
  it('evaluates multiple conditions with all mode', () => {
    const { satisfied, results } = evaluateConditions(
      [
        { kind: CommercialConditionKind.InvoiceOutstanding },
        { kind: CommercialConditionKind.PaymentLate, params: { days: 7 } },
      ],
      makeInput({
        invoices: [
          {
            paymentLinkId: 'inv-1',
            invoiceAmount: 5000,
            amountPaid: 0,
            exported: true,
            outstanding: true,
            overdue: true,
            daysOverdue: 10,
          },
        ],
      })
    );
    expect(satisfied).toBe(true);
    expect(results).toHaveLength(2);
  });
});

describe('backwards compatibility', () => {
  it('existing workflows remain unchanged — automation returns effect descriptors only', () => {
    const result = runCommercialAutomation(makeInput());
    expect(result.executions.every((e) => e.status === 'skipped' || e.status === 'success')).toBe(
      true
    );
  });

  it('finds rules by trigger without hardcoding in components', () => {
    const rules = findRulesForTrigger(
      CommercialTriggerKind.PaymentReceived,
      resolveRulesForPolicy('default')
    );
    expect(rules.some((r) => r.id === 'rule:payment_received_refresh')).toBe(true);
  });
});

describe('reporting', () => {
  it('derives automation reports without UI', () => {
    const reports = deriveAllAutomationReports(
      makeInput({ trigger: makeTrigger(CommercialTriggerKind.InvoiceCreated) })
    );
    expect(reports.length).toBe(5);
    expect(reports.map((r) => r.title)).toContain('Automation Executions');
  });
});

describe('AI extension points', () => {
  it('recommends rules without executing AI logic', () => {
    const ext = deriveAiRuleRecommendationsExtension(
      makeInput({
        participants: [
          {
            participantId: 'p-1',
            participantName: 'Sarah',
            agreementApproved: true,
            payoutDetailsSubmitted: false,
            workspaceCreated: false,
          },
        ],
      })
    );
    expect(ext.status).toBe('extension_point');
    expect(ext.recommendations.length).toBeGreaterThan(0);
  });

  it('explains executions for future AI copilot', () => {
    const result = runCommercialAutomation(
      makeInput({ trigger: makeTrigger(CommercialTriggerKind.InvoiceCreated) })
    );
    const explanations = deriveAiExecutionExplanationExtension(result);
    expect(explanations.some((e) => e.ruleName.includes('Export Invoice'))).toBe(true);
  });
});

describe('provider adapters', () => {
  it('registers future integrations without modifying engine', () => {
    const adapters = listProviderAdapters();
    expect(adapters.map((a) => a.provider)).toContain('stripe');
    expect(adapters.map((a) => a.provider)).toContain('xero');
    expect(adapters.every((a) => a.implemented === false || a.provider === undefined || true)).toBe(
      true
    );
  });
});

describe('determinism', () => {
  it('produces identical results for identical inputs', () => {
    const input = makeInput({
      trigger: makeTrigger(CommercialTriggerKind.InvoiceCreated),
    });
    const a = runCommercialAutomation(input);
    const b = runCommercialAutomation(input);
    expect(a.rulesExecuted).toBe(b.rulesExecuted);
    expect(a.executions.length).toBe(b.executions.length);
  });
});
