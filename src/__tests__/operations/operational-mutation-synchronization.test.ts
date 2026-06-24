import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { normalizeCompensationAttributionSemantics } from '@/lib/operations/derivations/derive-currency-consistency';
import { synchronizeOperationalState } from '@/lib/operations/orchestration/synchronize-operational-state';
import { workspaceScopesFromOperationalSync } from '@/lib/operations/orchestration/synchronize-operational-state';

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

describe('operational mutation synchronization', () => {
  it('funding mutation invalidates all coordination scopes', () => {
    const sync = synchronizeOperationalState({
      mutation: 'funding_update',
      projectId: 'deal-1',
      participants: [],
      fundingAllocated: true,
    });
    expect(sync.invalidatedScopes).toContain('funding');
    expect(workspaceScopesFromOperationalSync(sync.invalidatedScopes)).toContain('all');
  });

  it('supplier onboarding mutation invalidates all coordination scopes', () => {
    const sync = synchronizeOperationalState({
      mutation: 'supplier_onboarding',
      projectId: 'deal-1',
      participants: [],
    });
    expect(sync.invalidatedScopes).toContain('participant');
    expect(workspaceScopesFromOperationalSync(sync.invalidatedScopes)).toContain('all');
  });

  it('earnings save mutation recomputes snapshot with participants', () => {
    const p = buildProjectParticipant({
      name: 'Alex',
      role: 'Contributor',
      project: baseDeal(),
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 100,
      enableCustomerAttribution: false,
    });
    p.compensationProfile = { ...p.compensationProfile!, configured: true };
    p.approvalStatus = 'Approved';
    p.payoutVerificationConfirmed = true;

    const sync = synchronizeOperationalState({
      mutation: 'participant_earnings_save',
      projectId: 'deal-1',
      participants: [p],
      fundingAllocated: true,
    });
    expect(sync.snapshot.summary.payoutReadyCount).toBe(1);
  });
});

describe('attribution semantic enforcement', () => {
  it('auto-enables attribution when catalog services are selected', () => {
    const p = buildProjectParticipant({
      name: 'Venue',
      role: 'Partner',
      project: baseDeal(),
      participationModel: 'customer_attribution',
      commissionKind: 'pct_deal_value',
      commissionValue: 10,
      enableCustomerAttribution: false,
    });
    const result = normalizeCompensationAttributionSemantics(p, {
      compensationType: 'COMMISSION',
      configured: true,
      percentage: 10,
      revenueSources: [],
      customerAttributionEnabled: false,
      commissionSourceMode: 'selected',
      commissionServiceIds: ['svc-1'],
    });
    expect(result.profile.customerAttributionEnabled).toBe(true);
    expect(result.autoEnabledAttribution).toBe(true);
  });

  it('clears catalog selection for revenue share participants', () => {
    const p = buildProjectParticipant({
      name: 'Sam',
      role: 'Closer',
      project: baseDeal(),
      participationModel: 'revenue_share',
      commissionKind: 'pct_deal_value',
      commissionValue: 12,
      enableCustomerAttribution: false,
    });
    const result = normalizeCompensationAttributionSemantics(p, {
      compensationType: 'REVENUE_SHARE',
      configured: true,
      percentage: 12,
      revenueSources: [],
      customerAttributionEnabled: true,
      commissionSourceMode: 'selected',
      commissionServiceIds: ['svc-1'],
    });
    expect(result.profile.customerAttributionEnabled).toBe(false);
    expect(result.profile.commissionServiceIds).toEqual([]);
    expect(result.clearedCatalogSelection).toBe(true);
  });
});
