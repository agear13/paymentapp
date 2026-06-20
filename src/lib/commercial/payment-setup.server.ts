/**
 * Payment Setup Server Utilities
 *
 * Token-based authentication for the public supplier payment setup portal.
 * Persists draft invoices, tokens, and attachments inside participant_payload.paymentSetup
 * — no additional database tables required.
 *
 * Token lifecycle:
 *   Created → sent to supplier via email → used to authenticate the public portal
 *   → invalidated after submission (tokenUsedAt set)
 *   → re-created on "Request Changes" or operator resend
 */
import 'server-only';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/server/prisma';
import type { Prisma } from '@prisma/client';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { PersistedDraftInvoice } from '@/lib/commercial/payment-setup-types';

/** How long a payment setup token is valid (30 days). */
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/* ─── Token generation ──────────────────────────────────────────────────── */

/** Generate a new payment setup token and return the updated paymentSetup patch. */
export function createPaymentSetupToken(): {
  token: string;
  tokenCreatedAt: string;
  tokenExpiresAt: string;
} {
  const now = new Date();
  return {
    token: uuidv4(),
    tokenCreatedAt: now.toISOString(),
    tokenExpiresAt: new Date(now.getTime() + TOKEN_TTL_MS).toISOString(),
  };
}

/* ─── Token lookup ──────────────────────────────────────────────────────── */

/** Find a participant row by their payment setup token (JSON field query). */
export async function findParticipantByPaymentSetupToken(token: string): Promise<{
  participant: DemoParticipant;
  participantDbId: string;
  dealId: string;
  deal: { id: string; user_id: string; deal_payload: Prisma.JsonValue };
} | null> {
  const rows = await prisma.deal_network_pilot_participants.findMany({
    where: {
      participant_payload: {
        path: ['paymentSetup', 'token'],
        equals: token,
      },
    },
    include: { deal: true },
    take: 1,
  });

  const row = rows[0];
  if (!row) return null;

  const participant = row.participant_payload as unknown as DemoParticipant;

  // Validate expiry
  const ps = participant.paymentSetup;
  if (!ps?.tokenExpiresAt || new Date(ps.tokenExpiresAt) < new Date()) {
    return null;
  }

  return {
    participant: {
      ...participant,
      id: row.id,
      dealId: row.deal_id,
    },
    participantDbId: row.id,
    dealId: row.deal_id,
    deal: row.deal,
  };
}

/* ─── Draft invoice persistence ─────────────────────────────────────────── */

/**
 * Persist or update the draft invoice for a participant.
 * Called immediately after agreement approval.
 */
export async function persistDraftInvoice(
  participantId: string,
  invoice: PersistedDraftInvoice
): Promise<void> {
  const row = await prisma.deal_network_pilot_participants.findUnique({
    where: { id: participantId },
  });
  if (!row) return;

  const cur = row.participant_payload as unknown as DemoParticipant;
  const next: DemoParticipant = {
    ...cur,
    paymentSetup: {
      ...cur.paymentSetup,
      draftInvoice: invoice,
    },
  };

  await prisma.deal_network_pilot_participants.update({
    where: { id: participantId },
    data: { participant_payload: next as unknown as Prisma.InputJsonValue },
  });
}

/* ─── Token persistence ─────────────────────────────────────────────────── */

/** Persist a newly created payment setup token to a participant. */
export async function persistPaymentSetupToken(
  participantId: string,
  tokenData: { token: string; tokenCreatedAt: string; tokenExpiresAt: string }
): Promise<DemoParticipant | null> {
  const row = await prisma.deal_network_pilot_participants.findUnique({
    where: { id: participantId },
  });
  if (!row) return null;

  const cur = row.participant_payload as unknown as DemoParticipant;
  const next: DemoParticipant = {
    ...cur,
    paymentSetup: {
      ...cur.paymentSetup,
      ...tokenData,
    },
  };

  await prisma.deal_network_pilot_participants.update({
    where: { id: participantId },
    data: { participant_payload: next as unknown as Prisma.InputJsonValue },
  });

  return { ...next, id: participantId };
}

/* ─── Token invalidation ─────────────────────────────────────────────────── */

/** Mark the token as used after supplier submits. Does not delete — preserves history. */
export async function invalidatePaymentSetupToken(participantId: string): Promise<void> {
  const row = await prisma.deal_network_pilot_participants.findUnique({
    where: { id: participantId },
  });
  if (!row) return;

  const cur = row.participant_payload as unknown as DemoParticipant;
  const next: DemoParticipant = {
    ...cur,
    paymentSetup: {
      ...cur.paymentSetup,
      tokenUsedAt: new Date().toISOString(),
      // Expire the token immediately so it cannot be reused
      tokenExpiresAt: new Date(0).toISOString(),
    },
  };

  await prisma.deal_network_pilot_participants.update({
    where: { id: participantId },
    data: { participant_payload: next as unknown as Prisma.InputJsonValue },
  });
}

/* ─── Xero export persistence ───────────────────────────────────────────── */

export async function persistXeroExport(
  participantId: string,
  userId: string,
  xeroData: {
    xeroContactId: string;
    xeroInvoiceId: string;
    xeroInvoiceNumber: string;
    xeroSyncStatus: 'synced' | 'failed';
    failureReason?: string;
  }
): Promise<DemoParticipant | null> {
  const row = await prisma.deal_network_pilot_participants.findUnique({
    where: { id: participantId },
  });
  if (!row) return null;

  const cur = row.participant_payload as unknown as DemoParticipant;
  const now = new Date().toISOString();

  const next: DemoParticipant = {
    ...cur,
    paymentSetup: {
      ...cur.paymentSetup,
      xeroContactId: xeroData.xeroContactId,
      xeroInvoiceId: xeroData.xeroInvoiceId,
      xeroInvoiceNumber: xeroData.xeroInvoiceNumber,
      xeroExportedAt: now,
      xeroExportedBy: userId,
      xeroSyncStatus: xeroData.xeroSyncStatus,
      xeroFailureReason: xeroData.failureReason ?? null,
      // Update the draft invoice status
      draftInvoice: cur.paymentSetup?.draftInvoice
        ? { ...cur.paymentSetup.draftInvoice, status: 'EXPORTED_TO_XERO' as const }
        : cur.paymentSetup?.draftInvoice,
    },
    // Legacy: operator field
    supplierOnboarding: cur.supplierOnboarding
      ? {
          ...cur.supplierOnboarding,
          operator: {
            ...(cur.supplierOnboarding?.operator ?? { approvedAt: null, notes: null }),
            xeroExportedAt: now,
          },
        }
      : cur.supplierOnboarding,
  };

  await prisma.deal_network_pilot_participants.update({
    where: { id: participantId },
    data: { participant_payload: next as unknown as Prisma.InputJsonValue },
  });

  return { ...next, id: participantId, dealId: row.deal_id };
}
