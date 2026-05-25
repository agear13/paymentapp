import {
  deriveOperationalBlockingActions,
} from '@/lib/operations/explainability/derive-operational-blocking-actions';
import { deriveOperationalCapabilities } from '@/lib/operations/capabilities/derive-operational-capabilities';
import {
  deriveCommissionEligibleCatalogItems,
} from '@/lib/operations/derivations/commission-scope';
import { getOperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import { guidanceFromOperationalGraph } from '@/lib/operations/selectors/operational-graph-adapter';
import { deriveFundingCoordinationStage } from '@/lib/operations/truth/funding-coordination-semantics';
import { hydrateEligibleCatalogServices } from '@/lib/operations/hydration/hydrate-eligible-catalog-services';
import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  assertAgreementHydrationInvariants,
  assertCapabilityInvariants,
  assertGraphGuidanceInvariants,
  OperationalInvariantViolation,
} from '@/lib/operations/dev/operational-invariants';

function baseDeal(): RecentDeal {
  return {
    id: 'deal-funding',
    dealName: 'Funding Bridge',
    partner: 'Test',
    value: 5000,
    introducer: '—',
    closer: '—',
    status: 'Approved',
    lastUpdated: new Date().toISOString(),
    paymentStatus: 'Paid',
    setupStatus: 'active',
    projectValueCurrency: 'AUD',
  } as RecentDeal;
}

function catalogParticipant(): DemoParticipant {
  const p = buildProjectParticipant({
    name: 'Promoter',
    role: 'Contributor',
    project: baseDeal(),
    participationModel: 'customer_attribution',
    commissionKind: 'pct_deal_value',
    commissionValue: 10,
    enableCustomerAttribution: true,
  });
  p.compensationProfile = {
    ...p.compensationProfile!,
    compensationType: 'COMMISSION',
    configured: true,
    percentage: 10,
    customerAttributionEnabled: true,
    commissionSourceMode: 'selected',
    commissionServiceIds: ['6de9d138-3269-443e-aaaa-bbbbbbbbbbbb'],
  };
  return p;
}

describe('operational graph completion pass', () => {
  describe('A — funding reservation and obligation readiness', () => {
    it('marks funding reserved when confirmed funding exists but obligations are partial', () => {
      const stage = deriveFundingCoordinationStage({
        fundingSourceConnected: true,
        confirmedFunding: 2500,
        obligationsTotal: 5000,
        obligationsFunded: 2500,
      });
      expect(stage.fundingReserved).toBe(true);
      expect(stage.releaseFunded).toBe(false);
      expect(stage.blockerLabel).toContain('settled');
    });

    it('uses fundingReserved for graph allocation when not release funded', () => {
      const p = buildProjectParticipant({
        name: 'Alex',
        role: 'Contributor',
        project: baseDeal(),
        participationModel: 'fixed_payout',
        commissionKind: 'fixed_amount',
        commissionValue: 500,
        enableCustomerAttribution: false,
      });
      p.approvalStatus = 'Approved';
      p.payoutVerificationConfirmed = true;
      p.compensationProfile = { ...p.compensationProfile!, configured: true };

      const snapshot = getOperationalCoordinationSnapshot({
        participants: [p],
        projectId: 'deal-funding',
        fundingAllocated: true,
        funding: {
          fundingSourceConnected: true,
          confirmedFunding: 2500,
          obligationsTotal: 5000,
          obligationsFunded: 2500,
        },
        obligations: [
          {
            id: 'obl-1',
            participantId: p.id,
            amount: 500,
            amountFunded: 500,
            currency: 'AUD',
            readiness: 'partially_funded',
          },
        ],
      });

      expect(snapshot.funding.allocated).toBe(true);
      expect(snapshot.funding.stage?.fundingReserved).toBe(true);
    });
  });

  describe('C — blocker-oriented guidance', () => {
    it('does not claim release ready when funding blockers remain', () => {
      const p = buildProjectParticipant({
        name: 'Alex',
        role: 'Contributor',
        project: baseDeal(),
        participationModel: 'fixed_payout',
        commissionKind: 'fixed_amount',
        commissionValue: 500,
        enableCustomerAttribution: false,
      });
      p.approvalStatus = 'Approved';
      p.payoutVerificationConfirmed = true;
      p.compensationProfile = { ...p.compensationProfile!, configured: true };

      const snapshot = getOperationalCoordinationSnapshot({
        participants: [p],
        projectId: 'deal-funding',
        fundingAllocated: true,
        funding: {
          fundingSourceConnected: true,
          confirmedFunding: 100,
          obligationsTotal: 500,
          obligationsFunded: 100,
        },
        obligations: [
          {
            id: 'obl-1',
            participantId: p.id,
            amount: 500,
            amountFunded: 100,
            currency: 'AUD',
            readiness: 'partially_funded',
          },
        ],
      });

      const blocking = deriveOperationalBlockingActions(snapshot);
      expect(blocking.blockers.length).toBeGreaterThan(0);
      expect(blocking.readinessExplanation.headline).toBe('Release blocked because:');

      const guidance = guidanceFromOperationalGraph({
        snapshot,
        workspace: {
          hasOrganization: true,
          onboardingCompleted: true,
          defaultCurrency: 'AUD',
          stripeConfigured: true,
          wiseConfigured: false,
          hederaConfigured: false,
          projectCount: 1,
          primaryProjectId: 'deal-funding',
          participantCount: 1,
          participantsConfiguredCount: 1,
          obligationCount: 1,
          paymentLinkCount: 1,
          collectionPreferenceDecideLater: false,
          releaseEligibleCount: snapshot.summary.releaseReadyCount,
          releaseBatchCount: 0,
        },
      });

      expect(guidance.explanation.confidence).toBe('BLOCKED');
      expect(guidance.explanation.explainability.headline).not.toBe('Ready for payout release');
    });
  });

  describe('D — agreement service hydration', () => {
    it('hydrates catalog service names instead of raw UUIDs', () => {
      const participant = catalogParticipant();
      const items = deriveCommissionEligibleCatalogItems(participant, {
        catalogItems: [
          {
            id: '6de9d138-3269-443e-aaaa-bbbbbbbbbbbb',
            name: 'Day Bed Tickets',
          },
        ],
      });
      expect(items[0]?.name).toBe('Day Bed Tickets');
      expect(items[0]?.name).not.toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('falls back to truncated label when catalog entity is missing', () => {
      const hydrated = hydrateEligibleCatalogServices(
        ['6de9d138-3269-443e-aaaa-bbbbbbbbbbbb'],
        []
      );
      expect(hydrated[0]?.name).toBe('Service 6de9d138');
    });

    it('throws RAW_SERVICE_IDS_RENDERED in development for UUID labels', () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      expect(() =>
        assertAgreementHydrationInvariants({
          renderedServiceLabels: ['6de9d138-3269-443e-aaaa-bbbbbbbbbbbb'],
        })
      ).toThrow(OperationalInvariantViolation);
      process.env.NODE_ENV = prev;
    });
  });

  describe('E — release capability gating', () => {
    it('disables release actions for non-beta operators during lockdown', () => {
      const caps = deriveOperationalCapabilities({
        isBetaAdmin: false,
        betaLockdownEnabled: true,
      });
      expect(caps.canCreateReleaseBatch).toBe(false);
      expect(caps.disabledReason).toBeTruthy();
    });

    it('allows release actions for beta admins', () => {
      const caps = deriveOperationalCapabilities({
        isBetaAdmin: true,
        betaLockdownEnabled: true,
      });
      expect(caps.canCreateReleaseBatch).toBe(true);
    });

    it('flags visible release action without capability in development', () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      expect(() =>
        assertCapabilityInvariants({
          releaseActionVisible: true,
          canCreateReleaseBatch: false,
        })
      ).toThrow(OperationalInvariantViolation);
      process.env.NODE_ENV = prev;
    });
  });

  describe('F — no contradictory guidance states', () => {
    it('throws when release-ready count conflicts with blockers in development', () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      expect(() =>
        assertGraphGuidanceInvariants({
          releaseReadyCount: 2,
          blockerCount: 1,
          guidanceHeadline: 'Ready for payout release',
        })
      ).toThrow(OperationalInvariantViolation);
      process.env.NODE_ENV = prev;
    });
  });
});
