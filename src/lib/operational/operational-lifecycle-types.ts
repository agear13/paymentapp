/** Project operational lifecycle (orchestration only). */
export type ProjectSetupStatus =
  | 'draft'
  | 'configuring'
  | 'active'
  | 'settlement_ready'
  | 'archived';

/** Participant operational lifecycle. */
export type ParticipantOperationalStatus =
  | 'draft'
  | 'invited'
  | 'configured'
  | 'payout_ready'
  | 'blocked';

/** Compensation profile configuration state. */
export type CompensationProfileStatus = 'missing' | 'draft' | 'configured';

export type ProjectOperationalCompleteness = {
  participantsAdded: boolean;
  compensationConfigured: boolean;
  revenueConfigured: boolean;
  obligationsConfigured: boolean;
  payoutDestinationsConfigured: boolean;
  providerConnected: boolean;
};

export type CompletenessLine = {
  id: string;
  label: string;
  complete: boolean;
  warning?: boolean;
};
