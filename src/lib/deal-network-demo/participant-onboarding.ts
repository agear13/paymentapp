/**
 * Deal Network pilot: participant payout readiness vs allocation approval (onboarding is separate).
 */

export type PilotParticipantOnboardingStatus = 'NOT_STARTED' | 'INCOMPLETE' | 'COMPLETE';

export function isPilotInternalParticipantId(id: string): boolean {
  return id.startsWith('internal-');
}

/** Synthetic deal-role rows do not go through external onboarding. */
export function effectiveOnboardingStatus(participant: {
  id: string;
  onboardingStatus?: PilotParticipantOnboardingStatus;
}): PilotParticipantOnboardingStatus {
  if (isPilotInternalParticipantId(participant.id)) {
    return 'COMPLETE';
  }
  const s = participant.onboardingStatus;
  if (s === 'INCOMPLETE' || s === 'COMPLETE' || s === 'NOT_STARTED') {
    return s;
  }
  return 'NOT_STARTED';
}

export function isOnboardingComplete(status: PilotParticipantOnboardingStatus): boolean {
  return status === 'COMPLETE';
}

export function onboardingStatusLabel(status: PilotParticipantOnboardingStatus): string {
  switch (status) {
    case 'COMPLETE':
      return 'Onboarding complete';
    case 'INCOMPLETE':
      return 'Onboarding incomplete';
    default:
      return 'Onboarding not started';
  }
}

/** Allocation approved in pilot but payout onboarding not finished — show explicit operator hint. */
export function isApprovedButNotOnboarded(participant: {
  id: string;
  approvalStatus: 'Pending approval' | 'Approved';
  onboardingStatus?: PilotParticipantOnboardingStatus;
}): boolean {
  if (participant.approvalStatus !== 'Approved') return false;
  return !isOnboardingComplete(effectiveOnboardingStatus(participant));
}
