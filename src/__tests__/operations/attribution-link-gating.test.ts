import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import { applyCompensationProfileToParticipant } from '@/lib/participants/participant-compensation';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  canGenerateAttributionLink,
  deriveAttributionExplanation,
} from '@/lib/operations/truth/attribution-truth';

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

describe('attribution link gating', () => {
  it('blocks links when attribution is disabled', () => {
    const p = buildProjectParticipant({
      name: 'Alex',
      role: 'Contributor',
      project: baseDeal(),
      participationModel: 'revenue_share',
      commissionKind: 'pct_deal_value',
      commissionValue: 10,
      enableCustomerAttribution: false,
    });
    expect(canGenerateAttributionLink(p)).toBe(false);
    expect(deriveAttributionExplanation(p).kind).toBe('inactive');
  });

  it('allows links for catalog commission with eligible items', () => {
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
    expect(
      canGenerateAttributionLink(configured, {
        catalogItems: [{ id: 'svc-1', name: 'VIP Package' }],
      })
    ).toBe(true);
  });

  it('blocks links when catalog commission has no eligible items', () => {
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
      commissionServiceIds: [],
    });
    expect(canGenerateAttributionLink(configured)).toBe(false);
    expect(deriveAttributionExplanation(configured).kind).toBe('awaiting_catalog_assignment');
  });
});
