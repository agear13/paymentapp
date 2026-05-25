/**
 * Canonical operational approval semantics — single source of truth for approval state.
 * No screen may infer approval independently; route through derivations in derive-approval-state.ts.
 */

export type ApprovalActor = 'operator' | 'participant' | 'system';

export type AgreementApprovalState =
  | 'draft'
  | 'shared'
  | 'participant_approved'
  | 'operator_confirmed'
  | 'fully_approved';

export type ObligationApprovalState =
  | 'pending_participant'
  | 'pending_operator'
  | 'ready'
  | 'blocked';

export type OperationalBlockerSeverity = 'info' | 'warning' | 'blocking';

/** Actor-owned operational blocker — WHO / ACTION / UNLOCKS structure. */
export type OperationalBlockerDetail = {
  id: string;
  severity: OperationalBlockerSeverity;
  owner: ApprovalActor;
  ownerLabel: string;
  requiredAction: string;
  resolutionRoute: string;
  unlocks: string;
  explanation: string;
  participantId?: string;
  participantName?: string;
  ctaLabel?: string;
};

export type ApprovalOwnership = {
  actor: ApprovalActor;
  actorLabel: string;
  waitingOn: string;
  nextAction: string;
};
