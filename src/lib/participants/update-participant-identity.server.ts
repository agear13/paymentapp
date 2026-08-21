import 'server-only';

import { z } from 'zod';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  getPilotSnapshotForUser,
  updatePilotParticipantPayload,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { normalizeParticipantEmail } from '@/lib/participant-portal/participant-access';
import {
  canEditParticipantEmail,
  PARTICIPANT_IDENTITY_EMAIL_MAX,
  PARTICIPANT_IDENTITY_NAME_MAX,
} from '@/lib/participants/participant-identity';
import { compensationKindOf } from '@/lib/workflows/agreement-intelligence/participant-coordination';

export class ParticipantIdentityError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = 'ParticipantIdentityError';
  }
}

export const participantIdentityPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(PARTICIPANT_IDENTITY_NAME_MAX).optional(),
    email: z.string().trim().email().max(PARTICIPANT_IDENTITY_EMAIL_MAX).optional(),
  })
  .refine((body) => body.name != null || body.email != null, { message: 'No identity updates provided' });

export type ParticipantIdentityPatch = z.infer<typeof participantIdentityPatchSchema>;

export async function updateParticipantIdentity(input: {
  participantId: string;
  operatorUserId: string;
  name?: string;
  email?: string;
}): Promise<{
  participant: DemoParticipant;
  emailChanged: boolean;
  invitationResendRequired: boolean;
}> {
  const parsed = participantIdentityPatchSchema.parse({
    name: input.name,
    email: input.email,
  });

  const snapshot = await getPilotSnapshotForUser(input.operatorUserId);
  const existing = snapshot.participants.find((row) => row.id === input.participantId);
  if (!existing) {
    throw new ParticipantIdentityError('Participant not found', 'NOT_FOUND', 404);
  }

  const nextName = parsed.name ?? existing.name;
  const nextEmail = parsed.email ?? existing.email;
  const emailChanged =
    Boolean(parsed.email) &&
    normalizeParticipantEmail(parsed.email) !== normalizeParticipantEmail(existing.email);

  if (emailChanged && !canEditParticipantEmail(existing)) {
    throw new ParticipantIdentityError(
      'This email is bound to a signed-in participant and cannot be changed. Add a new participant to invite a different person.',
      'IDENTITY_BOUND',
      409
    );
  }

  if (emailChanged) {
    const duplicate = snapshot.participants.find(
      (row) =>
        row.id !== existing.id &&
        Boolean(compensationKindOf(row)) &&
        normalizeParticipantEmail(row.email) === normalizeParticipantEmail(nextEmail)
    );
    if (duplicate) {
      throw new ParticipantIdentityError(
        'A participant with this email already exists. Open the existing relationship instead of creating a duplicate.',
        'CONFLICT',
        409
      );
    }
  }

  const inviteAlreadyIssued = Boolean(existing.agreementSharedAt || existing.inviteSentAt);
  const lastInvitationEmail = emailChanged
    ? existing.lastInvitationEmail?.trim() ||
      (inviteAlreadyIssued ? existing.email.trim() || null : null)
    : existing.lastInvitationEmail;

  const persisted = await updatePilotParticipantPayload(input.participantId, input.operatorUserId, {
    name: nextName,
    email: nextEmail,
    lastInvitationEmail,
  });
  if (!persisted) {
    throw new ParticipantIdentityError('Participant not found', 'NOT_FOUND', 404);
  }

  return {
    participant: persisted,
    emailChanged,
    invitationResendRequired: emailChanged && inviteAlreadyIssued,
  };
}
