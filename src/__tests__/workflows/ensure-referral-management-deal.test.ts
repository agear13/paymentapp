jest.mock('server-only', () => ({}));

const mockWorkflowFindFirst = jest.fn();
const mockDealFindUnique = jest.fn();
const mockUpsertPilotDealForUser = jest.fn();
const mockUpdateProjectDetailsForUser = jest.fn();

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    organization_workflows: {
      findFirst: (...args: unknown[]) => mockWorkflowFindFirst(...args),
    },
    deal_network_pilot_deals: {
      findFirst: (...args: unknown[]) => mockDealFindUnique(...args),
    },
  },
}));

jest.mock('@/lib/deal-network-demo/pilot-snapshot.server', () => ({
  dealRowToRecentDeal: (row: { id: string; deal_payload: Record<string, unknown> }) => ({
    ...(row.deal_payload as object),
    id: row.id,
  }),
  upsertPilotDealForUser: (...args: unknown[]) => mockUpsertPilotDealForUser(...args),
}));

jest.mock('@/lib/projects/update-project-details.server', () => ({
  updateProjectDetailsForUser: (...args: unknown[]) => mockUpdateProjectDetailsForUser(...args),
}));

import { referralManagementDealId } from '@/lib/workflows/referral-management/constants';
import { ensureReferralManagementDeal } from '@/lib/workflows/referral-management/ensure-program-deal.server';

describe('ensureReferralManagementDeal', () => {
  const input = {
    organizationId: 'org-1',
    workflowId: 'wf-1',
    userId: 'user-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkflowFindFirst.mockResolvedValue({
      id: 'wf-1',
      organization_id: 'org-1',
      template_slug: 'referral-management',
    });
  });

  it('returns an existing program deal without overwriting name or value', async () => {
    const dealId = referralManagementDealId('wf-1');
    mockDealFindUnique.mockResolvedValue({
      id: dealId,
      deal_payload: {
        id: dealId,
        dealName: 'Weso Affiliate',
        value: 100000,
        projectDescription: 'Kept',
      },
    });

    const deal = await ensureReferralManagementDeal(input);
    expect(deal?.dealName).toBe('Weso Affiliate');
    expect(deal?.value).toBe(100000);
    expect(mockUpsertPilotDealForUser).not.toHaveBeenCalled();
  });

  it('creates the program deal only when it does not exist yet', async () => {
    mockDealFindUnique.mockResolvedValue(null);
    mockUpsertPilotDealForUser.mockResolvedValue({});

    const deal = await ensureReferralManagementDeal(input);
    expect(deal?.dealName).toBe('Referral Management');
    expect(deal?.value).toBe(0);
    expect(mockUpsertPilotDealForUser).toHaveBeenCalledTimes(1);
  });
});
