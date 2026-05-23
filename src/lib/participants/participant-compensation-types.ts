/**
 * How a participant earns — separate from operational role.
 * Orchestration / readiness only; no settlement calculations.
 */
export const PARTICIPANT_COMPENSATION_TYPES = [
  'FIXED_FEE',
  'REVENUE_SHARE',
  'COMMISSION',
  'HYBRID',
  'REIMBURSEMENT',
  'CUSTOM',
  'UNPAID_INTERNAL',
] as const;

export type ParticipantCompensationType = (typeof PARTICIPANT_COMPENSATION_TYPES)[number];

export const REVENUE_SOURCE_OPTIONS = [
  { id: 'ticket_sales', label: 'Ticket sales' },
  { id: 'sponsorship', label: 'Sponsorship' },
  { id: 'merchandise', label: 'Merchandise' },
  { id: 'tables', label: 'Table sales' },
  { id: 'services', label: 'Services' },
  { id: 'other', label: 'Other' },
] as const;

export type CommissionSourceMode = 'all_active' | 'selected';

export type ParticipantCompensationProfile = {
  compensationType: ParticipantCompensationType;
  percentage?: number;
  fixedAmount?: number;
  revenueSources?: string[];
  minimumGuarantee?: number;
  payoutPriority?: number;
  notes?: string;
  /** Operator explicitly saved compensation configuration */
  configured?: boolean;
  configuredAt?: string;
  /** No payout — internal / unpaid role */
  exemptFromPayout?: boolean;
  /** Enables customer purchase attribution links — explicit operator opt-in */
  customerAttributionEnabled?: boolean;
  /** Which catalog items commission applies to (COMMISSION type) */
  commissionSourceMode?: CommissionSourceMode;
  commissionServiceIds?: string[];
};

export type AllocationStatus = 'missing' | 'configured' | 'exempt';

export type ParticipantPayoutDestinationStatus = 'not_configured' | 'configured';
