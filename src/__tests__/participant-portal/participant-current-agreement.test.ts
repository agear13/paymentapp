import { attachAgreementVersion, createAgreementVersion } from '@/lib/agreements/agreement-presentation';
import { mapSinglePartyToParticipant } from '@/lib/ai-extractor/extraction-mapper';
import { field, testParty } from '@/lib/ai-extractor/test-helpers/party-fixture';
import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import { deriveParticipantCommercialWorkspace } from '@/lib/participant-portal/participant-portal-data';
import { deriveParticipantPortalIntelligence } from '@/lib/participant-portal/participant-portal-intelligence';
import { deriveParticipantSettlementExplanation } from '@/lib/participant-portal/participant-settlement-explanation';
import {
  containsInternalExtractionMetadata,
  currentAgreementScheduleFromParticipant,
  deriveParticipantRelationshipEarnings,
  partitionPortalObligations,
  resolveParticipantAgreementTitle,
  resolveParticipantContractingParty,
  resolveParticipantFacingRole,
  sanitizeParticipantFacingCommercialText,
} from '@/lib/participant-portal/participant-current-agreement';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { ParticipantPortalContext } from '@/lib/participant-portal/participant-portal-types';
import type { ReviewedParty } from '@/lib/ai-extractor/review-form-types';

const currentDeal: RecentDeal = {
  id: 'aiwf-abc-retail',
  dealName: 'Commercial Supply Agreement — ABC Retail Pty Ltd / Acme Supply Indonesia',
  partner: 'ABC Retail Pty Ltd',
  value: 100_000,
  introducer: '',
  closer: '',
  status: 'Approved',
  lastUpdated: '2026-09-18',
  paymentStatus: 'Not Paid',
  projectValueCurrency: 'AUD',
  createdVia: 'agreement_intelligence_workflow',
};

const emptyGraph = {
  serviceCategories: [] as const,
  deliverables: [] as const,
  operationalObligations: [] as const,
  commercialDependencies: [] as const,
  fixedObligations: [] as const,
  revenueShareObligations: [] as const,
  conditionalPayments: [] as const,
  settlementEvents: [] as const,
};

function sequenceMilestones() {
  return [1, 2, 3, 4].map((index) => ({
    id: `ms-${index}`,
    type: 'milestone' as const,
    label: `Milestone ${index}`,
    amount: index,
    percentage: null,
    trigger: 'Payable within 30 days of invoice',
    confidence: 'high' as const,
  }));
}

function returningSupplier(overrides: Record<string, unknown> = {}) {
  const base = buildProjectParticipant({
    name: 'Acme Supply Indonesia',
    role: 'Contributor',
    project: currentDeal,
    participationModel: 'fixed_payout',
    commissionKind: 'fixed_amount',
    commissionValue: 25_000,
    enableCustomerAttribution: false,
  });
  return {
    ...base,
    role: 'Contributor' as const,
    roleLabel: 'Supplier',
    approvalStatus: 'Approved' as const,
    approvedAt: '2026-09-18T00:00:00.000Z',
    participantNotes:
      '[AI Import: Other · v5] | No early-payment discount or incentive included in the current agreement.',
    roleDetails:
      '[AI Import: Other · v5] | Payment by bank transfer. No early-payment discount or incentive included.',
    extractedObligations: {
      ...emptyGraph,
      compensationTerms: sequenceMilestones(),
    },
    supplierOnboarding: {
      lifecycle: 'SUBMITTED' as const,
      events: [],
      submission: { submittedAt: '2026-09-18T12:00:00.000Z' },
    },
    ...overrides,
  };
}

function mixedHistoryContext(): ParticipantPortalContext {
  return {
    obligations: [
      {
        id: 'hist-1',
        dealId: 'rmwf-hospitality',
        status: 'PAID',
        amountOwed: 2_000,
        currency: 'AUD',
        dueDate: null,
        explanation: 'Fixed amount',
      },
      {
        id: 'hist-2',
        dealId: 'rmwf-hospitality',
        status: 'PAID',
        amountOwed: 2_125_000,
        currency: 'AUD',
        dueDate: null,
        explanation: 'Fixed amount',
      },
      {
        id: 'cur-1',
        dealId: currentDeal.id,
        status: 'APPROVED',
        amountOwed: 25_000,
        currency: 'AUD',
        dueDate: null,
        explanation: 'Fixed amount',
      },
      {
        id: 'cur-2',
        dealId: currentDeal.id,
        status: 'APPROVED',
        amountOwed: 25_000,
        currency: 'AUD',
        dueDate: null,
        explanation: 'Fixed amount',
      },
    ],
    attributionActivity: null,
    syncedAt: '2026-09-18T12:00:00.000Z',
  };
}

describe('participant current-agreement adapter', () => {
  it('uses the current agreement title, not a stale Hospitality affiliate title', () => {
    const participant = attachAgreementVersion(
      returningSupplier(),
      createAgreementVersion({
        participant: returningSupplier(),
        branding: {
          organizationName: 'Hospitality',
          legalName: 'Hospitality',
          logoUrl: null,
          logoSource: null,
        },
      })
    );
    expect(participant.agreementVersions?.[0]?.title).toBe('Hospitality Affiliate Agreement');
    expect(resolveParticipantAgreementTitle(currentDeal, participant)).toBe(currentDeal.dealName);
    const ws = deriveParticipantCommercialWorkspace(participant, currentDeal, mixedHistoryContext());
    expect(ws.projectName).toBe(currentDeal.dealName);
    expect(ws.projectName).not.toMatch(/Hospitality Affiliate Agreement/);
  });

  it('uses the canonical contracting party, not the operator Hospitality org', () => {
    const ws = deriveParticipantCommercialWorkspace(
      returningSupplier(),
      currentDeal,
      mixedHistoryContext()
    );
    expect(resolveParticipantContractingParty(currentDeal, returningSupplier())).toBe(
      'ABC Retail Pty Ltd'
    );
    expect(ws.contractingParty).toBe('ABC Retail Pty Ltd');
    expect(ws.contractingParty).not.toBe('Hospitality');
  });

  it('strips internal AI extraction metadata from participant-facing copy', () => {
    const notes =
      '[AI Import: Other · v5] | No early-payment discount or incentive included in the current agreement.';
    expect(containsInternalExtractionMetadata(notes)).toBe(true);
    expect(sanitizeParticipantFacingCommercialText(notes)).toBe(
      'No early-payment discount or incentive included in the current agreement.'
    );
    const ws = deriveParticipantCommercialWorkspace(
      returningSupplier(),
      currentDeal,
      mixedHistoryContext()
    );
    const joined = [
      ...ws.agreement.deliverables,
      ...ws.agreement.commercialObligations,
      ...ws.agreement.termsStatements,
      ...ws.agreement.paymentEvents,
      ws.intelligence ?? '',
    ].join(' ');
    expect(joined).not.toMatch(/AI Import/i);
    expect(joined).not.toMatch(/· v5/);
    expect(joined).toMatch(/No early-payment discount or incentive/i);
  });

  it('never formats milestone identifiers as monetary amounts', () => {
    const schedule = currentAgreementScheduleFromParticipant(returningSupplier(), currentDeal);
    expect(schedule?.items.map((item) => item.amount)).toEqual([25_000, 25_000, 25_000, 25_000]);
    const ws = deriveParticipantCommercialWorkspace(
      returningSupplier(),
      currentDeal,
      mixedHistoryContext()
    );
    const rendered = [
      ...ws.commercialSections.map((section) =>
        section.kind === 'milestone' ? `${section.label} ${section.amount}` : ''
      ),
      ...ws.paymentTimeline.map((item) => `${item.title} ${item.detail ?? ''}`),
      ...ws.agreement.paymentEvents,
    ].join(' | ');
    expect(rendered).not.toMatch(/A\$[1-4](?:\.00)?(?![0-9,])/);
    expect(rendered).not.toContain('A$1.00');
    expect(rendered).not.toContain('A$2.00');
    expect(rendered).not.toContain('A$3.00');
    expect(rendered).not.toContain('A$4.00');
  });

  it('renders four current-agreement milestones at A$25,000 and total A$100,000', () => {
    const ws = deriveParticipantCommercialWorkspace(
      returningSupplier(),
      currentDeal,
      mixedHistoryContext()
    );
    const milestones = ws.commercialSections.filter((section) => section.kind === 'milestone');
    expect(milestones).toHaveLength(4);
    for (const milestone of milestones) {
      expect(milestone.kind === 'milestone' && milestone.amount).toMatch(/25,000/);
      expect(milestone.kind === 'milestone' && milestone.trigger).toMatch(/30 days of invoice/i);
    }
    expect(ws.paymentTimeline).toHaveLength(4);
    expect(ws.paymentTimeline.every((item) => /25,000/.test(item.title))).toBe(true);
    expect(ws.currentAgreementTotalLabel).toMatch(/100,000/);
    expect(ws.currentAgreementPayoutLabel).toMatch(/25,000/);
  });

  it('keeps historical earnings available without putting them on the current timeline', () => {
    const context = mixedHistoryContext();
    const { historical, currentDeal: scoped } = partitionPortalObligations(
      context.obligations,
      currentDeal.id
    );
    expect(historical.map((row) => row.amountOwed)).toEqual([2_000, 2_125_000]);
    expect(scoped.map((row) => row.amountOwed)).toEqual([25_000, 25_000]);

    const ws = deriveParticipantCommercialWorkspace(returningSupplier(), currentDeal, context);
    const timelineText = ws.paymentTimeline.map((item) => `${item.title} ${item.detail ?? ''}`).join(' ');
    expect(timelineText).not.toContain('2,000');
    expect(timelineText).not.toContain('2,125,000');
    expect(ws.relationshipEarnings.totalLabel).toMatch(/2,177,000/);
    expect(ws.relationshipEarnings.previousActivityLabel).toMatch(/2,127,000/);
    expect(ws.relationshipEarnings.thisAgreementLabel).toMatch(/25,000/);
  });

  it('does not invent a previous-activity number when history is not deal-scoped', () => {
    const unscoped: ParticipantPortalContext = {
      obligations: mixedHistoryContext().obligations.map(({ dealId: _dealId, ...row }) => row),
      attributionActivity: null,
      syncedAt: '2026-09-18T12:00:00.000Z',
    };
    const relationship = deriveParticipantRelationshipEarnings(
      unscoped.obligations,
      currentDeal.id,
      25_000,
      'AUD'
    );
    expect(relationship.totalLabel).toMatch(/2,177,000/);
    expect(relationship.thisAgreementLabel).toMatch(/25,000/);
    expect(relationship.previousActivityLabel).toBeNull();
  });

  it('keeps lifetime earnings distinct from current-agreement pending settlement', () => {
    const ws = deriveParticipantCommercialWorkspace(
      returningSupplier(),
      currentDeal,
      mixedHistoryContext()
    );
    const current = ws.performance.metrics.find((metric) => metric.field === 'current_earnings');
    const pending = ws.performance.metrics.find((metric) => metric.field === 'pending_settlement');
    expect(current?.value).toMatch(/25,000/);
    expect(current?.value).not.toMatch(/2,177,000/);
    expect(pending?.value).not.toMatch(/2,177,000/);
    expect(ws.settlement.earnedLabel ?? '').not.toMatch(/2,177,000/);
    expect(ws.settlement.pendingLabel ?? '').not.toMatch(/2,177,000/);
  });

  it('displays Supplier when that canonical role is present and does not invent one', () => {
    expect(resolveParticipantFacingRole(returningSupplier())).toBe('Supplier');
    expect(
      resolveParticipantFacingRole(
        returningSupplier({ roleLabel: undefined, role: 'Contributor' })
      )
    ).toBe('Contributor');
    const reviewed: ReviewedParty = {
      id: 'acme-supply',
      name: 'Acme Supply Indonesia',
      email: '',
      role: 'Supplier',
      notes: '',
      participationModel: 'fixed_payout',
      fixedAmount: 25_000,
      revenueSharePct: null,
      deliverables: [],
      milestones: [],
    };
    const mapped = mapSinglePartyToParticipant(
      reviewed,
      currentDeal,
      '[AI Import: Other · v5]',
      testParty({
        id: 'acme-supply',
        name: field('Acme Supply Indonesia'),
        role: field('Supplier'),
        compensationTerms: [1, 2, 3, 4].map((index) => ({
          id: `ms-${index}`,
          type: 'milestone',
          label: field(`Milestone ${index}`),
          amount: field(index),
          percentage: field(null, 'absent'),
          trigger: field('Payable within 30 days of invoice'),
          deadline: field(null, 'absent'),
          revenueBasis: field(null, 'absent'),
          sequenceIndex: index,
          confidence: 'high',
        })),
      })
    );
    expect(mapped.roleLabel).toBe('Supplier');
    expect(resolveParticipantFacingRole(mapped)).toBe('Supplier');
  });

  it('does not tell an already-approved participant to review the agreement again', () => {
    const participant = returningSupplier();
    const ws = deriveParticipantCommercialWorkspace(participant, currentDeal, mixedHistoryContext());
    expect(ws.agreementStatus).toBe('approved');
    expect(ws.settlement.nextStep).not.toMatch(/review and approve your agreement/i);
    expect(ws.settlement.nextStep).toMatch(/organiser is verifying/i);
    const intelligence = deriveParticipantPortalIntelligence(
      participant,
      currentDeal,
      ws.settlement,
      ws.performance
    );
    expect(intelligence ?? '').not.toMatch(/review and approve your agreement/i);
    expect(ws.settlement.statusLabel).toMatch(/payout details submitted/i);
  });

  it('keeps existing referral workflows on their own project title and earnings', () => {
    const referralDeal: RecentDeal = {
      id: 'proj-fest',
      dealName: 'Summer Festival',
      partner: 'Acme Events',
      value: 100_000,
      introducer: 'Alice',
      closer: 'Bob',
      status: 'Approved',
      lastUpdated: '2026-01-01',
      paymentStatus: 'Not Paid',
    };
    const promoter = buildProjectParticipant({
      name: 'Sarah',
      role: 'Promoter',
      project: referralDeal,
      participationModel: 'customer_attribution',
      commissionKind: 'pct_deal_value',
      commissionValue: 10,
      enableCustomerAttribution: true,
    });
    const ws = deriveParticipantCommercialWorkspace(promoter, referralDeal, {
      obligations: [
        {
          id: 'ob-1',
          status: 'APPROVED',
          amountOwed: 1_200,
          currency: 'AUD',
          dueDate: null,
          explanation: 'Referral commission',
        },
      ],
      attributionActivity: null,
      syncedAt: '2026-06-01T12:00:00.000Z',
    });
    expect(ws.projectName).toBe('Summer Festival');
    expect(ws.paymentTimeline.some((item) => item.detail?.includes('1,200'))).toBe(true);
    expect(ws.performance.metrics.find((metric) => metric.field === 'current_earnings')?.value).not.toBe(
      '—'
    );
  });
});

describe('deriveParticipantSettlementExplanation current-state', () => {
  it('keeps payout-details verification as the next step after approval', () => {
    const explanation = deriveParticipantSettlementExplanation(
      returningSupplier(),
      mixedHistoryContext().obligations,
      { currentAgreementObligations: [] }
    );
    expect(explanation.nextStep).toMatch(/organiser is verifying/i);
    expect(explanation.nextStep).not.toMatch(/review and approve/i);
    expect(explanation.payoutDetailsRequired).toBe(false);
  });
});
