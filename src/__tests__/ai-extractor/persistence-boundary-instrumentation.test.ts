import { describe, expect, it, beforeEach } from '@jest/globals';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  classifyTrackedPersistenceParty,
  logPersistenceBoundaryParticipant,
  snapParticipantForPersistenceBoundary,
  startPersistenceBoundarySession,
  getActivePersistenceBoundarySession,
} from '@/lib/ai-extractor/persistence-boundary-instrumentation';

function participant(overrides: Partial<DemoParticipant> & { name: string }): DemoParticipant {
  return {
    id: 'p1',
    dealId: 'deal-1',
    name: overrides.name,
    email: '',
    role: 'Performer',
    participationModel: 'fixed_payout',
    commissionKind: 'fixed',
    commissionValue: 2500,
    inviteToken: 'tok',
    approvalStatus: 'Pending approval',
    compensationProfile: {
      compensationType: 'FIXED_FEE',
      fixedAmount: 2500,
      configured: true,
      configuredAt: '2026-01-01T00:00:00.000Z',
    },
    ...overrides,
  } as DemoParticipant;
}

describe('persistence-boundary-instrumentation', () => {
  beforeEach(() => {
    startPersistenceBoundarySession('test');
  });

  it('classifies Island DJs and Coastal Promotions', () => {
    expect(classifyTrackedPersistenceParty('Island DJs')).toBe('island_djs');
    expect(classifyTrackedPersistenceParty('Coastal Promotions')).toBe('coastal_promotions');
  });

  it('records first loss when Island fixedAmount drops from 2500', () => {
    const island = participant({ name: 'Island DJs' });
    logPersistenceBoundaryParticipant('afterMapSinglePartyToParticipant', island);
    const broken = participant({
      name: 'Island DJs',
      compensationProfile: {
        compensationType: 'FIXED_FEE',
        fixedAmount: null,
        configured: false,
        configuredAt: '2026-01-01T00:00:00.000Z',
      },
    });
    logPersistenceBoundaryParticipant('beforePersistPilotSnapshot', broken);
    const session = getActivePersistenceBoundarySession();
    expect(session?.firstLossInSession.islandDjsFixedAmount2500).toBe(
      'beforePersistPilotSnapshot'
    );
  });

  it('records first loss when Coastal type becomes FIXED_FEE', () => {
    const coastal = participant({
      name: 'Coastal Promotions',
      participationModel: 'revenue_share',
      commissionValue: 15,
      compensationProfile: {
        compensationType: 'REVENUE_SHARE',
        percentage: 15,
        configured: true,
        configuredAt: '2026-01-01T00:00:00.000Z',
      },
    });
    logPersistenceBoundaryParticipant('afterMapSinglePartyToParticipant', coastal);
    const wrong = participant({
      name: 'Coastal Promotions',
      participationModel: 'revenue_share',
      compensationProfile: {
        compensationType: 'FIXED_FEE',
        fixedAmount: null,
        configured: false,
        configuredAt: '2026-01-01T00:00:00.000Z',
      },
    });
    logPersistenceBoundaryParticipant('afterMergeExtractedCompensationIntoExistingParticipant', wrong);
    expect(
      getActivePersistenceBoundarySession()?.firstLossInSession
        .coastalCompensationTypeRevenueShareToFixedFee
    ).toBe('afterMergeExtractedCompensationIntoExistingParticipant');
  });

  it('snapParticipantForPersistenceBoundary captures runtime fields', () => {
    const snap = snapParticipantForPersistenceBoundary(participant({ name: 'Island DJs' }));
    expect(snap.commissionValue).toBe(2500);
    expect(snap.compensationProfile?.fixedAmount).toBe(2500);
  });
});
