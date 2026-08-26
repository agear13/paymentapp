import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import {
  buildWorkflowPaymentScheduleRows,
  buildWorkflowExecutiveSummary,
  buildExtractionReviewSettlementGroups,
  deriveWorkflowSettlementReadinessDisplay,
} from '@/lib/journey/workflow-extraction-display.client';
import { buildExtractionReadiness } from '@/lib/ai-extractor/extraction-readiness';

function field<T>(value: T) {
  return { value, confidence: 'high' as const };
}

function baseResult(overrides: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    parties: [
      {
        id: 'p-1',
        name: field('Northside Venue'),
        email: field('venue@example.com'),
        role: field('Venue'),
        participationModel: field('fixed_payout'),
        fixedAmount: field(null),
        revenueSharePct: field(null),
        compensationTerms: [],
        milestones: [],
        conditionalPayments: [],
        dependencies: [],
        serviceCategories: field([]),
        notes: field(null),
      },
    ],
    projectValue: field(1500),
    currency: field('AUD'),
    paymentTerms: [],
    settlementEvents: [],
    settlementRules: [],
    uncertainties: [],
    overallConfidence: 'high',
    sourceHint: 'whatsapp',
    extractedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  } as ExtractionResult;
}

describe('buildWorkflowPaymentScheduleRows', () => {
  it('renders percentage payment terms with calculated dollar amounts', () => {
    const result = baseResult({
      paymentTerms: [
        {
          description: field('Deposit'),
          amount: field(30),
          currency: field('AUD'),
          dueCondition: field('Upon agreement approval'),
        },
        {
          description: field('Milestone tranche'),
          amount: field(40),
          currency: field('AUD'),
          dueCondition: field('When 2,000 paid and validated ticket sales have been reached'),
        },
        {
          description: field('Final balance'),
          amount: field(30),
          currency: field('AUD'),
          dueCondition: field('Within 48 hours after the event'),
        },
      ],
    });

    const rows = buildWorkflowPaymentScheduleRows(result, (amount) => `A$${amount}`);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.title).toBe('30% Deposit');
    expect(rows[0]?.amountLabel).toBe('A$450');
    expect(rows[0]?.phase).toBe('deposit');
    expect(rows[0]?.stepLabel).toBe('Deposit');
    expect(rows[1]?.title).toBe('40% Milestone Payment');
    expect(rows[1]?.amountLabel).toBe('A$600');
    expect(rows[1]?.phase).toBe('milestone');
    expect(rows[2]?.title).toBe('30% Final Settlement');
    expect(rows[2]?.amountLabel).toBe('A$450');
    expect(rows[2]?.phase).toBe('final');
  });

  it('builds a premium executive one-liner for demo presentation', () => {
    const result = baseResult({
      projectName: field('Autonomous Reconciliation'),
      paymentTerms: [
        {
          description: field('Deposit'),
          amount: field(30),
          currency: field('AUD'),
          dueCondition: field('Upon agreement approval'),
        },
        {
          description: field('Milestone tranche'),
          amount: field(40),
          currency: field('AUD'),
          dueCondition: field('When 2,000 paid and validated ticket sales have been reached'),
        },
        {
          description: field('Final balance'),
          amount: field(30),
          currency: field('AUD'),
          dueCondition: field('Within 48 hours after the event'),
        },
      ],
    });

    const summary = buildWorkflowExecutiveSummary({
      result,
      dealName: 'Autonomous Reconciliation',
      formatMoney: (amount) => `A$${amount}`,
    });

    expect(summary.tagline).toContain('executable commercial logic');
    expect(summary.tagline).not.toContain('5 participants');
    expect(summary.narrative).toContain('deposit, milestone release, and final settlement');
  });

  it('normalizes misformatted settlement currency values as percentages', () => {
    const result = baseResult({
      settlementEvents: [
        {
          partyId: field('p-1'),
          partyName: field('Northside Venue'),
          type: field('instalment'),
          amount: field(30),
          percentage: field(null),
          trigger: field('Upon agreement approval'),
          condition: field(null),
          status: 'pending',
        },
      ],
    });

    const rows = buildWorkflowPaymentScheduleRows(result, (amount) => `A$${amount}`);
    expect(rows[0]?.title).toBe('30% Deposit');
    expect(rows[0]?.amountLabel).toBe('A$450');
  });
});

describe('buildExtractionReviewSettlementGroups', () => {
  it('shows project payment phases as project cashflow, not as a supplier settlement schedule', () => {
    const result = baseResult({
      parties: [
        {
          id: 'supplier-1',
          name: field('Northside Venue'),
          email: field('venue@example.com'),
          role: field('Venue'),
          participationModel: field('fixed_payout'),
          fixedAmount: field(null),
          revenueSharePct: field(null),
          compensationTerms: [],
          milestones: [],
          conditionalPayments: [],
          dependencies: [],
          serviceCategories: field([]),
          notes: field(null),
        },
      ],
      projectValue: field(3300),
      paymentTerms: [
        {
          description: field('Deposit'),
          amount: field(30),
          currency: field('AUD'),
          dueCondition: field('Upon agreement approval'),
        },
        {
          description: field('Milestone tranche'),
          amount: field(40),
          currency: field('AUD'),
          dueCondition: field('When 2,000 paid and validated ticket sales have been reached'),
        },
        {
          description: field('Final balance'),
          amount: field(30),
          currency: field('AUD'),
          dueCondition: field('Within 48 hours after the event'),
        },
      ],
    });

    const groups = buildExtractionReviewSettlementGroups(result, (amount) => `A$${amount}`);
    const project = groups.find((group) => group.kind === 'project_cashflow');
    expect(project).toBeDefined();
    expect(project?.rows?.[0]?.title).toBe('30% Deposit');
    expect(project?.rows?.[1]?.title).toBe('40% Milestone Payment');
    expect(project?.rows?.[2]?.title).toBe('30% Final Settlement');
    expect(project?.rows?.[0]?.amountLabel).toBe('A$990');
    expect(groups.some((group) => group.partyName === 'Northside Venue')).toBe(false);
  });

  it('shows revenue-share settlement for promoters instead of supplier instalments', () => {
    const result = baseResult({
      parties: [
        {
          id: 'supplier-1',
          name: field('Northside Venue'),
          email: field('venue@example.com'),
          role: field('Venue'),
          participationModel: field('fixed_payout'),
          fixedAmount: field(null),
          revenueSharePct: field(null),
          compensationTerms: [],
          milestones: [],
          conditionalPayments: [],
          dependencies: [],
          serviceCategories: field([]),
          notes: field(null),
        },
        {
          id: 'sarah-1',
          name: field('Sarah'),
          email: field('sarah@example.com'),
          role: field('Promoter'),
          participationModel: field('revenue_share'),
          fixedAmount: field(null),
          revenueSharePct: field(15),
          compensationTerms: [
            {
              id: 'sarah-rev',
              type: 'revenue_share',
              label: field('Promoter commission'),
              amount: field(null),
              percentage: field(15),
              revenueBasis: field('paid and validated ticket revenue'),
              trigger: field('After the event concludes'),
              deadline: field(null),
              sequenceIndex: field(null),
              confidence: 'high',
            },
          ],
          milestones: [],
          conditionalPayments: [],
          dependencies: [],
          serviceCategories: field(['MARKETING']),
          notes: field(null),
        },
      ],
      projectValue: field(3300),
      paymentTerms: [
        {
          description: field('Deposit'),
          amount: field(30),
          currency: field('AUD'),
          dueCondition: field('Upon agreement approval'),
        },
      ],
      settlementRules: [
        {
          trigger: field('After the event concludes'),
          basis: field('Commission calculated after the event and settled separately from supplier payments'),
          rawSnippet: field('Commission calculated after the event'),
        },
      ],
    });

    const groups = buildExtractionReviewSettlementGroups(result, (amount) => `A$${amount}`);
    const sarah = groups.find((group) => group.partyName === 'Sarah');
    expect(sarah?.kind).toBe('revenue_share');
    expect(sarah?.revenueShare?.headline).toBe('15% of paid and validated ticket revenue');
    expect(sarah?.revenueShare?.trigger).toBe('After the event concludes');
    expect(sarah?.revenueShare?.settlement).toContain('separately');
    expect(sarah?.rows).toBeUndefined();
    const project = groups.find((group) => group.kind === 'project_cashflow');
    expect(project).toBeDefined();
    expect(sarah?.rows).toBeUndefined();
  });
});

describe('deriveWorkflowSettlementReadinessDisplay', () => {
  it('starts at extraction readiness during review', () => {
    const result = baseResult();
    const readiness = buildExtractionReadiness(result);
    const display = deriveWorkflowSettlementReadinessDisplay({
      result: { ...result, readinessAssessment: readiness },
      stage: 'review',
    });
    expect(display.score).toBe(readiness.score);
  });

  it('reaches 100% before Pinch collection when milestone and payment setup are ready', () => {
    const result = baseResult();
    const display = deriveWorkflowSettlementReadinessDisplay({
      result,
      stage: 'collection',
      approvalsComplete: true,
      milestoneUnlocked: true,
      paymentSetupComplete: true,
    });
    expect(display.score).toBe(100);
    expect(display.label).toBe('Ready for Collection');
    expect(display.showProgressScore).toBe(false);
  });
});
