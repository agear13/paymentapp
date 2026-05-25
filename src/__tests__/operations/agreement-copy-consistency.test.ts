import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import { applyCompensationProfileToParticipant } from '@/lib/participants/participant-compensation';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { deriveAttributionExplanation } from '@/lib/operations/truth/attribution-truth';

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

describe('agreement copy consistency', () => {
  it('never claims attribution active when compensation model is revenue share', () => {
    const p = buildProjectParticipant({
      name: 'Alex',
      role: 'Closer',
      project: baseDeal(),
      participationModel: 'revenue_share',
      commissionKind: 'pct_deal_value',
      commissionValue: 10,
      enableCustomerAttribution: false,
    });
    const explanation = deriveAttributionExplanation(p);
    expect(explanation.kind).toBe('inactive');
    expect(explanation.detail).not.toMatch(/catalog/i);
  });

  it('describes selected catalog scope consistently', () => {
    const p = buildProjectParticipant({
      name: 'Venue',
      role: 'Partner',
      project: baseDeal(),
      participationModel: 'customer_attribution',
      commissionKind: 'pct_deal_value',
      commissionValue: 10,
      enableCustomerAttribution: true,
    });
    const configured = applyCompensationProfileToParticipant(p, {
      compensationType: 'COMMISSION',
      percentage: 10,
      configured: true,
      revenueSources: [],
      customerAttributionEnabled: true,
      commissionSourceMode: 'selected',
      commissionServiceIds: ['svc-1'],
    });
    configured.approvalStatus = 'Approved';

    const explanation = deriveAttributionExplanation(configured, {
      catalogItems: [{ id: 'svc-1', name: 'Early Bird Tickets' }],
    });
    expect(explanation.kind).toBe('active_selected_catalog');
    expect(explanation.detail).toContain('Early Bird Tickets');
  });
});
