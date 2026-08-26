import { describe, expect, it } from '@jest/globals';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { mapReviewToParticipants } from '@/lib/ai-extractor/extraction-mapper';
import { normalizeExtractionResult } from '@/lib/ai-extractor/normalize-extraction-result';
import { PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT } from '@/lib/ai-extractor/party-linked-settlement';
import { reviewFormFromExtraction } from '@/lib/ai-extractor/review-form-types';
import { field, testParty } from '@/lib/ai-extractor/test-helpers/party-fixture';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  applyAgreementInvoicePrefillToDraft,
  buildAgreementInvoicePrefill,
  parsePartyOwnedCalendarDate,
} from '@/lib/invoices/agreement-invoice-prefill';
import { defaultCommercialDealDraft } from '@/lib/commercial-os/commercial-deal-draft';

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

function saturdayBeachParticipants(result: ExtractionResult = saturdayBeachExtraction()) {
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
  return { deal, participants };
}

function named(participants: DemoParticipant[], name: string): DemoParticipant {
  const match = participants.find((participant) => participant.name === name);
  if (!match) throw new Error(`Missing participant ${name}`);
  return match;
}

describe('buildAgreementInvoicePrefill — Saturday Beach ownership', () => {
  it('prefills Sarah at A$6,000 and never copies project cashflow A$12,500 / A$25,000', () => {
    const { deal, participants } = saturdayBeachParticipants();
    const sarah = named(participants, 'Sarah Williams');
    const prefill = buildAgreementInvoicePrefill({ participant: sarah, deal });

    expect(deal.value).toBe(25000);
    expect(deal.payoutTrigger).toBe(CLIENT_TRIGGER);
    expect(prefill.compensationKind).toBe('fixed');
    expect(prefill.amount).toBe(6000);
    expect(prefill.currency).toBe('AUD');
    expect(prefill.customerName).toBe('Apex Promotions Pty Ltd');
    expect(prefill.projectName).toBe('Saturday Beach Event');
    expect(prefill.description).toContain('Saturday Beach Event');
    expect(prefill.amount).not.toBe(12500);
    expect(prefill.amount).not.toBe(25000);
    expect(JSON.stringify(prefill)).not.toContain('12500');
    expect(JSON.stringify(prefill)).not.toContain('25000');
  });

  it('keeps unresolved participant timing unresolved and ignores the project/client trigger', () => {
    const { deal, participants } = saturdayBeachParticipants();
    const sarah = named(participants, 'Sarah Williams');
    const prefill = buildAgreementInvoicePrefill({ participant: sarah, deal });

    expect(prefill.timingUnresolved).toBe(true);
    expect(prefill.dueDate).toBeUndefined();
    expect(prefill.paymentTimingNote).toBe(PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT);
    expect(prefill.paymentTimingNote?.toLowerCase()).not.toContain(CLIENT_TRIGGER);
  });

  it('prefills a party-owned calendar due date without inventing +14 days', () => {
    const { deal, participants } = saturdayBeachParticipants();
    const sarah = {
      ...named(participants, 'Sarah Williams'),
      payoutDueDate: '2026-10-01',
    };
    const prefill = buildAgreementInvoicePrefill({ participant: sarah, deal });

    expect(prefill.timingUnresolved).toBe(false);
    expect(prefill.dueDate).toBe('2026-10-01');
    expect(prefill.amount).toBe(6000);
  });

  it('records party-owned narrative timing without turning it into a due date', () => {
    const { deal, participants } = saturdayBeachParticipants();
    const sarah = {
      ...named(participants, 'Sarah Williams'),
      payoutCondition: 'within 7 days after the event',
    };
    const prefill = buildAgreementInvoicePrefill({ participant: sarah, deal });

    expect(prefill.timingUnresolved).toBe(false);
    expect(prefill.dueDate).toBeUndefined();
    expect(prefill.paymentTimingNote).toBe('within 7 days after the event');
    expect(prefill.paymentTimingNote?.toLowerCase()).not.toContain(CLIENT_TRIGGER);
  });

  it('leaves revenue-share amount blank and does not invent from project value', () => {
    const { deal } = saturdayBeachParticipants();
    const promoter: DemoParticipant = {
      id: 'p-revshare',
      name: 'River Promoter',
      email: 'river@example.com',
      role: 'Introducer',
      commissionKind: 'pct_deal_value',
      commissionValue: 10,
      status: 'Confirmed',
      inviteToken: 'tok-revshare',
      approvalStatus: 'Approved',
      participationModel: 'revenue_share',
      compensationProfile: {
        compensationType: 'REVENUE_SHARE',
        percentage: 10,
        configured: true,
      },
    };
    const prefill = buildAgreementInvoicePrefill({ participant: promoter, deal });

    expect(prefill.compensationKind).toBe('variable');
    expect(prefill.amount).toBeUndefined();
    expect(prefill.customerName).toBe('Apex Promotions Pty Ltd');
    expect(prefill.projectName).toBe('Saturday Beach Event');
    expect(prefill.amount).not.toBe(25000);
    expect(prefill.amount).not.toBe(12500);
    expect(prefill.amount).not.toBe(2500);
  });

  it('does not invent a hybrid amount from the fixed component or client instalments', () => {
    const { deal } = saturdayBeachParticipants();
    const hybrid: DemoParticipant = {
      id: 'p-hybrid',
      name: 'Hybrid Talent',
      email: 'hybrid@example.com',
      role: 'Contributor',
      commissionKind: 'fixed_amount',
      commissionValue: 6000,
      status: 'Confirmed',
      inviteToken: 'tok-hybrid',
      approvalStatus: 'Approved',
      compensationProfile: {
        compensationType: 'HYBRID',
        fixedAmount: 6000,
        percentage: 5,
        configured: true,
      },
    };
    const prefill = buildAgreementInvoicePrefill({ participant: hybrid, deal });

    expect(prefill.compensationKind).toBe('variable');
    expect(prefill.amount).toBeUndefined();
  });
});

describe('agreement-origin draft application', () => {
  it('wipes the blank-invoice +14 due date when timing is unresolved', () => {
    const blank = defaultCommercialDealDraft('AUD');
    expect(blank.dueDate).toBeInstanceOf(Date);
    const days = Math.round(
      ((blank.dueDate!.getTime() - blank.invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    expect(days).toBe(14);

    const applied = applyAgreementInvoicePrefillToDraft(
      {
        origin: 'participant_portal',
        compensationKind: 'fixed',
        amount: 6000,
        currency: 'AUD',
        customerName: 'Apex Promotions Pty Ltd',
        description: 'Producer fee — Saturday Beach Event',
        projectName: 'Saturday Beach Event',
        agreementReference: 'aiwf-saturday-beach',
        dueDate: undefined,
        paymentTimingNote: PAYMENT_TIMING_NOT_SPECIFIED_IN_AGREEMENT,
        timingUnresolved: true,
        originParticipantId: 'sarah',
        originDealId: 'aiwf-saturday-beach',
        originSourceOrganizationId: undefined,
      },
      blank
    );

    expect(applied.amount).toBe(6000);
    expect(applied.customerName).toBe('Apex Promotions Pty Ltd');
    expect(applied.dueDate).toBeUndefined();
  });

  it('does not parse narrative payment terms as calendar dates', () => {
    expect(parsePartyOwnedCalendarDate(CLIENT_TRIGGER)).toBeUndefined();
    expect(parsePartyOwnedCalendarDate('within 14 days after completion')).toBeUndefined();
    expect(parsePartyOwnedCalendarDate('2026-09-15')).toBe('2026-09-15');
  });
});
