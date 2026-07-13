/**
 * Ensures payment-setup infrastructure exists for workspace-embedded payout collection.
 */
import 'server-only';
import { v4 as uuidv4 } from 'uuid';
import type { Prisma } from '@prisma/client';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { prisma } from '@/lib/server/prisma';
import {
  createPaymentSetupToken,
  persistDraftInvoice,
  persistPaymentSetupToken,
} from '@/lib/commercial/payment-setup.server';
import { buildSupplierOnboardingInput } from '@/lib/commercial/build-supplier-onboarding-input';
import { generateDraftInvoice } from '@/lib/commercial/supplier-onboarding';
import { buildPersistedDraftInvoiceProjection } from '@/lib/commercial/supplier-invoice-projection';
import {
  appendOnboardingEvent,
  type StoredOnboardingState,
} from '@/lib/commercial/supplier-onboarding-domain';
import { participantNeedsPayoutDetailsStep } from '@/lib/participant-portal/participant-workspace-onboarding';
import { participantRowToDemo } from '@/lib/deal-network-demo/pilot-snapshot.server';

function hasValidPaymentToken(participant: DemoParticipant): boolean {
  const ps = participant.paymentSetup;
  if (!ps?.token || !ps.tokenExpiresAt) return false;
  return new Date(ps.tokenExpiresAt) > new Date();
}

/**
 * Returns a valid payment-setup token for public payout APIs, creating one if needed.
 */
export async function ensurePaymentSetupTokenForPortalParticipant(
  participantDbId: string
): Promise<string | null> {
  const row = await prisma.deal_network_pilot_participants.findUnique({
    where: { id: participantDbId },
    include: { deal: true },
  });
  if (!row?.deal) return null;

  let participant = participantRowToDemo(row);
  if (!participantNeedsPayoutDetailsStep(participant)) {
    return participant.paymentSetup?.token ?? null;
  }

  if (hasValidPaymentToken(participant) && participant.paymentSetup?.token) {
    return participant.paymentSetup.token;
  }

  const dealPayload = row.deal.deal_payload as { dealName?: string };
  const dealName = dealPayload.dealName ?? row.deal.name ?? 'Your project';
  const now = new Date().toISOString();
  const input = buildSupplierOnboardingInput(participant, { id: row.deal_id, name: dealName });
  const derived = generateDraftInvoice(input);

  let persistedInvoice = participant.paymentSetup?.draftInvoice;
  if (!persistedInvoice) {
    persistedInvoice = buildPersistedDraftInvoiceProjection({
      derived,
      id: uuidv4(),
      createdAt: now,
      status: 'SUPPLIER_REVIEW',
      supplier: participant.name,
      participantId: participant.id,
      agreementReference: null,
      projectName: dealName,
    });
    await persistDraftInvoice(participantDbId, persistedInvoice);
  }

  const tokenData = createPaymentSetupToken();
  await persistPaymentSetupToken(participantDbId, tokenData);

  const existingStored = participant.supplierOnboarding as StoredOnboardingState | undefined;
  const updatedOnboarding: StoredOnboardingState = {
    ...existingStored,
    lifecycle: existingStored?.lifecycle === 'NOT_STARTED' ? 'INVITED' : existingStored?.lifecycle,
    events: appendOnboardingEvent(existingStored?.events ?? [], {
      id: uuidv4(),
      type: 'SUPPLIER_INVOICE_GENERATED',
      participantId: participantDbId,
      performedBy: 'participant_workspace',
      timestamp: now,
      payload: {
        invoiceAmount: derived.total,
        currency: derived.currency,
        gstStatus: derived.gstStatus,
      },
    }),
  };

  const next: DemoParticipant = {
    ...participant,
    supplierOnboarding: updatedOnboarding,
    paymentSetup: {
      ...participant.paymentSetup,
      ...tokenData,
      paymentRequestGeneratedAt: participant.paymentSetup?.paymentRequestGeneratedAt ?? now,
      draftInvoice: persistedInvoice,
    },
  };

  await prisma.deal_network_pilot_participants.update({
    where: { id: participantDbId },
    data: {
      participant_payload: next as unknown as Prisma.InputJsonValue,
    },
  });

  return tokenData.token;
}
