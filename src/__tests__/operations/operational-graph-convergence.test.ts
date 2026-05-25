import {
  applyParticipantAgreementShared,
  applyParticipantAgreementViewed,
  applyParticipantAgreementCopied,
} from '@/lib/operations/lifecycle/participant-lifecycle';
import { activationFromOperationalGraph } from '@/lib/operations/selectors/operational-graph-adapter';
import { deriveReleaseBatchEligibility } from '@/lib/operations/selectors/derive-release-batch-eligibility';
import { getOperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import { deriveCurrencyConsistencyWarnings } from '@/lib/operations/derivations/derive-currency-consistency';
import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { assertOperationalInvariants, OperationalInvariantViolation } from '@/lib/operations/dev/operational-invariants';
import { executeStrictOperationalOrchestration } from '@/lib/operations/orchestration/strict-operational-orchestration';

function baseDeal(): RecentDeal {
  return {
    id: 'deal-1',
    dealName: 'Graph Convergence',
    partner: 'Test',
    value: 10000,
    introducer: '—',
    closer: '—',
    status: 'Approved',
    lastUpdated: new Date().toISOString(),
    paymentStatus: 'Paid',
    setupStatus: 'active',
    projectValueCurrency: 'AUD',
  } as RecentDeal;
}

function configuredParticipant(name: string) {
  const p = buildProjectParticipant({
    name,
    role: 'Contributor',
    project: baseDeal(),
    participationModel: 'fixed_payout',
    commissionKind: 'fixed_amount',
    commissionValue: 500,
    enableCustomerAttribution: false,
  });
  p.compensationProfile = { ...p.compensationProfile!, configured: true };
  return p;
}

describe('operational graph convergence', () => {
  describe('Scenario A — compensation → approval → obligations → release eligibility', () => {
    it('propagates release readiness through canonical graph', () => {
      let p = applyParticipantAgreementShared(configuredParticipant('Alex'));
      p.approvalStatus = 'Approved';
      p.payoutVerificationConfirmed = true;

      const snapshot = getOperationalCoordinationSnapshot({
        participants: [p],
        projectId: 'deal-1',
        fundingAllocated: true,
        funding: {
          fundingSourceConnected: true,
          confirmedFunding: 500,
          obligationsTotal: 500,
          obligationsFunded: 500,
        },
        obligations: [
          {
            id: 'obl-1',
            participantId: p.id,
            amount: 500,
            amountFunded: 500,
            currency: 'AUD',
            readiness: 'ready',
          },
        ],
      });

      expect(snapshot.summary.releaseReadyCount).toBe(1);
      expect(snapshot.obligations).toHaveLength(1);
      expect(snapshot.obligations[0]?.participantId).toBe(p.id);
      const batch = deriveReleaseBatchEligibility(snapshot, { currency: 'AUD', minThreshold: 0 });
      expect(batch.participantCount).toBe(1);
      expect(batch.total).toBe(500);
    });
  });

  describe('Scenario B — funding connection updates readiness', () => {
    it('funding lifecycle advances through graph layers', () => {
      const p = configuredParticipant('Funded');
      const unfunded = getOperationalCoordinationSnapshot({
        participants: [p],
        projectId: 'deal-1',
        funding: {
          fundingSourceConnected: true,
          confirmedFunding: 0,
          obligationsTotal: 500,
          obligationsFunded: 0,
        },
        obligations: [{ id: 'o1', participantId: p.id, amount: 500, readiness: 'awaiting_funding' }],
      });
      expect(unfunded.funding.stage?.fundingReserved).toBe(false);

      const funded = getOperationalCoordinationSnapshot({
        participants: [p],
        projectId: 'deal-1',
        funding: {
          fundingSourceConnected: true,
          confirmedFunding: 500,
          obligationsTotal: 500,
          obligationsFunded: 500,
        },
        obligations: [
          { id: 'o1', participantId: p.id, amount: 500, amountFunded: 500, readiness: 'ready' },
        ],
      });
      expect(funded.funding.stage?.releaseFunded).toBe(true);
    });
  });

  describe('Scenario C — currency mismatch blocks release consistently', () => {
    it('blocks release across graph and batch eligibility', () => {
      const p = configuredParticipant('Currency');
      p.approvalStatus = 'Approved';
      p.payoutVerificationConfirmed = true;

      const snapshot = getOperationalCoordinationSnapshot({
        participants: [p],
        projectId: 'deal-1',
        projectCurrency: 'AUD',
        serviceCurrencies: ['USD'],
        fundingAllocated: true,
        obligations: [
          { id: 'o1', participantId: p.id, amount: 500, currency: 'USD', readiness: 'ready' },
        ],
      });

      const warnings = deriveCurrencyConsistencyWarnings({
        projectCurrency: 'AUD',
        serviceCurrencies: ['USD'],
      });
      expect(warnings.some((w) => w.code === 'CURRENCY_INCONSISTENCY')).toBe(true);
      expect(snapshot.summary.releaseReadyCount).toBe(0);
      expect(deriveReleaseBatchEligibility(snapshot, { currency: 'AUD' }).participantCount).toBe(0);
    });
  });

  describe('Scenario D — attribution enabled synchronization', () => {
    it('orchestration emits attribution event', () => {
      const p = configuredParticipant('Referral');
      p.compensationProfile = {
        ...p.compensationProfile!,
        customerAttributionEnabled: true,
        commissionType: 'COMMISSION',
        commissionServiceIds: ['svc-1'],
        commissionSourceMode: 'selected',
      };

      const result = executeStrictOperationalOrchestration({
        mutation: 'attribution_update',
        projectId: 'deal-1',
        participants: [p],
        focusParticipant: p,
      });

      expect(result.event.type).toBe('ATTRIBUTION_CONFIGURATION_UPDATED');
      expect(result.completionEvent.type).toBe('SYNCHRONIZATION_COMPLETED');
    });
  });

  describe('Scenario E — approval note persists through graph', () => {
    it('activation adapter reflects graph release counts with note participant', () => {
      const p = applyParticipantAgreementShared(configuredParticipant('Note'));
      p.approvalStatus = 'Approved';
      p.approvalNote = 'Confirm timing with operator.';
      p.payoutVerificationConfirmed = true;

      const snapshot = getOperationalCoordinationSnapshot({
        participants: [p],
        projectId: 'deal-1',
        fundingAllocated: true,
        obligations: [{ id: 'o1', participantId: p.id, amount: 500, readiness: 'ready' }],
      });

      const activation = activationFromOperationalGraph(snapshot, {
        hasOrganization: true,
        onboardingCompleted: true,
        projectCreated: true,
        participantCount: 1,
        participantsConfigured: true,
        participantsConfiguredCount: 1,
        obligationCount: 1,
        paymentLinkCount: 0,
        collectionPreferenceDecideLater: false,
        defaultCurrency: 'AUD',
        stripeConfigured: true,
        wiseConfigured: false,
        hederaConfigured: false,
        releaseEligibleCount: snapshot.summary.releaseReadyCount,
        releaseBatchCount: 0,
        primaryProjectId: 'deal-1',
      });

      expect(activation.releaseEligibleCount).toBe(snapshot.summary.releaseReadyCount);
      expect(p.approvalNote).toBe('Confirm timing with operator.');
    });
  });

  describe('Scenario F — copy/view do not mutate lifecycle', () => {
    it('view and copy leave canonical agreement state unchanged', () => {
      const shared = applyParticipantAgreementShared(configuredParticipant('Lifecycle'));
      const viewed = applyParticipantAgreementViewed(shared);
      const copied = applyParticipantAgreementCopied(viewed);
      expect(copied.agreementSharedAt).toBe(shared.agreementSharedAt);
      expect(copied.approvalStatus).not.toBe('Approved');
    });
  });

  describe('causality invariant', () => {
    it('throws when approved + configured but no obligations in development', () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      try {
        expect(() =>
          assertOperationalInvariants({
            participantId: 'p1',
            agreementApproved: true,
            compensationConfigured: true,
            obligationCount: 0,
          })
        ).toThrow(OperationalInvariantViolation);
      } finally {
        process.env.NODE_ENV = prev;
      }
    });
  });
});
