import { normalizeParticipantEmail } from '@/lib/participant-portal/participant-access';
import type { WorkflowCoordinationAgreementStatus } from '@/lib/workflows/agreement-intelligence/types';

export const PARTICIPANT_IDENTITY_NAME_MAX = 255;
export const PARTICIPANT_IDENTITY_EMAIL_MAX = 255;

export function isParticipantIdentityBound(input: {
  authenticatedUserId?: string | null;
  approvalStatus?: string | null;
}): boolean {
  if (input.authenticatedUserId?.trim()) return true;
  return input.approvalStatus === 'Approved';
}

export function canEditParticipantEmail(input: {
  authenticatedUserId?: string | null;
  approvalStatus?: string | null;
}): boolean {
  return !isParticipantIdentityBound(input);
}

export function isInvitationDestinationStale(input: {
  email?: string | null;
  lastInvitationEmail?: string | null;
}): boolean {
  const current = normalizeParticipantEmail(input.email);
  const lastSent = normalizeParticipantEmail(input.lastInvitationEmail);
  return Boolean(lastSent && current && lastSent !== current);
}

export type ParticipantInvitationCopy = {
  destinationEmail: string | null;
  headline: string;
  statusLine: string;
  stale: boolean;
  previousDestinationEmail: string | null;
};

export function participantInvitationCopy(input: {
  email?: string | null;
  lastInvitationEmail?: string | null;
  agreementStatus: WorkflowCoordinationAgreementStatus | null;
}): ParticipantInvitationCopy {
  const destinationEmail = input.email?.trim() || null;
  const stale = isInvitationDestinationStale(input);
  const previousDestinationEmail = stale ? input.lastInvitationEmail?.trim() || null : null;

  if (input.agreementStatus === 'approved') {
    return {
      destinationEmail,
      headline: 'Agreement approved',
      statusLine: destinationEmail ? `Bound to ${destinationEmail}` : 'Participant identity is bound',
      stale: false,
      previousDestinationEmail: null,
    };
  }

  if (stale) {
    return {
      destinationEmail,
      headline: 'Invitation destination changed',
      statusLine: 'Send a new invitation to the updated email address.',
      stale: true,
      previousDestinationEmail,
    };
  }

  const invitationIssued =
    input.agreementStatus === 'requested' || input.agreementStatus === 'viewed';

  if (invitationIssued) {
    return {
      destinationEmail,
      headline: 'Invitation sent to',
      statusLine: 'Awaiting participant approval',
      stale: false,
      previousDestinationEmail: null,
    };
  }

  return {
    destinationEmail,
    headline: 'Agreement ready to send',
    statusLine: destinationEmail ? 'Will be sent to:' : 'Add an email before sending',
    stale: false,
    previousDestinationEmail: null,
  };
}
