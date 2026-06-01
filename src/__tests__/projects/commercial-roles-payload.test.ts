import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  addCommercialRoleToDeals,
  assignCommercialRoleInDeals,
  commercialRolesFromDeal,
  deriveCommercialRoleStatus,
  removeCommercialRoleFromDeals,
} from '@/lib/projects/commercial-roles/commercial-roles-payload';
import {
  commercialRoleStatusLabel,
  formatCommercialRoleBudget,
} from '@/lib/projects/commercial-roles/format-commercial-role';

function baseDeal(id = 'p1'): RecentDeal {
  return {
    id,
    dealName: 'Event',
    partner: 'Partner',
    value: 1000,
    introducer: '—',
    closer: '—',
    status: 'Pending',
    lastUpdated: new Date().toISOString(),
    paymentStatus: 'Not Paid',
  };
}

describe('commercial roles payload', () => {
  it('adds and lists roles on deal_payload shape', () => {
    const deals = addCommercialRoleToDeals([baseDeal()], 'p1', {
      title: 'DJ',
      budgetType: 'FIXED',
      budgetValue: 500,
    });
    const roles = commercialRolesFromDeal(deals[0]);
    expect(roles).toHaveLength(1);
    expect(roles[0].title).toBe('DJ');
    expect(roles[0].status).toBe('PLANNED');
    expect(roles[0].participantId).toBeNull();
  });

  it('assigns participant and derives ASSIGNED status', () => {
    const withRole = addCommercialRoleToDeals([baseDeal()], 'p1', {
      title: 'Promoter',
      budgetType: 'REVENUE_SHARE',
      budgetValue: 10,
    });
    const roleId = commercialRolesFromDeal(withRole[0])[0].id;
    const assigned = assignCommercialRoleInDeals(withRole, 'p1', roleId, 'part-1');
    const role = commercialRolesFromDeal(assigned[0])[0];
    expect(role.participantId).toBe('part-1');
    expect(role.status).toBe('ASSIGNED');
    expect(deriveCommercialRoleStatus('part-1')).toBe('ASSIGNED');
    expect(deriveCommercialRoleStatus(null)).toBe('PLANNED');
  });

  it('removes a role', () => {
    const withRole = addCommercialRoleToDeals([baseDeal()], 'p1', {
      title: 'Supplier',
      budgetType: 'FIXED',
      budgetValue: 1000,
    });
    const roleId = commercialRolesFromDeal(withRole[0])[0].id;
    const next = removeCommercialRoleFromDeals(withRole, 'p1', roleId);
    expect(commercialRolesFromDeal(next[0])).toHaveLength(0);
  });
});

describe('commercial role formatting', () => {
  it('formats launch budget types', () => {
    expect(
      formatCommercialRoleBudget(
        { budgetType: 'FIXED', budgetValue: 500 },
        'USD'
      )
    ).toContain('USD');
    expect(
      formatCommercialRoleBudget({ budgetType: 'REVENUE_SHARE', budgetValue: 10 })
    ).toBe('10% revenue share');
    expect(commercialRoleStatusLabel('PLANNED')).toBe('Planned');
  });
});
