import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import { deriveParticipantCommercialWorkspace } from '@/lib/participant-portal/participant-portal-data';
import { deriveParticipantPortalIntelligence } from '@/lib/participant-portal/participant-portal-intelligence';
import { deriveParticipantSettlementExplanation } from '@/lib/participant-portal/participant-settlement-explanation';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { applyCompensationProfileToParticipant } from '@/lib/participants/participant-compensation';
import type { ParticipantPortalContext } from '@/lib/participant-portal/participant-portal-types';

const deal: RecentDeal = {
  id: 'proj-test-1',
  dealName: 'Summer Festival',
  partner: 'Acme Events',
  value: 100000,
  introducer: 'Alice',
  closer: 'Bob',
  status: 'Approved',
  lastUpdated: '2026-01-01',
  paymentStatus: 'Not Paid',
};

const emptyContext: ParticipantPortalContext = {
  obligations: [],
  attributionActivity: null,
  syncedAt: '2026-06-01T12:00:00.000Z',
};

describe('deriveParticipantCommercialWorkspace', () => {
  it('includes portal token on newly built participants', () => {
    const p = buildProjectParticipant({
      name: 'Sarah',
      email: 'sarah@example.com',
      role: 'Promoter',
      project: deal,
      participationModel: 'customer_attribution',
      commissionKind: 'pct_deal_value',
      commissionValue: 10,
      enableCustomerAttribution: true,
    });
    expect(p.participantPortalToken).toBeTruthy();
  });

  it('renders commission commercial summary for manual participants', () => {
    const p = buildProjectParticipant({
      name: 'Sarah',
      role: 'Promoter',
      project: deal,
      participationModel: 'customer_attribution',
      commissionKind: 'pct_deal_value',
      commissionValue: 10,
      enableCustomerAttribution: true,
    });
    const withProfile = applyCompensationProfileToParticipant(p, {
      compensationType: 'COMMISSION',
      percentage: 10,
      configured: true,
      customerAttributionEnabled: true,
    });
    const ws = deriveParticipantCommercialWorkspace(withProfile, deal, emptyContext);
    expect(ws.participantName).toBe('Sarah');
    expect(ws.commercialState).toBe('INVITED');
    expect(ws.commercialSections.some((s) => s.kind === 'commission')).toBe(true);
    expect(ws.agreementStatus).toBe('draft');
    expect(ws.performance.metrics.some((m) => m.field === 'promo_code')).toBe(false);
  });

  it('shows approved status when agreement accepted', () => {
    const p = buildProjectParticipant({
      name: 'Sarah',
      role: 'Promoter',
      project: deal,
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 1200,
      enableCustomerAttribution: false,
    });
    const approved = {
      ...p,
      approvalStatus: 'Approved' as const,
      approvedAt: '2026-06-01T00:00:00.000Z',
    };
    const ws = deriveParticipantCommercialWorkspace(approved, deal, emptyContext);
    expect(ws.agreementStatus).toBe('approved');
    expect(ws.lifecycleSteps.find((s) => s.id === 'agreement_accepted')?.status).toBe('complete');
  });

  it('derives earnings from obligation snapshots', () => {
    const p = buildProjectParticipant({
      name: 'Sarah',
      role: 'Promoter',
      project: deal,
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 1200,
      enableCustomerAttribution: false,
    });
    const context: ParticipantPortalContext = {
      obligations: [
        {
          id: 'ob-1',
          status: 'APPROVED',
          amountOwed: 1200,
          currency: 'AUD',
          dueDate: null,
          explanation: 'Fixed fee',
        },
        {
          id: 'ob-2',
          status: 'PAID',
          amountOwed: 500,
          currency: 'AUD',
          dueDate: null,
          explanation: 'Prior payment',
        },
      ],
      attributionActivity: null,
      syncedAt: '2026-06-01T12:00:00.000Z',
    };
    const ws = deriveParticipantCommercialWorkspace(p, deal, context);
    const current = ws.performance.metrics.find((m) => m.field === 'current_earnings');
    const paid = ws.performance.metrics.find((m) => m.field === 'paid_to_date');
    expect(current?.value).not.toBe('—');
    expect(paid?.value).not.toBe('—');
  });

  it('includes AI extracted obligations in agreement overview', () => {
    const p = buildProjectParticipant({
      name: 'Sarah',
      role: 'Promoter',
      project: deal,
      participationModel: 'revenue_share',
      commissionKind: 'pct_deal_value',
      commissionValue: 15,
      enableCustomerAttribution: false,
    });
    const withExtraction = {
      ...p,
      extractedObligations: {
        serviceCategories: [],
        deliverables: [{ description: 'Promote event on social channels', category: null, confidence: 'high' as const }],
        operationalObligations: [],
        compensationTerms: [],
        commercialDependencies: [],
        fixedObligations: [],
        revenueShareObligations: [],
        conditionalPayments: [],
        settlementEvents: [
          {
            type: 'revenue_share' as const,
            amount: null,
            percentage: 15,
            trigger: '7 days after event',
            condition: null,
          },
        ],
      },
    };
    const ws = deriveParticipantCommercialWorkspace(withExtraction, deal, emptyContext);
    expect(ws.agreement.deliverables).toContain('Promote event on social channels');
    expect(ws.paymentTimeline.length).toBeGreaterThan(0);
  });
});

describe('deriveParticipantPortalIntelligence', () => {
  it('describes commission with promo code without inventing data', () => {
    const p = buildProjectParticipant({
      name: 'Sarah',
      role: 'Promoter',
      project: deal,
      participationModel: 'customer_attribution',
      commissionKind: 'pct_deal_value',
      commissionValue: 10,
      enableCustomerAttribution: true,
    });
    const withCode = {
      ...applyCompensationProfileToParticipant(p, {
        compensationType: 'COMMISSION',
        percentage: 10,
        configured: true,
        customerAttributionEnabled: true,
      }),
      referralCode: 'SARAH10',
    };
    const settlement = deriveParticipantSettlementExplanation(withCode, []);
    const ws = deriveParticipantCommercialWorkspace(withCode, deal, emptyContext);
    const text = deriveParticipantPortalIntelligence(withCode, deal, settlement, ws.performance);
    expect(text).toContain('10%');
    expect(text).toContain('SARAH10');
  });
});

describe('deriveParticipantSettlementExplanation', () => {
  it('explains blocked settlement when agreement not accepted', () => {
    const p = buildProjectParticipant({
      name: 'Alex',
      role: 'Promoter',
      project: deal,
      participationModel: 'customer_attribution',
      commissionKind: 'pct_deal_value',
      commissionValue: 10,
      enableCustomerAttribution: true,
    });
    const explanation = deriveParticipantSettlementExplanation(p, []);
    expect(explanation.isBlocked).toBe(true);
    expect(explanation.blockingReason).toMatch(/agreement/i);
  });
});
