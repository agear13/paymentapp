/**
 * Payment request generation — operator-initiated transition from
 * AGREEMENT_ACCEPTED → PAYMENT_INFO_PENDING.
 */
import 'server-only';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/server/prisma';
import type { Prisma } from '@prisma/client';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  createPaymentSetupToken,
  persistDraftInvoice,
  persistPaymentSetupToken,
} from '@/lib/commercial/payment-setup.server';
import { buildSupplierOnboardingInput } from '@/lib/commercial/build-supplier-onboarding-input';
import { generateDraftInvoice } from '@/lib/commercial/supplier-onboarding';
import {
  appendOnboardingEvent,
  type StoredOnboardingState,
} from '@/lib/commercial/supplier-onboarding-domain';
import type { PersistedDraftInvoice } from '@/lib/commercial/payment-setup-types';
import {
  isPaymentRequestSent,
  type PaymentRequestPortalStatus,
} from '@/lib/commercial/participant-commercial-lifecycle';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { sendEmail } from '@/lib/email/client';
import { buildPaymentSetupInviteEmail } from '@/lib/email/templates/payment-setup-invite';
import { dispatchCommercialNotification } from '@/lib/commercial/dispatch-commercial-notification.server';
import { log } from '@/lib/logger';

export function buildPaymentSetupPortalUrl(token: string): string {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://app.provvypay.com');
  return `${appUrl}/payment-setup/${token}`;
}

function hasValidPaymentToken(participant: DemoParticipant): boolean {
  const ps = participant.paymentSetup;
  if (!ps?.token || !ps.tokenExpiresAt) return false;
  return new Date(ps.tokenExpiresAt) > new Date();
}

export type { PaymentRequestPortalStatus };

export { derivePaymentRequestPortalStatus } from '@/lib/commercial/participant-commercial-lifecycle';

export type GeneratePaymentRequestResult = {
  participant: DemoParticipant;
  portalUrl: string;
  tokenExpiresAt: string;
  emailSent: boolean;
  emailError?: string;
};

export async function generatePaymentRequestForParticipant(
  participantId: string,
  operatorUserId: string,
  options?: { sendEmail?: boolean }
): Promise<GeneratePaymentRequestResult | null> {
  const row = await prisma.deal_network_pilot_participants.findUnique({
    where: { id: participantId },
    include: { deal: true },
  });
  if (!row || row.deal.user_id !== operatorUserId) return null;

  const cur = row.participant_payload as unknown as DemoParticipant;
  if (cur.approvalStatus !== 'Approved') {
    throw new Error('PARTICIPANT_NOT_APPROVED');
  }

  const dealPayload = row.deal.deal_payload as { dealName?: string };
  const dealName = dealPayload.dealName ?? row.deal.name ?? 'Your project';
  const now = new Date().toISOString();

  const input = buildSupplierOnboardingInput(cur, { id: row.deal_id, name: dealName });
  const derived = generateDraftInvoice(input);

  const portalUrlFromExisting =
    hasValidPaymentToken(cur) && cur.paymentSetup?.token
      ? buildPaymentSetupPortalUrl(cur.paymentSetup.token)
      : null;

  if (isPaymentRequestSent(cur) && portalUrlFromExisting) {
    let emailSent = false;
    let emailError: string | undefined;
    if (options?.sendEmail && cur.email?.trim()) {
      try {
        const org = await getOrganizationForAuthenticatedUser(operatorUserId);
        const invoiceTotal = new Intl.NumberFormat('en-AU', {
          style: 'currency',
          currency: derived.currency,
        }).format(derived.total);
        const emailContent = buildPaymentSetupInviteEmail({
          supplierName: cur.name,
          operatorName: org?.name ?? 'Your organiser',
          projectName: dealName,
          invoiceTotal,
          portalUrl: portalUrlFromExisting,
          expiresAt: cur.paymentSetup!.tokenExpiresAt!,
        });
        await sendEmail({
          to: cur.email.trim(),
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
          tags: [
            { name: 'category', value: 'payment-request' },
            { name: 'participant_id', value: participantId },
          ],
        });
        emailSent = true;
      } catch (err) {
        emailError = err instanceof Error ? err.message : 'Email failed';
        log.error('payment-request: email dispatch failed', undefined, {
          participantId,
          error: emailError,
        });
      }
    }
    return {
      participant: { ...cur, id: row.id, dealId: row.deal_id, inviteToken: row.invite_token },
      portalUrl: portalUrlFromExisting,
      tokenExpiresAt: cur.paymentSetup!.tokenExpiresAt!,
      emailSent,
      emailError,
    };
  }

  let persistedInvoice: PersistedDraftInvoice | undefined = cur.paymentSetup?.draftInvoice;
  if (!persistedInvoice) {
    persistedInvoice = {
      id: uuidv4(),
      createdAt: now,
      status: 'SUPPLIER_REVIEW',
      supplier: cur.name,
      participantId: cur.id,
      agreementReference: null,
      projectName: dealName,
      description: derived.description,
      currency: derived.currency,
      subtotal: derived.subtotal,
      gstAmount: derived.gstAmount,
      total: derived.total,
      gstIncluded: derived.gstStatus === 'yes',
      gstStatus: derived.gstStatus,
      dueDate: derived.dueDate ?? null,
      lineItems: [
        {
          description: derived.description,
          quantity: 1,
          unitAmount: derived.subtotal,
          taxType: derived.gstStatus === 'yes' ? 'INPUT' : 'NONE',
        },
      ],
    };
    await persistDraftInvoice(participantId, persistedInvoice);
  } else if (persistedInvoice.status === 'DRAFT') {
    persistedInvoice = { ...persistedInvoice, status: 'SUPPLIER_REVIEW' };
    await persistDraftInvoice(participantId, persistedInvoice);
  }

  const tokenData = createPaymentSetupToken();
  await persistPaymentSetupToken(participantId, tokenData);

  const existingStored = cur.supplierOnboarding as StoredOnboardingState | undefined;
  const paymentRequestEvent = {
    id: uuidv4(),
    type: 'SUPPLIER_INVOICE_GENERATED' as const,
    participantId,
    performedBy: operatorUserId,
    timestamp: now,
    payload: {
      invoiceAmount: derived.total,
      currency: derived.currency,
      gstStatus: derived.gstStatus,
    },
  };

  const updatedOnboarding: StoredOnboardingState = {
    ...existingStored,
    lifecycle: 'INVITED',
    events: appendOnboardingEvent(existingStored?.events ?? [], paymentRequestEvent),
  };

  const next: DemoParticipant = {
    ...cur,
    id: row.id,
    dealId: row.deal_id,
    inviteToken: row.invite_token,
    payoutOnboardingPhase: 'INVITED',
    onboardingStatus: 'INCOMPLETE',
    supplierOnboarding: updatedOnboarding,
    paymentSetup: {
      ...cur.paymentSetup,
      ...tokenData,
      paymentRequestGeneratedAt: now,
      draftInvoice: persistedInvoice ?? cur.paymentSetup?.draftInvoice,
    },
  };

  await prisma.deal_network_pilot_participants.update({
    where: { id: row.id },
    data: {
      participant_payload: next as unknown as Prisma.InputJsonValue,
    },
  });

  const portalUrl = buildPaymentSetupPortalUrl(tokenData.token);
  let emailSent = false;
  let emailError: string | undefined;

  if (options?.sendEmail && cur.email?.trim()) {
    try {
      const org = await getOrganizationForAuthenticatedUser(operatorUserId);
      const invoiceTotal = new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: derived.currency,
      }).format(derived.total);

      const emailContent = buildPaymentSetupInviteEmail({
        supplierName: cur.name,
        operatorName: org?.name ?? 'Your organiser',
        projectName: dealName,
        invoiceTotal,
        portalUrl,
        expiresAt: tokenData.tokenExpiresAt,
      });

      await sendEmail({
        to: cur.email.trim(),
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        tags: [
          { name: 'category', value: 'payment-request' },
          { name: 'participant_id', value: participantId },
        ],
      });
      emailSent = true;
    } catch (err) {
      emailError = err instanceof Error ? err.message : 'Email failed';
      log.error('payment-request: email dispatch failed', undefined, {
        participantId,
        error: emailError,
      });
    }
  }

  const org = await getOrganizationForAuthenticatedUser(operatorUserId);
  if (org) {
    void dispatchCommercialNotification({
      organizationId: org.id,
      eventKind: 'supplier_onboarding_started',
      projectId: row.deal_id,
      participantId,
      participantName: cur.name,
    });
  }

  return {
    participant: next,
    portalUrl,
    tokenExpiresAt: tokenData.tokenExpiresAt,
    emailSent,
    emailError,
  };
}

/** Record first portal open — does not change commercial lifecycle stage. */
export async function recordPaymentPortalOpened(participantId: string): Promise<void> {
  const row = await prisma.deal_network_pilot_participants.findUnique({
    where: { id: participantId },
  });
  if (!row) return;

  const cur = row.participant_payload as unknown as DemoParticipant;
  if (cur.paymentSetup?.portalFirstOpenedAt) return;

  const now = new Date().toISOString();
  const existingStored = cur.supplierOnboarding as StoredOnboardingState | undefined;
  const next: DemoParticipant = {
    ...cur,
    payoutOnboardingPhase: 'IN_PROGRESS',
    supplierOnboarding: {
      ...existingStored,
      lifecycle: existingStored?.lifecycle === 'INVITED' ? 'IN_PROGRESS' : existingStored?.lifecycle,
    },
    paymentSetup: {
      ...cur.paymentSetup,
      portalFirstOpenedAt: now,
    },
  };

  await prisma.deal_network_pilot_participants.update({
    where: { id: participantId },
    data: { participant_payload: next as unknown as Prisma.InputJsonValue },
  });
}
