export const PROJECT_ALLOCATION_BUDGET_TYPES = [
  'FIXED',
  'PERCENTAGE',
  'REVENUE_SHARE',
  'ATTRIBUTION',
] as const;

export type ProjectAllocationBudgetType = (typeof PROJECT_ALLOCATION_BUDGET_TYPES)[number];

export const PROJECT_ALLOCATION_STATUSES = [
  'PLANNED',
  'ASSIGNED',
  'PENDING_APPROVAL',
  'APPROVED',
  'OBLIGATION_CREATED',
  'SETTLED',
] as const;

export type ProjectAllocationStatus = (typeof PROJECT_ALLOCATION_STATUSES)[number];

export type ProjectAllocationDto = {
  id: string;
  projectId: string;
  title: string;
  role: string;
  description: string | null;
  budgetType: ProjectAllocationBudgetType;
  budgetValue: number;
  currency: string;
  plannedBudgetValue: number;
  actualBudgetValue: number | null;
  participantId: string | null;
  participantName: string | null;
  status: ProjectAllocationStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
