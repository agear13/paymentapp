import {
  appendOperationalAuditEntry,
  getOperationalAuditEntries,
  resetOperationalAuditStoreForTests,
} from '@/hooks/use-operational-audit-store';
import { summarizeProject } from '@/lib/projects/project-workspace-summary';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { projectGraphSummaryProjection } from '@/lib/operations/selectors/project-graph-summary';
import { getOperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';

function baseDeal(): RecentDeal {
  return {
    id: 'deal-1',
    dealName: 'Stabilization',
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

describe('operational stabilization', () => {
  beforeEach(() => {
    resetOperationalAuditStoreForTests();
  });

  it('merges audit entries in shared store', () => {
    appendOperationalAuditEntry({
      id: 'a1',
      type: 'agreement_approved',
      title: 'Agreement approved',
      description: 'Operator approved participation',
      timestamp: '2026-01-01T00:00:00.000Z',
      actor: 'operator',
    });
    appendOperationalAuditEntry({
      id: 'a2',
      type: 'funding_linked',
      title: 'Funding linked',
      description: 'Invoice attached',
      timestamp: '2026-01-02T00:00:00.000Z',
      actor: 'system',
    });
    const entries = getOperationalAuditEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]?.id).toBe('a2');
  });

  it('summarizeProject uses graph override counts instead of local counting', () => {
    const deal = baseDeal();
    const participants = [
      buildProjectParticipant({
        name: 'Alice',
        role: 'Contributor',
        project: deal,
        participationModel: 'fixed_payout',
        commissionKind: 'fixed_amount',
        commissionValue: 500,
        enableCustomerAttribution: false,
      }),
    ];
    const graph = getOperationalCoordinationSnapshot({
      participants,
      projectId: deal.id,
      fundingAllocated: true,
      funding: {
        fundingSourceConnected: true,
        confirmedFunding: 10000,
        obligationsTotal: 500,
        obligationsFunded: 500,
      },
    });
    const projection = projectGraphSummaryProjection(graph, deal, participants);
    const summary = summarizeProject(deal, participants, undefined, {
      releaseReadyCount: projection.releaseReadyCount,
      participantCount: projection.participantCount,
      blockerCount: projection.blockerCount,
      needsAttention: projection.needsAttention,
    });
    expect(summary.participantsReady).toBe(projection.releaseReadyCount);
    expect(summary.participantCount).toBe(projection.participantCount);
  });
});
