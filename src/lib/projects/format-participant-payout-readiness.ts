/**
 * Participant payout readiness copy for project surfaces.
 */

export function formatParticipantPayoutReadiness(
  participantsReady: number,
  participantCount: number
): string {
  if (participantCount === 0) {
    return 'No participants added';
  }
  return `${participantsReady} of ${participantCount} payout-ready`;
}

export function formatParticipantPayoutSummary(
  participantsReady: number,
  participantCount: number
): string {
  if (participantCount === 0) {
    return 'Add participants to begin payout coordination';
  }
  if (participantsReady === participantCount) {
    return 'All participants payout-ready';
  }
  return formatParticipantPayoutReadiness(participantsReady, participantCount);
}
