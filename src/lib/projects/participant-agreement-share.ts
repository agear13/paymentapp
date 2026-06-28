import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { participantAgreementPath } from '@/lib/projects/participant-entitlement';
import {
  applyParticipantAgreementGenerated,
  applyParticipantAgreementShared,
} from '@/lib/operations/lifecycle/participant-lifecycle';

export async function persistParticipantAgreementShare(
  participant: DemoParticipant
): Promise<DemoParticipant> {
  const path = participant.agreementUrl ?? participantAgreementPath(participant.inviteToken);
  let updated = participant;
  if (!participant.agreementUrl) {
    updated = applyParticipantAgreementGenerated(participant, path);
  }
  updated = applyParticipantAgreementShared(updated);

  const res = await fetch(`/api/deal-network-pilot/participants/${participant.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agreementUrl: updated.agreementUrl,
      agreementSharedAt: updated.agreementSharedAt,
      inviteSentAt: updated.inviteSentAt,
      inviteStatus: updated.inviteStatus,
      agreementLifecycle: updated.agreementLifecycle,
      participantLifecycle: updated.participantLifecycle,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Agreement share failed');
  }

  const json = (await res.json()) as { participant?: DemoParticipant };
  return json.participant ?? updated;
}
