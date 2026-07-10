import type { BriefingObligationRowInput } from '@/lib/agreements/agreement-briefing.model';
import type { CommercialRole } from '@/lib/projects/commercial-roles/types';

/**
 * Maps budgeted roles into obligation row inputs for the commercial forecast engine.
 * Planning-only — does not create live obligations.
 */
export function commercialRolesToObligationRows(
  roles: CommercialRole[],
  expectedRevenue: number,
  dealId: string,
  currency: string
): BriefingObligationRowInput[] {
  return roles.map((role) => {
    const participant = { name: role.title, role: role.title };

    if (role.budgetType === 'FIXED') {
      return {
        id: `plan-role-${role.id}`,
        deal_id: dealId,
        obligation_type: 'fixed_fee',
        status: 'PLANNED',
        amount_owed: role.budgetValue,
        currency,
        participant,
      };
    }

    const pct = role.budgetValue;
    const estimated =
      expectedRevenue > 0 && pct > 0 ? Math.round((expectedRevenue * pct) / 100) : 0;

    return {
      id: `plan-role-${role.id}`,
      deal_id: dealId,
      // Estimated dollar amount — classified as fixed_fee so deriveCommercialForecast includes it in totals.
      obligation_type: 'fixed_fee',
      status: 'PLANNED',
      amount_owed: estimated,
      currency,
      participant,
    };
  });
}

/** Sum of fixed role amounts (excludes %-based estimates). */
export function sumFixedRoleBudgets(roles: CommercialRole[]): number {
  return roles
    .filter((r) => r.budgetType === 'FIXED')
    .reduce((sum, r) => sum + r.budgetValue, 0);
}
