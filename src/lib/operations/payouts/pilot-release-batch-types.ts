/** Shared pilot release batch line shape — no server or scope imports. */
export type PilotReleaseBatchLine = {
  obligationId: string;
  participantId: string;
  participantName: string;
  amount: number;
  currency: string;
};
