import {
  canParticipantApproveAgreement,
  deriveCanonicalAgreementState,
  agreementActionMutatesLifecycle,
} from '@/lib/operations/contracts/canonical-agreement-lifecycle';
import {
  classifyParticipantCompensation,
  compensationGeneratesObligations,
} from '@/lib/operations/contracts/compensation-classification';
import { operationalEventFromMutation } from '@/lib/operations/contracts/operational-events';
import { auditEntryFromOperationalEvent } from '@/lib/operations/audit/operational-audit';
import { assertOperationalInvariants, OperationalInvariantViolation } from '@/lib/operations/dev/operational-invariants';
import { hydrateEligibleCatalogServices } from '@/lib/operations/hydration/hydrate-eligible-catalog-services';
import { processOperationalEvent } from '@/lib/operations/orchestration/operational-event-processor';
import { deriveOperationalReadinessHierarchy } from '@/lib/operations/readiness/readiness-hierarchy';
import { deriveFundingCoordinationStage } from '@/lib/operations/truth/funding-coordination-semantics';
import {
  applyParticipantAgreementCopied,
  applyParticipantAgreementShared,
  applyParticipantAgreementViewed,
} from '@/lib/operations/lifecycle/participant-lifecycle';
import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import type { RecentDeal } from '@/lib/data/mock-deal-network';

function baseDeal(): RecentDeal {
  return {
    id: 'deal-1',
    dealName: 'Test',
    partner: 'Test',
    value: 1000,
    introducer: '—',
    closer: '—',
    status: 'Pending',
    lastUpdated: new Date().toISOString(),
    paymentStatus: 'Not Paid',
    setupStatus: 'configuring',
  } as RecentDeal;
}

function sharedParticipant() {
  const p = buildProjectParticipant({
    name: 'Alex',
    role: 'Contributor',
    project: baseDeal(),
    participationModel: 'fixed_payout',
    commissionKind: 'fixed_amount',
    commissionValue: 500,
    enableCustomerAttribution: false,
  });
  return applyParticipantAgreementShared(p);
}

describe('canonical agreement lifecycle', () => {
  it('only shared agreements can be approved', () => {
    const draft = buildProjectParticipant({
      name: 'Draft',
      role: 'Contributor',
      project: baseDeal(),
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 100,
      enableCustomerAttribution: false,
    });
    expect(canParticipantApproveAgreement(draft)).toBe(false);

    const shared = sharedParticipant();
    expect(canParticipantApproveAgreement(shared)).toBe(true);

    const viewed = applyParticipantAgreementViewed(shared);
    expect(canParticipantApproveAgreement(viewed)).toBe(true);
  });

  it('copy and view never mutate lifecycle state', () => {
    const shared = sharedParticipant();
    const copied = applyParticipantAgreementCopied(shared);
    expect(deriveCanonicalAgreementState(copied)).toBe('SHARED_FOR_APPROVAL');
    expect(agreementActionMutatesLifecycle('copy')).toBe(false);
    expect(agreementActionMutatesLifecycle('view')).toBe(false);
  });
});

describe('compensation classification', () => {
  it('distinguishes service commission from attributed referral', () => {
    const service = buildProjectParticipant({
      name: 'Service',
      role: 'Contributor',
      project: baseDeal(),
      participationModel: 'commission',
      commissionKind: 'pct_catalog',
      commissionValue: 10,
      enableCustomerAttribution: false,
      commissionServiceIds: ['svc-1'],
    });
    service.compensationProfile = {
      ...service.compensationProfile!,
      configured: true,
      compensationType: 'COMMISSION',
      commissionServiceIds: ['svc-1'],
      commissionSourceMode: 'selected',
      customerAttributionEnabled: false,
    };
    expect(classifyParticipantCompensation(service)).toBe('SERVICE_COMMISSION');

    const referral = buildProjectParticipant({
      name: 'Referral',
      role: 'Contributor',
      project: baseDeal(),
      participationModel: 'commission',
      commissionKind: 'pct_catalog',
      commissionValue: 10,
      enableCustomerAttribution: true,
      commissionServiceIds: ['svc-1'],
    });
    referral.compensationProfile = {
      ...referral.compensationProfile!,
      configured: true,
      compensationType: 'COMMISSION',
      commissionServiceIds: ['svc-1'],
      commissionSourceMode: 'selected',
      customerAttributionEnabled: true,
    };
    expect(classifyParticipantCompensation(referral)).toBe('ATTRIBUTED_REFERRAL_COMMISSION');
  });

  it('requires obligations for configured compensation', () => {
    expect(compensationGeneratesObligations('SERVICE_COMMISSION')).toBe(true);
    expect(compensationGeneratesObligations('UNCONFIGURED')).toBe(false);
  });
});

describe('readiness hierarchy', () => {
  it('blocks release when funding not settled', () => {
    const p = sharedParticipant();
    p.approvalStatus = 'Approved';
    p.payoutVerificationConfirmed = true;
    p.compensationProfile = { ...p.compensationProfile!, configured: true };

    const hierarchy = deriveOperationalReadinessHierarchy({
      participant: p,
      projectId: 'deal-1',
      funding: {
        fundingSourceConnected: true,
        confirmedFunding: 0,
        obligationsTotal: 500,
        obligationsFunded: 0,
      },
      obligationCount: 1,
    });

    expect(hierarchy.funding.ready).toBe(false);
    expect(hierarchy.release.ready).toBe(false);
    expect(
      hierarchy.funding.blockers.some((b) => b.toLowerCase().includes('funding'))
    ).toBe(true);
  });
});

describe('funding coordination semantics', () => {
  it('separates connected from reserved from settled', () => {
    const connected = deriveFundingCoordinationStage({
      fundingSourceConnected: true,
      confirmedFunding: 0,
      obligationsTotal: 500,
      obligationsFunded: 0,
    });
    expect(connected.primaryLabel).toContain('Funding source added');

    const reserved = deriveFundingCoordinationStage({
      fundingSourceConnected: true,
      confirmedFunding: 500,
      obligationsTotal: 500,
      obligationsFunded: 0,
    });
    expect(reserved.fundingSettled).toBe(true);
    expect(reserved.releaseFunded).toBe(false);
    expect(reserved.blockerLabel).toBe(
      'Funding secured. Allocation to payout obligations pending.'
    );
  });
});

describe('operational events and audit', () => {
  it('maps mutations to canonical events', () => {
    const event = operationalEventFromMutation('agreement_approval', {
      projectId: 'deal-1',
      participantId: 'p1',
      payload: { note: 'Looks good' },
    });
    expect(event.type).toBe('AGREEMENT_APPROVED');
    const audit = auditEntryFromOperationalEvent(event);
    expect(audit?.type).toBe('agreement_approved');
  });

  it('maps supplier onboarding mutation to SUPPLIER_ONBOARDING_STARTED', () => {
    const event = operationalEventFromMutation('supplier_onboarding', {
      projectId: 'deal-1',
      participantId: 'p1',
    });
    expect(event.type).toBe('SUPPLIER_ONBOARDING_STARTED');
    const audit = auditEntryFromOperationalEvent(event);
    expect(audit?.type).toBe('supplier_onboarding_started');
    expect(audit?.title).toBe('Payment request sent');
  });

  it('processes events through orchestration pipeline', () => {
    const p = sharedParticipant();
    p.compensationProfile = { ...p.compensationProfile!, configured: true };
    const result = processOperationalEvent({
      mutation: 'participant_earnings_save',
      projectId: 'deal-1',
      participants: [p],
      focusParticipant: p,
      obligationCount: 1,
    });
    expect(result.event.type).toBe('PARTICIPANT_COMPENSATION_UPDATED');
    expect(result.invalidatedScopes).toEqual(
      expect.arrayContaining(['participant', 'obligation', 'payout', 'funding'])
    );
  });
});

describe('catalog service hydration', () => {
  it('never returns raw UUID-only names when catalog exists', () => {
    const services = hydrateEligibleCatalogServices(
      ['svc-abc-123'],
      [{ id: 'svc-abc-123', name: 'VIP Table Package', currency: 'AUD' }]
    );
    expect(services[0]?.name).toBe('VIP Table Package');
    expect(services[0]?.currency).toBe('AUD');
  });
});

describe('operational invariants', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('throws in development for payout-ready without obligations', () => {
    process.env.NODE_ENV = 'development';
    try {
      assertOperationalInvariants({
        participantId: 'p1',
        payoutReady: true,
        obligationCount: 0,
      });
      fail('expected invariant violation');
    } catch (e) {
      expect(e).toBeInstanceOf(OperationalInvariantViolation);
      expect((e as OperationalInvariantViolation).code).toBe('PAYOUT_READY_WITHOUT_OBLIGATIONS');
    }
  });
});
