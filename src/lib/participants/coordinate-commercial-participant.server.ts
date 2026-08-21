import 'server-only';

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/server/prisma';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { generatePaymentRequestForParticipant } from '@/lib/commercial/payment-request.server';
import { dispatchCommercialNotification } from '@/lib/commercial/dispatch-commercial-notification.server';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { sendEmail } from '@/lib/email/client';
import { buildParticipantAgreementInviteEmail } from '@/lib/email/templates/participant-agreement-invite';
import {
  appendOnboardingEvent,
  buildSupplierVerification,
  nextApprovalVersion,
  type StoredOnboardingState,
  type ApprovalMetadata,
} from '@/lib/commercial/supplier-onboarding-domain';
import {
  issueAndPersistParticipantAttribution,
  updatePilotParticipantPayload,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { ensureParticipantPortalToken } from '@/lib/participant-portal/participant-portal.server';
import { buildParticipantWorkspaceUrl } from '@/lib/participant-portal/participant-portal-url';
import {
  applyParticipantAgreementGenerated,
  applyParticipantAgreementShared,
} from '@/lib/operations/lifecycle/participant-lifecycle';
import { orchestrateOperationalMutation } from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';
import { applyPayoutVerificationConfirmed } from '@/lib/projects/participant-lifecycle';
import { participantWorkspacePathFromParticipant } from '@/lib/projects/participant-entitlement';
import {
  ensureReferralIssuance,
  resolveOrganizationIdForPilotDeal,
} from '@/lib/referrals/ensure-referral-issuance';
import { defaultReferralCommerce, normalizeReferralCommerce } from '@/lib/referrals/referral-commerce-config';
import { buildReferralQrApiPath } from '@/lib/referrals/referral-share-url';
import {
  compensationKindOf,
  listMissingPayoutFields,
  referralEligibilityOf,
  type ParticipantCoordinationAction,
} from '@/lib/workflows/agreement-intelligence/participant-coordination';

export class CommercialCoordinationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = 'CommercialCoordinationError';
  }
}

export type CommercialCoordinationResult = {
  created?: boolean;
  participant?: DemoParticipant;
  workspaceUrl?: string;
  portalUrl?: string;
  referralUrl?: string;
  referralCode?: string;
  qrUrl?: string;
  destinationLabel?: string | null;
  requestedChanges?: string;
  missingFields?: string[];
  invitationEmailSent?: boolean;
};

async function deliverAgreementInvitation(input: {
  participant: DemoParticipant;
  userId: string;
  workspaceUrl: string;
}): Promise<boolean> {
  const to = input.participant.email?.trim();
  if (!to) return false;

  const row = await prisma.deal_network_pilot_participants.findUnique({
    where: { id: input.participant.id },
    include: { deal: true },
  });
  const dealPayload = row?.deal?.deal_payload as { dealName?: string } | null;
  const projectName = dealPayload?.dealName?.trim() || row?.deal?.name?.trim() || 'Referral Management';
  const org = await getOrganizationForAuthenticatedUser(input.userId);
  const content = buildParticipantAgreementInviteEmail({
    participantName: input.participant.name,
    operatorName: org?.name ?? 'Your organiser',
    projectName,
    workspaceUrl: input.workspaceUrl,
  });
  const sent = await sendEmail({
    to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    tags: [
      { name: 'category', value: 'participant-agreement-invite' },
      { name: 'participant_id', value: input.participant.id },
    ],
  });
  return sent.success;
}

async function requestApproval(input: {
  participant: DemoParticipant;
  userId: string;
  origin?: string;
  sendInvitationEmail?: boolean;
}): Promise<CommercialCoordinationResult> {
  if (input.participant.approvalStatus === 'Approved' && input.participant.participantPortalToken) {
    const workspaceUrl = buildParticipantWorkspaceUrl(
      input.participant.participantPortalToken,
      input.origin
    );
    return {
      created: false,
      participant: input.participant,
      workspaceUrl,
      invitationEmailSent: false,
    };
  }

  const portal = await ensureParticipantPortalToken(input.participant.id, input.userId);
  let next = portal.participant;
  const path = participantWorkspacePathFromParticipant(next);
  if (!next.agreementUrl || next.agreementUrl.includes('/deal-invites/')) {
    next = applyParticipantAgreementGenerated(next, path);
  }

  let created = false;
  if (!next.agreementSharedAt) {
    next = applyParticipantAgreementShared(next);
    created = true;
    const persisted = await updatePilotParticipantPayload(input.participant.id, input.userId, {
      agreementUrl: next.agreementUrl,
      agreementSharedAt: next.agreementSharedAt,
      inviteSentAt: next.inviteSentAt,
      inviteStatus: next.inviteStatus,
      agreementLifecycle: next.agreementLifecycle,
      participantLifecycle: next.participantLifecycle,
      participantPortalToken: portal.token,
    });
    next = persisted ?? next;
  }

  const workspaceUrl = buildParticipantWorkspaceUrl(portal.token, input.origin);
  let invitationEmailSent = false;
  if (input.sendInvitationEmail) {
    invitationEmailSent = await deliverAgreementInvitation({
      participant: next,
      userId: input.userId,
      workspaceUrl,
    });
  }

  return {
    created,
    participant: next,
    workspaceUrl,
    invitationEmailSent,
  };
}

async function requestPayoutDetails(input: {
  participant: DemoParticipant;
  userId: string;
  organizationId: string;
  origin?: string;
}): Promise<CommercialCoordinationResult> {
  if (input.participant.approvalStatus !== 'Approved') {
    throw new CommercialCoordinationError(
      'Participant must approve the agreement before payout details can be requested.',
      'INVALID_STATE',
      422
    );
  }
  const result = await generatePaymentRequestForParticipant(input.participant.id, input.userId, {
    sendEmail: Boolean(input.participant.email?.trim()),
    origin: input.origin,
  });
  if (!result) {
    throw new CommercialCoordinationError('Participant not found', 'NOT_FOUND', 404);
  }

  await orchestrateOperationalMutation({
    userId: input.userId,
    mutation: 'supplier_onboarding',
    projectId: input.participant.dealId,
    focusParticipant: result.participant,
  });

  void dispatchCommercialNotification({
    organizationId: input.organizationId,
    eventKind: 'supplier_onboarding_started',
    projectId: input.participant.dealId,
    participantId: input.participant.id,
    participantName: input.participant.name,
    emailDispatched: result.emailSent,
  });

  return {
    created: !input.participant.paymentSetup?.paymentRequestGeneratedAt,
    participant: result.participant,
    portalUrl: result.portalUrl,
  };
}

async function approvePayoutDetails(input: {
  participant: DemoParticipant;
  userId: string;
  organizationId: string;
}): Promise<CommercialCoordinationResult> {
  const existingStored = input.participant.supplierOnboarding as StoredOnboardingState | undefined;
  if (!existingStored?.submission?.submittedAt) {
    throw new CommercialCoordinationError(
      'Participant has not submitted payout details yet.',
      'INVALID_STATE',
      422
    );
  }
  if (existingStored.lifecycle === 'APPROVED' && input.participant.payoutVerificationConfirmed) {
    return { created: false, participant: input.participant };
  }

  const now = new Date().toISOString();
  const version = nextApprovalVersion(existingStored.events ?? []);
  const approvedEvent = {
    id: uuidv4(),
    type: 'SUPPLIER_ONBOARDING_APPROVED' as const,
    participantId: input.participant.id,
    performedBy: input.userId,
    timestamp: now,
    payload: { approvalNotes: undefined, approvalVersion: version },
  };
  const approvalMetadata: ApprovalMetadata = {
    approvedBy: input.userId,
    approvedAt: now,
    approvalNotes: null,
    approvalVersion: version,
  };
  const updatedOnboarding: StoredOnboardingState = {
    ...existingStored,
    operator: {
      approvedAt: now,
      xeroExportedAt: existingStored.operator?.xeroExportedAt ?? null,
      notes: existingStored.operator?.notes ?? null,
    },
    events: appendOnboardingEvent(existingStored.events ?? [], approvedEvent),
    verification: buildSupplierVerification(existingStored, { supplierApproved: true }),
    approval: approvalMetadata,
    rejection: undefined,
    lifecycle: 'APPROVED',
  };
  const withVerification = applyPayoutVerificationConfirmed(input.participant, true);
  const persisted = await updatePilotParticipantPayload(input.participant.id, input.userId, {
    ...withVerification,
    supplierOnboarding: updatedOnboarding,
    payoutVerificationConfirmed: true,
    payoutVerificationConfirmedAt: now,
  });
  if (!persisted) {
    throw new CommercialCoordinationError('Participant not found', 'NOT_FOUND', 404);
  }

  void dispatchCommercialNotification({
    organizationId: input.organizationId,
    eventKind: 'supplier_onboarding_approved',
    projectId: input.participant.dealId,
    participantId: input.participant.id,
    participantName: input.participant.name,
  });

  return { created: true, participant: persisted };
}

async function flagPayoutDetails(input: {
  participant: DemoParticipant;
  userId: string;
  missingFields?: string[];
  requestedChanges?: string;
}): Promise<CommercialCoordinationResult> {
  const existingStored = input.participant.supplierOnboarding as StoredOnboardingState | undefined;
  if (!existingStored?.submission?.submittedAt) {
    throw new CommercialCoordinationError(
      'Participant has not submitted payout details yet.',
      'INVALID_STATE',
      422
    );
  }

  const missing =
    input.missingFields?.filter((field) => field.trim()) ?? listMissingPayoutFields(input.participant);
  const requestedChanges =
    input.requestedChanges?.trim() ||
    (missing.length > 0 ? `Missing: ${missing.join(', ')}` : 'Please update your payout details.');

  const lastChange = [...(existingStored.events ?? [])]
    .reverse()
    .find((event) => event.type === 'SUPPLIER_ONBOARDING_CHANGES_REQUESTED');
  if (
    existingStored.lifecycle === 'IN_PROGRESS' &&
    lastChange?.payload &&
    'requestedChanges' in lastChange.payload &&
    lastChange.payload.requestedChanges === requestedChanges
  ) {
    return { created: false, participant: input.participant, requestedChanges, missingFields: missing };
  }

  const now = new Date().toISOString();
  const changesEvent = {
    id: uuidv4(),
    type: 'SUPPLIER_ONBOARDING_CHANGES_REQUESTED' as const,
    participantId: input.participant.id,
    performedBy: input.userId,
    timestamp: now,
    payload: { requestedChanges },
  };
  const updatedOnboarding: StoredOnboardingState = {
    ...existingStored,
    events: appendOnboardingEvent(existingStored.events ?? [], changesEvent),
    verification: buildSupplierVerification(existingStored, { supplierApproved: false }),
    lifecycle: 'IN_PROGRESS',
  };
  const persisted = await updatePilotParticipantPayload(input.participant.id, input.userId, {
    supplierOnboarding: updatedOnboarding,
    payoutVerificationConfirmed: false,
  });
  if (!persisted) {
    throw new CommercialCoordinationError('Participant not found', 'NOT_FOUND', 404);
  }

  return { created: true, participant: persisted, requestedChanges, missingFields: missing };
}

async function activateReferral(input: {
  participant: DemoParticipant;
  userId: string;
  organizationId: string;
}): Promise<CommercialCoordinationResult> {
  const kind = compensationKindOf(input.participant);
  if (kind === 'fixed' || kind == null) {
    throw new CommercialCoordinationError(
      'Fixed payment arrangements do not generate referral links.',
      'INVALID_STATE',
      422
    );
  }
  if (input.participant.approvalStatus !== 'Approved') {
    throw new CommercialCoordinationError(
      'Participant must approve the agreement before referral activation.',
      'INVALID_STATE',
      422
    );
  }

  const services = await prisma.organization_services.findMany({
    where: { organization_id: input.organizationId, active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const eligibility = referralEligibilityOf(input.participant, services);
  if (eligibility.status === 'service_required') {
    throw new CommercialCoordinationError(
      'Service selection required before a referral destination can be generated.',
      'INVALID_STATE',
      422
    );
  }

  if (input.participant.customerCommerceUrl?.trim() && input.participant.referralCode?.trim()) {
    return {
      created: false,
      participant: input.participant,
      referralUrl: input.participant.customerCommerceUrl,
      referralCode: input.participant.referralCode,
      qrUrl: buildReferralQrApiPath(input.participant.referralCode),
      destinationLabel: eligibility.destinationLabel,
    };
  }

  const row = await prisma.deal_network_pilot_participants.findUnique({
    where: { id: input.participant.id },
    include: { deal: true },
  });
  if (!row?.deal || row.deal.user_id !== input.userId) {
    throw new CommercialCoordinationError('Participant not found', 'NOT_FOUND', 404);
  }

  const percentage =
    input.participant.compensationProfile?.percentage ?? input.participant.commissionValue ?? 10;
  const enabledServiceIds =
    input.participant.compensationProfile?.commissionServiceIds ??
    input.participant.referralCommerce?.enabledServiceIds ??
    [];
  const selectedMode = input.participant.compensationProfile?.commissionSourceMode === 'selected';
  if (selectedMode && enabledServiceIds.length === 0) {
    throw new CommercialCoordinationError(
      'Service selection required before a referral destination can be generated.',
      'INVALID_STATE',
      422
    );
  }

  const referralCommerce = normalizeReferralCommerce({
    ...defaultReferralCommerce(),
    createReferralLink: true,
    commissionMode: kind === 'commission' ? 'referral_commerce' : 'project_revenue_share',
    commerceCommissionPct: percentage,
    enabledServiceIds,
  });

  const withCommerce: DemoParticipant = {
    ...input.participant,
    referralCommerce,
  };

  if (kind === 'commission') {
    const activated = await issueAndPersistParticipantAttribution({
      row,
      participant: withCommerce,
    });
    if (!activated.referralIssuance?.referralUrl) {
      throw new CommercialCoordinationError(
        'Service selection required before a referral destination can be generated.',
        'INVALID_STATE',
        422
      );
    }
    return {
      created: activated.referralIssuance.created,
      participant: activated.participant,
      referralUrl: activated.referralIssuance.referralUrl,
      referralCode: activated.referralIssuance.code,
      qrUrl: buildReferralQrApiPath(activated.referralIssuance.code),
      destinationLabel: eligibility.destinationLabel,
    };
  }

  const dealOrg = await resolveOrganizationIdForPilotDeal(row.deal.user_id, row.deal_id);
  if (dealOrg && dealOrg !== input.organizationId) {
    throw new CommercialCoordinationError('Forbidden', 'FORBIDDEN', 403);
  }

  const issued = await ensureReferralIssuance({
    organizationId: input.organizationId,
    operatorUserId: input.userId,
    participantEmail: input.participant.email,
    participantName: input.participant.name,
    sourceParticipantId: row.id,
    referralCodeHint: input.participant.referralCode ?? null,
    commissionKind: input.participant.commissionKind,
    commissionValue: input.participant.commissionValue,
    projectLabel: (row.deal.deal_payload as { dealName?: string } | null)?.dealName ?? null,
    referralCommerce,
  });

  const payloadWithLink: DemoParticipant = {
    ...withCommerce,
    referralCode: issued.code,
    inviteLink: issued.referralUrl,
    customerCommerceUrl: issued.referralUrl,
    attributionStatus: 'active',
  };
  const persisted = await updatePilotParticipantPayload(row.id, input.userId, {
    referralCode: issued.code,
    inviteLink: issued.referralUrl,
    customerCommerceUrl: issued.referralUrl,
    attributionStatus: 'active',
    referralCommerce,
  });

  await orchestrateOperationalMutation({
    userId: input.userId,
    mutation: 'attribution_update',
    projectId: row.deal_id,
    focusParticipant: persisted ?? payloadWithLink,
  });

  return {
    created: issued.created,
    participant: persisted ?? payloadWithLink,
    referralUrl: issued.referralUrl,
    referralCode: issued.code,
    qrUrl: buildReferralQrApiPath(issued.code),
    destinationLabel: eligibility.destinationLabel,
  };
}

export async function executeCommercialParticipantAction(input: {
  participant: DemoParticipant;
  userId: string;
  organizationId: string;
  action: ParticipantCoordinationAction;
  origin?: string;
  missingFields?: string[];
  requestedChanges?: string;
  sendInvitationEmail?: boolean;
}): Promise<CommercialCoordinationResult> {
  switch (input.action) {
    case 'request_approval':
      return requestApproval(input);
    case 'request_payout_details':
      return requestPayoutDetails(input);
    case 'approve_payout_details':
      return approvePayoutDetails(input);
    case 'flag_payout_details':
      return flagPayoutDetails(input);
    case 'activate_referral':
      return activateReferral(input);
    default:
      throw new CommercialCoordinationError('Unsupported action', 'INVALID_INPUT', 400);
  }
}
