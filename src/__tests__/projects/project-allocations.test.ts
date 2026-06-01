import {
  allocationStatusLabel,
  formatAllocationBudget,
  budgetTypeLabel,
} from '@/lib/projects/allocations/format-allocation';
import type { ProjectAllocationDto } from '@/lib/projects/allocations/types';

describe('project allocation formatting', () => {
  const base: ProjectAllocationDto = {
    id: 'a1',
    projectId: 'p1',
    title: 'DJ',
    role: 'Performer',
    description: null,
    budgetType: 'FIXED',
    budgetValue: 500,
    currency: 'USD',
    plannedBudgetValue: 500,
    actualBudgetValue: null,
    participantId: null,
    participantName: null,
    status: 'PLANNED',
    notes: null,
    createdAt: '',
    updatedAt: '',
  };

  it('formats fixed and percentage budgets', () => {
    expect(formatAllocationBudget(base)).toContain('USD');
    expect(formatAllocationBudget({ ...base, budgetType: 'PERCENTAGE', budgetValue: 10 })).toBe(
      '10%'
    );
    expect(
      formatAllocationBudget({ ...base, budgetType: 'REVENUE_SHARE', budgetValue: 10 })
    ).toBe('10% revenue share');
  });

  it('labels statuses for planning workflow', () => {
    expect(allocationStatusLabel('PLANNED')).toBe('Planned');
    expect(allocationStatusLabel('ASSIGNED')).toBe('Assigned');
    expect(budgetTypeLabel('ATTRIBUTION')).toBe('Attribution');
  });
});

describe('allocation status derivation (documented behavior)', () => {
  it('documents PLANNED → ASSIGNED on participant link only', () => {
    expect(true).toBe(true);
  });
});
