import { describe, expect, it } from '@jest/globals';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { buildExportPayoutRows } from '@/components/deal-network-demo/export-payouts-modal';
import { mapReviewToParticipants } from '@/lib/ai-extractor/extraction-mapper';
import { normalizeExtractionResult } from '@/lib/ai-extractor/normalize-extraction-result';
import { PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT } from '@/lib/ai-extractor/party-linked-settlement';
import { reviewFormFromExtraction } from '@/lib/ai-extractor/review-form-types';
import { field, testParty } from '@/lib/ai-extractor/test-helpers/party-fixture';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import type { RecentDeal } from '@/lib/data/mock-deal-network';

const CLIENT_TRIGGER = 'upon approval of the event plan';

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
        dueCondition: field(CLIENT_TRIGGER),
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
        trigger: field(CLIENT_TRIGGER),
        basis: field('Client deposit to the project', 'medium'),
      },
    ],
    settlementEvents: [],
    uncertainties: [],
    overallConfidence: 'high',
    sourceHint: 'email',
    extractedAt: '2026-08-26T00:00:00.000Z',
    schemaVersion: 'v5',
    ...overrides,
  };
}

function beachDeal(payoutTrigger: string): RecentDeal {
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
    payoutTrigger,
    createdVia: 'agreement_intelligence_workflow',
  };
}

function exportSaturdayBeach(result: ExtractionResult) {
  const normalized = normalizeExtractionResult(result);
  const form = reviewFormFromExtraction(normalized, 'workflow_agreement', 'email');
  const originalsById = new Map(normalized.parties.map((party) => [party.id, party]));
  const deal = beachDeal(
    normalized.settlementRules?.[0]?.trigger.value?.trim() ??
      normalized.paymentTerms?.[0]?.dueCondition.value?.trim() ??
      'Manual'
  );
  const participants = mapReviewToParticipants(
    form,
    deal,
    originalsById,
    normalized.settlementEvents
  );
  return { deal, participants, rows: buildExportPayoutRows([deal], participants).rows };
}

function namedRows(rows: ReturnType<typeof buildExportPayoutRows>['rows']) {
  return rows.filter((row) => row.participant !== 'Rabbit Hole Platform');
}

function partnerParticipant(
  overrides: Partial<DemoParticipant> & Pick<DemoParticipant, 'id' | 'name' | 'role'>
): DemoParticipant {
  return {
    email: `${overrides.id}@example.com`,
    commissionKind: 'fixed_amount',
    commissionValue: 10_000,
    status: 'Confirmed',
    inviteToken: `tok-${overrides.id}`,
    approvalStatus: 'Approved',
    dealId: 'deal-certik-001',
    dealName: 'CertiK Security Audit',
    ...overrides,
  };
}

describe('buildExportPayoutRows — participant payout timing vs project payment trigger', () => {
  it('keeps Saturday Beach amounts and does not treat the client trigger as Sarah/Jake/Olivia payout timing', () => {
    const { deal, rows } = exportSaturdayBeach(saturdayBeachExtraction());
    const people = namedRows(rows);

    expect(deal.payoutTrigger).toBe(CLIENT_TRIGGER);
    expect(people.map((row) => [row.participant, row.payoutAmount])).toEqual([
      ['Sarah Williams', 6000],
      ['Jake Chen', 4500],
      ['Olivia Brown', 4500],
    ]);

    for (const row of people) {
      expect(row.payoutAmount).not.toBe(12500);
      expect(row.projectPaymentTrigger).toBe(CLIENT_TRIGGER);
      expect(row.payoutTrigger).toBe(PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT);
      expect(row.payoutTrigger.toLowerCase()).not.toContain(CLIENT_TRIGGER);
    }
  });

  it('exports explicitly party-owned compensation timing without copying it onto other participants', () => {
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

    const { rows } = exportSaturdayBeach(result);
    const people = namedRows(rows);
    const sarah = people.find((row) => row.participant === 'Sarah Williams');
    const jake = people.find((row) => row.participant === 'Jake Chen');
    const olivia = people.find((row) => row.participant === 'Olivia Brown');

    expect(sarah?.payoutAmount).toBe(6000);
    expect(sarah?.payoutTrigger).toBe('within 7 days after the event');
    expect(sarah?.projectPaymentTrigger).toBe(CLIENT_TRIGGER);
    expect(jake?.payoutTrigger).toBe(PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT);
    expect(olivia?.payoutTrigger).toBe(PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT);
    expect(jake?.payoutTrigger).not.toBe('within 7 days after the event');
  });

  it('exports operator-set payoutCondition as that participant’s timing', () => {
    const { deal, participants } = exportSaturdayBeach(saturdayBeachExtraction());
    const withCondition = participants.map((participant) =>
      participant.name === 'Olivia Brown'
        ? { ...participant, payoutCondition: 'on receipt of talent invoice' }
        : participant
    );

    const people = namedRows(buildExportPayoutRows([deal], withCondition).rows);
    expect(people.find((row) => row.participant === 'Olivia Brown')?.payoutTrigger).toBe(
      'on receipt of talent invoice'
    );
    expect(people.find((row) => row.participant === 'Sarah Williams')?.payoutTrigger).toBe(
      PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT
    );
  });

  it('preserves deal-level payoutTrigger on platform rows and as project payment trigger for partner deals', () => {
    const deal: RecentDeal = {
      id: 'deal-certik-001',
      dealName: 'CertiK Security Audit',
      partner: 'CertiK',
      value: 100_000,
      introducer: 'Alice',
      closer: 'Charlie',
      introducerAmount: 10_000,
      closerAmount: 5_000,
      platformFee: 5_000,
      status: 'Pending',
      lastUpdated: '2026-08-26T00:00:00.000Z',
      paymentStatus: 'Not Paid',
      payoutTrigger: 'Contract Paid',
    };

    const participants: DemoParticipant[] = [
      partnerParticipant({
        id: 'internal-introducer-deal-certik-001',
        name: 'Alice',
        role: 'Introducer',
        commissionValue: 10_000,
        payoutCondition: 'Net 14 after contract paid',
      }),
      partnerParticipant({
        id: 'internal-closer-deal-certik-001',
        name: 'Charlie',
        role: 'Closer',
        commissionValue: 5_000,
      }),
    ];

    const { rows } = buildExportPayoutRows([deal], participants);
    const platform = rows.find((row) => row.participant === 'Rabbit Hole Platform');
    const alice = rows.find((row) => row.participant === 'Alice');
    const charlie = rows.find((row) => row.participant === 'Charlie');

    expect(platform?.payoutAmount).toBe(5_000);
    expect(platform?.projectPaymentTrigger).toBe('Contract Paid');
    expect(platform?.payoutTrigger).toBe('Contract Paid');

    expect(alice?.payoutAmount).toBe(10_000);
    expect(alice?.projectPaymentTrigger).toBe('Contract Paid');
    expect(alice?.payoutTrigger).toBe('Net 14 after contract paid');

    expect(charlie?.payoutAmount).toBe(5_000);
    expect(charlie?.projectPaymentTrigger).toBe('Contract Paid');
    expect(charlie?.payoutTrigger).toBe(PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT);
    expect(charlie?.payoutTrigger).not.toBe('Contract Paid');
  });
});
