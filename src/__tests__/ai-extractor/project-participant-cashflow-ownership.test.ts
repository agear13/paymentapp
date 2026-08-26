import { buildCommercialGraph } from '@/lib/ai-extractor/commercial-graph';
import { buildSettlementEventsFromParty } from '@/lib/ai-extractor/build-settlement-events';
import { mapReviewToParticipants } from '@/lib/ai-extractor/extraction-mapper';
import { normalizeExtractionResult } from '@/lib/ai-extractor/normalize-extraction-result';
import { PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT } from '@/lib/ai-extractor/party-linked-settlement';
import { reviewFormFromExtraction } from '@/lib/ai-extractor/review-form-types';
import { field, testParty } from '@/lib/ai-extractor/test-helpers/party-fixture';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import {
  formatWorkspaceCashflowAmount,
  resolveWorkspaceInboundCashflow,
  workspaceParticipantPayables,
} from '@/lib/commercial-os/workspace-inbound-cashflow';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { buildExtractionReviewSettlementGroups } from '@/lib/journey/workflow-extraction-display.client';
import { buildConversationImportAuditRecord, appendConversationImportToDeal } from '@/lib/operations/audit/conversation-import-audit';

function saturdayBeachExtraction(overrides: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    projectName: field('Saturday Beach Event'),
    projectDescription: field('Beach event production'),
    projectValue: field(25000),
    currency: field('AUD'),
    counterparty: field('Apex Promotions Pty Ltd'),
    parties: [
      testParty({
        id: 'sarah',
        name: field('Sarah Williams'),
        role: field('Producer'),
        participationModel: field('fixed_payout'),
        fixedAmount: field(6000),
        revenueSharePct: field(null, 'absent'),
        compensationTerms: [],
        notes: field(null, 'absent'),
      }),
      testParty({
        id: 'jake',
        name: field('Jake Chen'),
        role: field('Talent'),
        participationModel: field('fixed_payout'),
        fixedAmount: field(4500),
        revenueSharePct: field(null, 'absent'),
        compensationTerms: [],
        notes: field(null, 'absent'),
      }),
      testParty({
        id: 'olivia',
        name: field('Olivia Brown'),
        role: field('Talent'),
        participationModel: field('fixed_payout'),
        fixedAmount: field(4500),
        revenueSharePct: field(null, 'absent'),
        compensationTerms: [],
        notes: field(null, 'absent'),
      }),
    ],
    paymentTerms: [
      {
        description: field('50% deposit'),
        amount: field(12500),
        currency: field('AUD'),
        dueCondition: field('upon approval of the event plan'),
      },
      {
        description: field('50% final payment'),
        amount: field(12500),
        currency: field('AUD'),
        dueCondition: field('within 14 days after completion'),
      },
    ],
    settlementRules: [
      {
        trigger: field('upon approval of the event plan'),
        basis: field('Client deposit to the project', 'medium'),
      },
    ],
    settlementEvents: [],
    uncertainties: [
      {
        field: 'parties[sarah].settlementTiming',
        issue: 'Individual participant payment timing is not stated in the agreement.',
      },
    ],
    overallConfidence: 'high',
    sourceHint: 'email',
    extractedAt: '2026-08-26T00:00:00.000Z',
    schemaVersion: 'v5',
    ...overrides,
  };
}

function beachDeal(): RecentDeal {
  return {
    id: 'aiwf-saturday-beach',
    dealName: 'Saturday Beach Event',
    partner: 'Apex Promotions Pty Ltd',
    value: 25000,
    introducer: '',
    closer: '',
    status: 'Pending',
    lastUpdated: '2026-08-26T00:00:00.000Z',
    paymentStatus: 'Not Paid',
    projectValueCurrency: 'AUD',
  };
}

describe('Saturday Beach — project cashflow vs participant settlement', () => {
  it('review groups keep client instalments on the project and leave participant timing unresolved', () => {
    const result = normalizeExtractionResult(saturdayBeachExtraction());
    const groups = buildExtractionReviewSettlementGroups(result, (amount) => `A$${amount.toLocaleString('en-AU')}`);

    const project = groups.find((group) => group.kind === 'project_cashflow');
    expect(project).toBeDefined();
    expect(project?.partyName).toBe('Apex Promotions Pty Ltd → Saturday Beach Event');
    expect(project?.rows).toHaveLength(2);
    expect(project?.rows?.map((row) => row.amountLabel)).toEqual(['A$12,500', 'A$12,500']);

    const sarah = groups.find((group) => group.partyName === 'Sarah Williams');
    const jake = groups.find((group) => group.partyName === 'Jake Chen');
    const olivia = groups.find((group) => group.partyName === 'Olivia Brown');

    expect(sarah?.kind).toBe('unresolved_timing');
    expect(sarah?.entitlementLabel).toBe('A$6,000 fixed fee');
    expect(sarah?.timingNote).toBe(PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT);

    expect(jake?.entitlementLabel).toBe('A$4,500 fixed fee');
    expect(jake?.timingNote).toBe(PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT);
    expect(olivia?.entitlementLabel).toBe('A$4,500 fixed fee');
    expect(olivia?.timingNote).toBe(PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT);

    for (const group of [sarah, jake, olivia]) {
      const blob = JSON.stringify(group);
      expect(blob).not.toContain('12500');
      expect(blob).not.toContain('12,500');
      expect(blob).not.toContain('upon approval of the event plan');
    }
  });

  it('does not copy client due conditions onto participant settlement events during normalize', () => {
    const result = normalizeExtractionResult(saturdayBeachExtraction());
    expect(result.uncertainties.some((item) => item.field.includes('settlementTiming'))).toBe(true);

    for (const event of result.settlementEvents ?? []) {
      expect(event.amount.value).not.toBe(12500);
      expect(event.trigger.value).toBeNull();
      expect(event.trigger.value).not.toBe('upon approval of the event plan');
      expect(event.trigger.value).not.toBe('within 14 days after completion');
    }

    const amounts = (result.settlementEvents ?? []).map((event) => event.amount.value).sort();
    expect(amounts).toEqual([4500, 4500, 6000]);
  });

  it('does not use unlinked paymentTerms as every party settlement trigger', () => {
    const result = saturdayBeachExtraction();
    for (const party of result.parties) {
      const events = buildSettlementEventsFromParty(party, result);
      expect(events[0]?.amount.value).toBe(party.fixedAmount.value);
      expect(events[0]?.trigger.value).toBeNull();
    }
  });

  it('keeps participant payables at extracted fees through review mapping', () => {
    const result = normalizeExtractionResult(saturdayBeachExtraction());
    const form = reviewFormFromExtraction(result, 'workflow_agreement', 'email');
    const originalsById = new Map(result.parties.map((party) => [party.id, party]));
    const participants = mapReviewToParticipants(form, beachDeal(), originalsById, result.settlementEvents);

    expect(participants.map((p) => [p.name, p.commissionKind, p.commissionValue])).toEqual([
      ['Sarah Williams', 'fixed_amount', 6000],
      ['Jake Chen', 'fixed_amount', 4500],
      ['Olivia Brown', 'fixed_amount', 4500],
    ]);

    for (const participant of participants) {
      const events = participant.extractedObligations?.settlementEvents ?? [];
      expect(events.some((event) => event.amount === 12500)).toBe(false);
      expect(events.every((event) => event.trigger == null)).toBe(true);
    }
  });

  it('commercial graph stores project cashflow separately and does not copy client rules onto cards', () => {
    const result = normalizeExtractionResult(saturdayBeachExtraction());
    const graph = buildCommercialGraph(result);

    expect(graph.projectCashflow?.entries).toHaveLength(2);
    expect(graph.projectCashflow?.entries.map((entry) => entry.amount)).toEqual([12500, 12500]);
    expect(graph.projectCashflow?.counterparty).toBe('Apex Promotions Pty Ltd');

    for (const card of graph.participantCards) {
      expect(card.settlementRules).not.toContain('upon approval of the event plan');
      expect(card.settlementSchedule).toEqual([]);
      const blob = card.fixedPayments.join(' ');
      expect(blob).not.toMatch(/12,?500/);
    }

    expect(
      graph.settlementSchedule.every((entry) =>
        entry.settlementTriggers.includes('Settlement timing not explicitly captured')
      )
    ).toBe(true);

    const sarah = graph.participantCards.find((card) => card.name === 'Sarah Williams');
    expect(sarah?.fixedPayments.join(' ')).toMatch(/6,?000/);
  });

  it('workspace inbound cashflow stays separate from participant payables', () => {
    const result = normalizeExtractionResult(saturdayBeachExtraction());
    const form = reviewFormFromExtraction(result, 'workflow_agreement', 'email');
    const originalsById = new Map(result.parties.map((party) => [party.id, party]));
    const deal = beachDeal();
    const participants = mapReviewToParticipants(form, deal, originalsById, result.settlementEvents);
    const audit = buildConversationImportAuditRecord({
      form,
      result,
      entryPoint: 'workflow_agreement',
      sourceType: 'email',
    });
    const persisted = appendConversationImportToDeal(deal, audit);

    const inbound = resolveWorkspaceInboundCashflow(persisted);
    expect(inbound?.entries.map((entry) => entry.amount)).toEqual([12500, 12500]);

    const payables = workspaceParticipantPayables(participants);
    expect(payables).toEqual([
      { name: 'Sarah Williams', amount: 6000 },
      { name: 'Jake Chen', amount: 4500 },
      { name: 'Olivia Brown', amount: 4500 },
    ]);
    expect(payables.some((row) => row.amount === 12500)).toBe(false);
    expect(formatWorkspaceCashflowAmount(12500, 'AUD')).toBe('A$12,500');
  });

  it('still attaches a schedule that explicitly names the participant', () => {
    const result = normalizeExtractionResult(
      saturdayBeachExtraction({
        paymentTerms: [
          {
            description: field('50% deposit'),
            amount: field(12500),
            currency: field('AUD'),
            dueCondition: field('upon approval of the event plan'),
          },
          {
            description: field('Sarah Williams production fee on delivery'),
            amount: field(6000),
            currency: field('AUD'),
            dueCondition: field('within 7 days after the event'),
          },
        ],
      })
    );

    const groups = buildExtractionReviewSettlementGroups(result, (amount) => `A$${amount.toLocaleString('en-AU')}`);
    const sarah = groups.find((group) => group.partyName === 'Sarah Williams');
    expect(sarah?.kind).toBe('payment_schedule');
    expect(sarah?.rows?.some((row) => row.amountLabel === 'A$6,000')).toBe(true);
    expect(sarah?.rows?.some((row) => row.trigger === 'within 7 days after the event')).toBe(true);
    expect(sarah?.rows?.some((row) => row.amountLabel === 'A$12,500')).toBe(false);

    const jake = groups.find((group) => group.partyName === 'Jake Chen');
    expect(jake?.kind).toBe('unresolved_timing');
    expect(jake?.timingNote).toBe(PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT);
  });

  it('preserves a participant compensation trigger that was extracted on that party', () => {
    const result = saturdayBeachExtraction();
    result.parties[0] = {
      ...result.parties[0]!,
      compensationTerms: [
        {
          id: 'sarah-fixed',
          type: 'fixed_fee',
          label: field('Production fee'),
          amount: field(6000),
          percentage: field(null, 'absent'),
          trigger: field('within 7 days after the event'),
          deadline: field(null, 'absent'),
          revenueBasis: field(null, 'absent'),
          sequenceIndex: 1,
          confidence: 'high',
        },
      ],
    };

    const normalized = normalizeExtractionResult(result);
    const sarahEvents = (normalized.settlementEvents ?? []).filter(
      (event) => event.partyId.value === 'sarah',
    );
    expect(sarahEvents[0]?.trigger.value).toBe('within 7 days after the event');

    const jakeEvents = (normalized.settlementEvents ?? []).filter(
      (event) => event.partyId.value === 'jake',
    );
    expect(jakeEvents[0]?.trigger.value).toBeNull();

    const groups = buildExtractionReviewSettlementGroups(normalized, (amount) => `A$${amount.toLocaleString('en-AU')}`);
    const sarah = groups.find((group) => group.partyName === 'Sarah Williams');
    expect(sarah?.kind).toBe('payment_schedule');
    expect(sarah?.rows?.[0]?.trigger).toBe('within 7 days after the event');
  });
});
