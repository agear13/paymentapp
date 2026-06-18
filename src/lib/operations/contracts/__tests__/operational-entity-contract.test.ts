import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { PARTICIPANT_CONTRACT_VERSION } from '@/lib/operations/contracts/participant-contract';
import {
  hydrateParticipant,
  hydrateParticipants,
} from '@/lib/operations/hydration/hydrate-participant';
import { hydrateProject } from '@/lib/operations/hydration/hydrate-project';
import { hydrateObligation } from '@/lib/operations/hydration/hydrate-obligation';
import { deriveFundingState } from '@/lib/operations/derivations/derive-funding-state';

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

describe('operational entity compatibility contracts', () => {
  describe('hydrateParticipant', () => {
    it('hydrates legacy participants without throwing', () => {
      const legacy = {
        id: 'legacy-1',
        name: 'Legacy Sam',
        email: '',
        role: 'Contributor',
        commissionKind: 'fixed_amount',
        commissionValue: 0,
        status: 'Pending',
        approvalStatus: 'Pending approval',
        inviteToken: 'tok',
      };
      expect(() => hydrateParticipant(legacy as never)).not.toThrow();
      const hydrated = hydrateParticipant(legacy as never);
      expect(hydrated.id).toBe('legacy-1');
      expect(hydrated.metadata.contractVersion).toBe(PARTICIPANT_CONTRACT_VERSION);
      expect(hydrated.metadata.source).toBe('legacy');
    });

    it('recognises a participant with an explicit commissionValue as configured', () => {
      // A participant built with commissionValue: 100 has persisted earnings terms.
      // hasPersistedCompensationTerms returns true when compensationType + commissionValue > 0
      // are both set — this is the correct post-backfill behaviour.
      const draft = buildProjectParticipant({
        name: 'Alex',
        role: 'Contributor',
        project: baseDeal(),
        participationModel: 'fixed_payout',
        commissionKind: 'fixed_amount',
        commissionValue: 100,
        enableCustomerAttribution: false,
      });
      const hydrated = hydrateParticipant(draft);
      expect(hydrated.compensation.configured).toBe(true);
      expect(hydrated.compensation.type).toBe('FIXED_FEE');
      expect(hydrated.compensation.attributionEnabled).toBe(false);
      expect(hydrated.compensation.selectedCatalogItemIds).toEqual([]);
    });

    it('tolerates missing attribution settings', () => {
      const hydrated = hydrateParticipant({
        id: 'p-1',
        name: 'No Attr',
        email: 'a@b.com',
        role: 'Contributor',
        commissionKind: 'fixed_amount',
        commissionValue: 0,
        status: 'Pending',
        approvalStatus: 'Pending approval',
        inviteToken: 'tok',
      } as never);
      expect(hydrated.attribution.enabled).toBe(false);
      expect(hydrated.attribution.active).toBe(false);
      expect(hydrated.lifecycle.attribution).toBeTruthy();
    });

    it('tolerates malformed payout state', () => {
      const hydrated = hydrateParticipant({
        id: 'p-2',
        name: 'Payout',
        email: '',
        role: 'Contributor',
        commissionKind: 'fixed_amount',
        commissionValue: 0,
        status: 'Pending',
        approvalStatus: 'Pending approval',
        inviteToken: 'tok',
        payoutVerificationConfirmed: undefined,
      } as never);
      expect(hydrated.payout.verifiedExternally).toBe(false);
      expect(hydrated.lifecycle.payoutVerification).toBeTruthy();
    });

    it('handles null and undefined without throwing', () => {
      expect(() => hydrateParticipant(null)).not.toThrow();
      expect(() => hydrateParticipant(undefined)).not.toThrow();
      expect(hydrateParticipant(null).identity.displayName).toBeTruthy();
    });

    it('derives operational readiness flags', () => {
      const draft = buildProjectParticipant({
        name: 'Alex',
        role: 'Contributor',
        project: baseDeal(),
        participationModel: 'fixed_payout',
        commissionKind: 'fixed_amount',
        commissionValue: 100,
        enableCustomerAttribution: false,
      });
      const hydrated = hydrateParticipant(draft);
      expect(typeof hydrated.operational.payoutReady).toBe('boolean');
      expect(typeof hydrated.operational.agreementReady).toBe('boolean');
      expect(typeof hydrated.operational.needsAttention).toBe('boolean');
    });
  });

  describe('hydrateParticipants batch', () => {
    it('returns empty array for non-array input', () => {
      expect(hydrateParticipants(null)).toEqual([]);
      expect(hydrateParticipants(undefined)).toEqual([]);
    });

    it('hydrates mixed legacy and draft entities', () => {
      const list = hydrateParticipants([
        { id: 'a', name: 'A', role: 'Contributor', commissionKind: 'fixed_amount', commissionValue: 0, status: 'Pending', approvalStatus: 'Pending approval', inviteToken: '1' } as never,
        buildProjectParticipant({
          name: 'B',
          role: 'Contributor',
          project: baseDeal(),
          participationModel: 'fixed_payout',
          commissionKind: 'fixed_amount',
          commissionValue: 50,
          enableCustomerAttribution: false,
        }),
      ]);
      expect(list).toHaveLength(2);
      list.forEach((item) => {
        expect(item.metadata.contractVersion).toBe(PARTICIPANT_CONTRACT_VERSION);
      });
    });
  });

  describe('hydrateProject', () => {
    it('never throws on partial project input', () => {
      expect(() => hydrateProject({ id: 'p' } as never)).not.toThrow();
      const project = hydrateProject(baseDeal(), { participants: [] });
      expect(project.metadata.contractVersion).toBe(1);
      expect(project.operational.needsEarningsConfiguration).toBe(false);
    });
  });

  describe('hydrateObligation', () => {
    it('never throws on partial obligation input', () => {
      expect(() => hydrateObligation(null)).not.toThrow();
      expect(() => hydrateObligation({})).not.toThrow();
      const obligation = hydrateObligation({ amount: 100, readiness: 'awaiting_funding' });
      expect(obligation.operational.needsFunding).toBe(true);
    });
  });

  describe('deriveFundingState', () => {
    it('derives funding lifecycle deterministically', () => {
      const funding = deriveFundingState({
        confirmedFunding: 500,
        obligationsTotal: 1000,
        pendingFunding: 0,
      });
      expect(funding.lifecycle).toBe('PARTIAL');
      expect(funding.fullyAllocated).toBe(false);
    });
  });
});
