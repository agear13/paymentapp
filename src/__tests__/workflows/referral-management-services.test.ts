import { compensationServiceIds } from '@/lib/workflows/referral-management/constants';
import { referralEligibilityOf } from '@/lib/workflows/agreement-intelligence/participant-coordination';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

describe('compensationServiceIds', () => {
  it('accepts the legacy single serviceId field', () => {
    expect(
      compensationServiceIds({
        kind: 'revenue_share',
        percentage: 20,
        serviceId: '11111111-1111-1111-1111-111111111111',
      })
    ).toEqual(['11111111-1111-1111-1111-111111111111']);
  });

  it('dedupes serviceIds and serviceId together', () => {
    expect(
      compensationServiceIds({
        kind: 'fixed',
        amount: 3000,
        currency: 'AUD',
        serviceId: '11111111-1111-1111-1111-111111111111',
        serviceIds: [
          '22222222-2222-2222-2222-222222222222',
          '11111111-1111-1111-1111-111111111111',
        ],
      })
    ).toEqual([
      '22222222-2222-2222-2222-222222222222',
      '11111111-1111-1111-1111-111111111111',
    ]);
  });

  it('treats an empty selection as no services, not all services', () => {
    expect(
      compensationServiceIds({
        kind: 'revenue_share',
        percentage: 20,
        serviceIds: [],
      })
    ).toEqual([]);
  });
});

describe('Referral Management empty-selection eligibility', () => {
  const catalog = [
    { id: '11111111-1111-1111-1111-111111111111', name: 'Demo booking' },
    { id: '22222222-2222-2222-2222-222222222222', name: 'Premium consultation' },
  ];

  it('blocks selected-mode promoters with zero services instead of exposing the full catalogue', () => {
    const participant = {
      compensationProfile: {
        compensationType: 'REVENUE_SHARE',
        percentage: 20,
        configured: true,
        commissionSourceMode: 'selected',
        commissionServiceIds: [],
        revenueSources: [],
      },
      referralCommerce: {
        commissionMode: 'project_revenue_share',
        enabledServiceIds: [],
      },
      commissionKind: 'pct_deal_value',
      commissionValue: 20,
    } as DemoParticipant;

    expect(referralEligibilityOf(participant, catalog)).toEqual({
      status: 'service_required',
      destinationLabel: null,
    });
  });
});
