/**
 * COMPENSATION CONFIGURATION — how a participant earns (separate from operational role).
 */

export const COMPENSATION_STATES = [
  'MISSING',
  'DRAFT',
  'CONFIGURED',
  'INVALID',
  'ARCHIVED',
] as const;

export type CompensationState = (typeof COMPENSATION_STATES)[number];

export const COMPENSATION_TYPES = [
  'FIXED_FEE',
  'REVENUE_SHARE',
  'COMMISSION',
  'HYBRID',
  'REIMBURSEMENT',
  'INTERNAL',
  'CUSTOM',
] as const;

export type CompensationType = (typeof COMPENSATION_TYPES)[number];

export type CompensationStructure = {
  compensationType: CompensationType;
  percentage?: number;
  fixedAmount?: number;
  revenueSources?: string[];
  minimumGuarantee?: number;
  maximumAmount?: number;
  payoutPriority?: number;
  notes?: string;
  configured?: boolean;
  configuredAt?: string;
  exemptFromPayout?: boolean;
};

export const COMPENSATION_TYPE_LABELS: Record<CompensationType, string> = {
  FIXED_FEE: 'Fixed fee',
  REVENUE_SHARE: 'Revenue share',
  COMMISSION: 'Commission',
  HYBRID: 'Hybrid',
  REIMBURSEMENT: 'Reimbursement',
  INTERNAL: 'Unpaid / internal',
  CUSTOM: 'Custom',
};
