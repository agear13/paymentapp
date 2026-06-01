import type { ProjectAllocationBudgetType, ProjectAllocationDto } from '@/lib/projects/allocations/types';

export function formatAllocationBudget(allocation: Pick<ProjectAllocationDto, 'budgetType' | 'budgetValue' | 'currency'>): string {
  const value = allocation.budgetValue;
  switch (allocation.budgetType) {
    case 'FIXED':
      return `${allocation.currency} ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    case 'PERCENTAGE':
      return `${value}%`;
    case 'REVENUE_SHARE':
      return `${value}% revenue share`;
    case 'ATTRIBUTION':
      return `${value}% attribution`;
    default:
      return String(value);
  }
}

export function allocationStatusLabel(status: ProjectAllocationDto['status']): string {
  const labels: Record<ProjectAllocationDto['status'], string> = {
    PLANNED: 'Planned',
    ASSIGNED: 'Assigned',
    PENDING_APPROVAL: 'Pending approval',
    APPROVED: 'Approved',
    OBLIGATION_CREATED: 'Obligation created',
    SETTLED: 'Settled',
  };
  return labels[status] ?? status;
}

export function budgetTypeLabel(type: ProjectAllocationBudgetType): string {
  const labels: Record<ProjectAllocationBudgetType, string> = {
    FIXED: 'Fixed amount',
    PERCENTAGE: 'Percentage',
    REVENUE_SHARE: 'Revenue share',
    ATTRIBUTION: 'Attribution',
  };
  return labels[type];
}
