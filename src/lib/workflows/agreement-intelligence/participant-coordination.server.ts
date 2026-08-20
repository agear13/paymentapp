import 'server-only';

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/server/prisma';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { generatePaymentRequestForParticipant } from '@/lib/commercial/payment-request.server';
import { dispatchCommercialNotification } from '@/lib/commercial/dispatch-commercial-notification.server';
import {
  appendOnboardingEvent,
  buildSupplierVerification,
  nextApprovalVersion,
  type StoredOnboardingState,
  type ApprovalMetadata,
} from '@/lib/commercial/supplier-onboarding-domain';
import {
  getPilotSnapshotForUser,
  issueAndPersistParticipantAttribution,
  updatePilotParticipantPayload,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { ensureParticipantPortalToken } from '@/lib/participant-portal/participant-portal.server';
import { buildParticipantWorkspaceUrl } from '@/lib/participant-portal/participant-portal-url';
import {
  applyParticipantAgreementGenerated,
  applyParticipantAgreementShared,
} from '@/lib/operations/lifecycle/participant-lifecycle';
import {
  orchestrateOperationalMutation,
} from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';
import { applyPayoutVerificationConfirmed } from '@/lib/projects/participant-lifecycle';
import { participantWorkspacePathFromParticipant } from '@/lib/projects/participant-entitlement';
import {
  ensureReferralIssuance,
  resolveOrganizationIdForPilotDeal,
} from '@/lib/referrals/ensure-referral-issuance';
import { defaultReferralCommerce, normalizeReferralCommerce } from '@/lib/referrals/referral-commerce-config';
import { buildReferralQrApiPath } from '@/lib/referrals/referral-share-url';
import { getWorkflowAgreementContext, refreshWorkflowActivation } from '@/lib/workflows/agreement-intelligence/agreement-service.server';
import { WorkflowAgreementError } from '@/lib/workflows/agreement-intelligence/types';
import {
  AGREEMENT_INTELLIGENCE_SLUG,
  compensationKindOf,
  listMissingPayoutFields,
  referralEligibilityOf,
  type ParticipantCoordinationAction,
} from '@/lib/workflows/agreement-intelligence/participant-coordination';
import { parseAgreementIntelligenceConfiguration } from '@/lib/workflows/agreement-intelligence/configuration';

export class ParticipantCoordinationError extends WorkflowAgreementError {}

async function requireOperationalWorkflow(input: {
  organizationId: string;
  workflowId: string;
  userId: string;
  participantId: string;
}) {
  const row = await prisma.organization_workflows.findFirst({
    where: { id: input.workflowId, organization_id: input.organizationId },
    include: { agreement: true },
  });
  if (!row) {
    throw new ParticipantCoordinationError('Workflow not found', 'NOT_FOUND', 404);
  }
  if (row.template_slug !== AGREEMENT_INTELLIGENCE_SLUG) {
    throw new ParticipantCoordinationError(
      'This endpoint is only available for Agreement Intelligence workflows',
      'NOT_AGREEMENT_INTELLIGENCE',
      400
    );
  }
  if (row.status === 'PAUSED') {
    throw new ParticipantCoordinationError(
      'Workflow is paused. Resume before coordinating participants.',
      'INVALID_STATE',
      409
    );
  }
  if (row.lifecycle_status !== 'ACTIVE' && row.lifecycle_status !== 'PARTICIPANT_SETUP') {
    throw new ParticipantCoordinationError(
      'Participant coordination is only available after the workflow is activated.',
      'INVALID_STATE',
      409
    );
  }

  const pilotDealId = row.agreement?.pilot_deal_id;
  if (!pilotDealId) {
    throw new ParticipantCoordinationError('Workflow has no commercial graph', 'INVALID_STATE', 409);
  }

  const snapshot = await getPilotSnapshotForUser(input.userId);
  const participant = snapshot.participants.find((rowParticipant) => rowParticipant.id === input.participantId);
  if (!participant || participant.dealId !== pilotDealId) {
    throw new ParticipantCoordinationError('Participant not found', 'NOT_FOUND', 404);
  }
  if (!compensationKindOf(participant)) {
    throw new ParticipantCoordinationError(
      'Contractual parties are not part of payout or referral coordination.',
      'INVALID_STATE',
      422
    );
  }

  return {
    workflow: row,
    pilotDealId,
    participant,
    configuration: parseAgreementIntelligenceConfiguration(row.configuration),
  };
}

async function contextAfterMutation(input: {
  organizationId: string;
  workflowId: string;
  userId: string;
}) {
  await refreshWorkflowActivation(input);
  return getWorkflowAgreementContext(input.organizationId, input.workflowId, input.userId);
}

async function requestApproval(input: {
  participant: DemoParticipant;
  userId: string;
  origin?: string;
}) {
  if (input.participant.approvalStatus === 'Approved' && input.participant.participantPortalToken) {
    return {
      created: false,
      participant: input.participant,
      workspaceUrl: buildParticipantWorkspaceUrl(input.participant.participantPortalToken, input.origin),
    };
  }

  const portal = await ensureParticipantPortalToken(input.participant.id, input.userId);
  let next = portal.participant;
  const path = participantWorkspacePathFromParticipant(next);
  if (!next.agreementUrl || next.agreementUrl.includes('/deal-invites/')) {
    next = applyParticipantAgreementGenerated(next, path);
  }

  if (next.agreementSharedAt) {
    return {
      created: false,
      participant: next,
      workspaceUrl: buildParticipantWorkspaceUrl(portal.token, input.origin),
    };
  }

  next = applyParticipantAgreementShared(next);
  const persisted = await updatePilotParticipantPayload(input.participant.id, input.userId, {
    agreementUrl: next.agreementUrl,
    agreementSharedAt: next.agreementSharedAt,
    inviteSentAt: next.inviteSentAt,
    inviteStatus: next.inviteStatus,
    agreementLifecycle: next.agreementLifecycle,
    participantLifecycle: next.participantLifecycle,
    participantPortalToken: portal.token,
  });

  return {
    created: true,
    participant: persisted ?? next,
    workspaceUrl: buildParticipantWorkspaceUrl(portal.token, input.origin),
  };
}

async function requestPayoutDetails(input: {
  participant: DemoParticipant;
  userId: string;
  organizationId: string;
}) {
  const result = await generatePaymentRequestForParticipant(input.participant.id, input.userId, {
    sendEmail: Boolean(input.participant.email?.trim()),
  });
  if (!result) {
    throw new ParticipantCoordinationError('Participant not found', 'NOT_FOUND', 404);
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
}) {
  const existingStored = input.participant.supplierOnboarding as StoredOnboardingState | undefined;
  if (!existingStored?.submission?.submittedAt) {
    throw new ParticipantCoordinationError(
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
    throw new ParticipantCoordinationError('Participant not found', 'NOT_FOUND', 404);
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
}) {
  const existingStored = input.participant.supplierOnboarding as StoredOnboardingState | undefined;
  if (!existingStored?.submission?.submittedAt) {
    throw new ParticipantCoordinationError(
      'Participant has not submitted payout details yet.',
      'INVALID_STATE',
      422
    );
  }

  const missing = input.missingFields?.filter((field) => field.trim()) ?? listMissingPayoutFields(input.participant);
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
    throw new ParticipantCoordinationError('Participant not found', 'NOT_FOUND', 404);
  }

  return { created: true, participant: persisted, requestedChanges, missingFields: missing };
}

async function activateReferral(input: {
  participant: DemoParticipant;
  userId: string;
  organizationId: string;
}) {
  const kind = compensationKindOf(input.participant);
  if (kind === 'fixed' || kind == null) {
    throw new ParticipantCoordinationError(
      'Fixed payment arrangements do not generate referral links.',
      'INVALID_STATE',
      422
    );
  }
  if (input.participant.approvalStatus !== 'Approved') {
    throw new ParticipantCoordinationError(
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
    throw new ParticipantCoordinationError(
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
    throw new ParticipantCoordinationError('Participant not found', 'NOT_FOUND', 404);
  }

  const percentage =
    input.participant.compensationProfile?.percentage ?? input.participant.commissionValue ?? 10;
  const referralCommerce = normalizeReferralCommerce({
    ...defaultReferralCommerce(),
    createReferralLink: true,
    commissionMode: kind === 'commission' ? 'referral_commerce' : 'project_revenue_share',
    commerceCommissionPct: percentage,
    enabledServiceIds:
      input.participant.compensationProfile?.commissionServiceIds ??
      input.participant.referralCommerce?.enabledServiceIds ??
      [],
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
      throw new ParticipantCoordinationError(
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
    throw new ParticipantCoordinationError('Forbidden', 'FORBIDDEN', 403);
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

export async function runParticipantCoordinationAction(input: {
  organizationId: string;
  workflowId: string;
  userId: string;
  participantId: string;
  action: ParticipantCoordinationAction;
  origin?: string;
  missingFields?: string[];
  requestedChanges?: string;
}) {
  const scoped = await requireOperationalWorkflow(input);

  let result: Record<string, unknown> = {};
  switch (input.action) {
    case 'request_approval': {
      result = await requestApproval({
        participant: scoped.participant,
        userId: input.userId,
        origin: input.origin,
      });
      break;
    }
    case 'request_payout_details': {
      if (scoped.participant.approvalStatus !== 'Approved') {
        throw new ParticipantCoordinationError(
          'Participant must approve the agreement before payout details can be requested.',
          'INVALID_STATE',
          422
        );
      }
      result = await requestPayoutDetails({
        participant: scoped.participant,
        userId: input.userId,
        organizationId: input.organizationId,
      });
      break;
    }
    case 'approve_payout_details': {
      result = await approvePayoutDetails({
        participant: scoped.participant,
        userId: input.userId,
        organizationId: input.organizationId,
      });
      break;
    }
    case 'flag_payout_details': {
      result = await flagPayoutDetails({
        participant: scoped.participant,
        userId: input.userId,
        missingFields: input.missingFields,
        requestedChanges: input.requestedChanges,
      });
      break;
    }
    case 'activate_referral': {
      result = await activateReferral({
        participant: scoped.participant,
        userId: input.userId,
        organizationId: input.organizationId,
      });
      break;
    }
    default:
      throw new ParticipantCoordinationError('Unsupported action', 'INVALID_INPUT', 400);
  }

  const context = await contextAfterMutation({
    organizationId: input.organizationId,
    workflowId: input.workflowId,
    userId: input.userId,
  });

  return {
    ...context,
    coordination: {
      action: input.action,
      ...result,
    },
  };
}
