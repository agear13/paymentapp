/**
 * OBLIGATION — amount owed to a participant; may be calculated or manual.
 */

export const OBLIGATION_STATES = [
  'DRAFT',
  'CALCULATED',
  'PENDING_APPROVAL',
  'APPROVED',
  'FUNDED',
  'RELEASED',
  'FAILED',
  'VOIDED',
] as const;

export type ObligationState = (typeof OBLIGATION_STATES)[number];
