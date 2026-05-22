/**
 * PAYOUT RELEASE — batch intent to pay participants; validates funding and rails.
 */

export const PAYOUT_RELEASE_STATES = [
  'DRAFT',
  'VALIDATING',
  'BLOCKED',
  'READY',
  'PROCESSING',
  'PARTIALLY_COMPLETED',
  'COMPLETED',
  'FAILED',
  'REVERSED',
] as const;

export type PayoutReleaseState = (typeof PAYOUT_RELEASE_STATES)[number];

export type PayoutReleaseValidation = {
  missingParticipants: string[];
  insufficientFunds: boolean;
  invalidPayoutRails: boolean;
  incompleteObligations: boolean;
};
