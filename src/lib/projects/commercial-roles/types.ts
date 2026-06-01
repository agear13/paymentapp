export const COMMERCIAL_ROLE_BUDGET_TYPES = [
  'FIXED',
  'REVENUE_SHARE',
  'CUSTOMER_ATTRIBUTION',
] as const;

export type CommercialRoleBudgetType = (typeof COMMERCIAL_ROLE_BUDGET_TYPES)[number];

export const COMMERCIAL_ROLE_STATUSES = ['PLANNED', 'ASSIGNED'] as const;

export type CommercialRoleStatus = (typeof COMMERCIAL_ROLE_STATUSES)[number];

export type CommercialRole = {
  id: string;
  title: string;
  description?: string | null;
  budgetType: CommercialRoleBudgetType;
  budgetValue: number;
  participantId?: string | null;
  status: CommercialRoleStatus;
};
