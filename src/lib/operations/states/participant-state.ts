/**
 * PARTICIPANT — economic party in a project; payout readiness is multi-dimensional, not binary.
 */

export const PARTICIPANT_STATES = [
  'INVITED',
  'ONBOARDING',
  'PAYOUT_DETAILS_PENDING',
  'COMPENSATION_PENDING',
  'READY',
  'INACTIVE',
  'BLOCKED',
] as const;

export type ParticipantState = (typeof PARTICIPANT_STATES)[number];

/** Derived capability flags — safe defaults when data is incomplete */
export type ParticipantCapabilityFlags = {
  hasIdentity: boolean;
  hasCompensation: boolean;
  hasPayoutDestination: boolean;
  hasAgreement: boolean;
  payoutReady: boolean;
};

export const PARTICIPANT_STATE_LABELS: Record<ParticipantState, string> = {
  INVITED: 'Invited',
  ONBOARDING: 'Onboarding',
  PAYOUT_DETAILS_PENDING: 'Payout details pending',
  COMPENSATION_PENDING: 'Compensation pending',
  READY: 'Ready',
  INACTIVE: 'Inactive',
  BLOCKED: 'Blocked',
};
