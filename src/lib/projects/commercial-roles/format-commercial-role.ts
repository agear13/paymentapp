import type { CommercialRole, CommercialRoleBudgetType } from '@/lib/projects/commercial-roles/types';

export function formatCommercialRoleBudget(
  role: Pick<CommercialRole, 'budgetType' | 'budgetValue'>,
  currency = 'USD'
): string {
  const value = role.budgetValue;
  switch (role.budgetType) {
    case 'FIXED':
      return `${currency} ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    case 'REVENUE_SHARE':
      return `${value}% revenue share`;
    case 'CUSTOMER_ATTRIBUTION':
      return `${value}% customer attribution`;
    default:
      return String(value);
  }
}

export function commercialRoleStatusLabel(status: CommercialRole['status']): string {
  const labels: Record<CommercialRole['status'], string> = {
    PLANNED: 'Planned',
    ASSIGNED: 'Assigned',
  };
  return labels[status] ?? status;
}

export function commercialRoleBudgetTypeLabel(type: CommercialRoleBudgetType): string {
  const labels: Record<CommercialRoleBudgetType, string> = {
    FIXED: 'Fixed amount',
    REVENUE_SHARE: 'Revenue share',
    CUSTOMER_ATTRIBUTION: 'Customer attribution',
  };
  return labels[type];
}
