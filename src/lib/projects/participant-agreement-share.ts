import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { participantWorkspacePathFromParticipant } from '@/lib/projects/participant-entitlement';
import {
  applyParticipantAgreementGenerated,
  applyParticipantAgreementShared,
} from '@/lib/operations/lifecycle/participant-lifecycle';

async function ensureParticipantPortalToken(
  participant: DemoParticipant
): Promise<DemoParticipant> {
  if (participant.participantPortalToken?.trim()) {
    return participant;
  }
  const res = await fetch(`/api/deal-network-pilot/participants/${participant.id}/portal-token`);
  if (!res.ok) {
    return participant;
  }
  const data = (await res.json()) as { participant?: DemoParticipant };
  return data.participant ?? participant;
}

export async function persistParticipantAgreementShare(
  participant: DemoParticipant
): Promise<DemoParticipant> {
  const withToken = await ensureParticipantPortalToken(participant);
  const path = participantWorkspacePathFromParticipant(withToken);

  let updated = withToken;
  if (!withToken.agreementUrl || withToken.agreementUrl.includes('/deal-invites/')) {
    updated = applyParticipantAgreementGenerated(withToken, path);
  }
  updated = applyParticipantAgreementShared(updated);

  const res = await fetch(`/api/deal-network-pilot/participants/${withToken.id}`, {
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
    throw new Error((err as { error?: string }).error || 'Workspace invitation failed');
  }

  const json = (await res.json()) as { participant?: DemoParticipant };
  return json.participant ?? updated;
}
