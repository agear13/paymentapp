/**
 * Resolve legacy agreement invite links into the unified Participant Workspace URL.
 */
import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import {
  getParticipantByInviteToken,
  participantRowToDemo,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { createParticipantPortalToken } from '@/lib/participant-portal/participant-portal.server';
import {
  buildParticipantWorkspacePayoutUrl,
  participantWorkspacePath,
} from '@/lib/participant-portal/participant-portal-url';

export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://app.provvypay.com')
  );
}

export async function buildParticipantWorkspacePayoutUrlForParticipant(
  participantId: string
): Promise<string | null> {
  const portalToken = await ensurePortalTokenOnParticipantRow(participantId);
  if (!portalToken) return null;
  return buildParticipantWorkspacePayoutUrl(portalToken, appBaseUrl());
}

export async function ensurePortalTokenOnParticipantRow(
  participantId: string
): Promise<string | null> {
  const row = await prisma.deal_network_pilot_participants.findUnique({
    where: { id: participantId },
  });
  if (!row) return null;

  const current = participantRowToDemo(row);
  if (current.participantPortalToken?.trim()) {
    return current.participantPortalToken.trim();
  }

  const token = createParticipantPortalToken();
  const next = { ...current, participantPortalToken: token };
  await prisma.deal_network_pilot_participants.update({
    where: { id: participantId },
    data: {
      participant_payload: next as unknown as Prisma.InputJsonValue,
    },
  });
  return token;
}

/** Map a legacy `/deal-invites/[inviteToken]` URL to `/participant/[workspaceToken]`. */
export async function resolveWorkspacePathFromInviteToken(
  inviteToken: string
): Promise<string | null> {
  const row = await getParticipantByInviteToken(inviteToken);
  if (!row) return null;

  const portalToken = await ensurePortalTokenOnParticipantRow(row.id);
  if (!portalToken) return null;

  return participantWorkspacePath(portalToken);
}

/** Map legacy `/payment-setup/[token]` URLs to `/participant/[workspaceToken]?step=payout`. */
export async function resolveWorkspacePathFromPaymentSetupToken(
  paymentSetupToken: string
): Promise<string | null> {
  const { findParticipantByPaymentSetupToken } = await import('@/lib/commercial/payment-setup.server');
  const result = await findParticipantByPaymentSetupToken(paymentSetupToken);
  if (!result) return null;

  const portalToken = await ensurePortalTokenOnParticipantRow(result.participant.id);
  if (!portalToken) return null;

  return participantWorkspacePath(portalToken, 'payout');
}
