import 'server-only';

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/server/prisma';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { buildOnboardingParticipant } from '@/lib/onboarding/build-onboarding-project';
import type { OnboardingParticipantRole } from '@/lib/onboarding/operator-onboarding-types';
import {
  createPilotParticipantForUser,
  getPilotSnapshotForUser,
  updatePilotParticipantPayload,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { orchestrateOperationalMutation } from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';
import {
  defaultReferralCommerce,
  normalizeReferralCommerce,
  shouldIssueReferralLink,
} from '@/lib/referrals/referral-commerce-config';
import { ensureReferralIssuance } from '@/lib/referrals/ensure-referral-issuance';
import { buildInviteCompensationProfile } from '@/lib/participants/participant-compensation';
import {
  CommercialCoordinationError,
  executeCommercialParticipantAction,
} from '@/lib/participants/coordinate-commercial-participant.server';
import { compensationKindOf } from '@/lib/workflows/agreement-intelligence/participant-coordination';
import type { ParticipantCoordinationAction } from '@/lib/workflows/agreement-intelligence/participant-coordination';
import { ensureReferralManagementDeal } from '@/lib/workflows/referral-management/ensure-program-deal.server';
import {
  REFERRAL_MANAGEMENT_SLUG,
  compensationServiceIds,
  type ReferralCompensationInput,
  type ReferralPromoterRole,
} from '@/lib/workflows/referral-management/constants';
import { getReferralManagementContext } from '@/lib/workflows/referral-management/hub.server';
import { proveSourceOrganizationFromWorkflow } from '@/lib/workflows/prove-source-organization.server';
import {
  buildExistingPromoterRelationship,
  DUPLICATE_PROMOTER_MESSAGE,
  isCompensatedPromoterEmailMatch,
  type ExistingPromoterRelationship,
} from '@/lib/workflows/referral-management/promoter-duplicate';

export class ReferralManagementError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number = 400,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'ReferralManagementError';
  }
}

function mapRole(role: ReferralPromoterRole): OnboardingParticipantRole {
  if (role === 'Other') return 'Stakeholder';
  return role;
}

async function requireReferralManagementWorkflow(input: {
  organizationId: string;
  workflowId: string;
  userId: string;
  participantId?: string;
}) {
  const row = await prisma.organization_workflows.findFirst({
    where: { id: input.workflowId, organization_id: input.organizationId },
  });
  if (!row) {
    throw new ReferralManagementError('Workflow not found', 'NOT_FOUND', 404);
  }
  if (row.template_slug !== REFERRAL_MANAGEMENT_SLUG) {
    throw new ReferralManagementError(
      'This endpoint is only available for Referral Management workflows',
      'INVALID_TEMPLATE',
      400
    );
  }
  if (row.status === 'PAUSED') {
    throw new ReferralManagementError(
      'Workflow is paused. Resume before coordinating promoters.',
      'INVALID_STATE',
      409
    );
  }

  const snapshot = await getPilotSnapshotForUser(input.userId);
  const participant = input.participantId
    ? snapshot.participants.find((item) => item.id === input.participantId) ?? null
    : null;
  if (input.participantId && !participant) {
    throw new ReferralManagementError('Participant not found', 'NOT_FOUND', 404);
  }
  if (participant && !compensationKindOf(participant)) {
    throw new ReferralManagementError(
      'Contractual parties are not part of referral coordination.',
      'INVALID_STATE',
      422
    );
  }

  return { workflow: row, snapshot, participant };
}

export async function lookupReferralPromoterByEmail(input: {
  organizationId: string;
  workflowId: string;
  userId: string;
  email: string;
}): Promise<{ existing: ExistingPromoterRelationship | null }> {
  const scoped = await requireReferralManagementWorkflow(input);
  const match = scoped.snapshot.participants.find((item) =>
    isCompensatedPromoterEmailMatch(item, input.email, Boolean(compensationKindOf(item)))
  );
  if (!match) return { existing: null };

  const catalog = await prisma.organization_services.findMany({
    where: { organization_id: input.organizationId, active: true },
    select: { id: true, name: true },
  });
  return { existing: buildExistingPromoterRelationship(match, catalog) };
}

export async function addReferralManagementPromoter(input: {
  organizationId: string;
  workflowId: string;
  userId: string;
  name: string;
  email: string;
  phone?: string | null;
  role: ReferralPromoterRole;
  compensation: ReferralCompensationInput;
  reuseExisting?: boolean;
}) {
  const scoped = await requireReferralManagementWorkflow(input);
  const deal = await ensureReferralManagementDeal(input);
  if (!deal) {
    throw new ReferralManagementError('Workflow not found', 'NOT_FOUND', 404);
  }

  const serviceIds = compensationServiceIds(input.compensation);
  if (serviceIds.length === 0) {
    throw new ReferralManagementError(
      'Select at least one active service this promoter can refer.',
      'INVALID_STATE',
      422
    );
  }

  const services = await prisma.organization_services.findMany({
    where: {
      id: { in: serviceIds },
      organization_id: input.organizationId,
      active: true,
    },
    select: { id: true, name: true },
  });
  if (services.length !== serviceIds.length) {
    throw new ReferralManagementError(
      'Service selection required before a promoter can be added.',
      'INVALID_STATE',
      422
    );
  }

  const duplicate = scoped.snapshot.participants.find((item) =>
    isCompensatedPromoterEmailMatch(item, input.email, Boolean(compensationKindOf(item)))
  );
  if (duplicate) {
    if (input.reuseExisting) {
      const context = await getReferralManagementContext({
        organizationId: input.organizationId,
        workflowId: input.workflowId,
        userId: input.userId,
      });
      return { context, participant: duplicate, created: false, reused: true };
    }
    const catalog = await prisma.organization_services.findMany({
      where: { organization_id: input.organizationId, active: true },
      select: { id: true, name: true },
    });
    throw new ReferralManagementError(DUPLICATE_PROMOTER_MESSAGE, 'CONFLICT', 409, {
      existing: buildExistingPromoterRelationship(duplicate, catalog),
    });
  }

  const base = buildOnboardingParticipant({
    name: input.name.trim(),
    email: input.email.trim(),
    role: mapRole(input.role),
    deal,
  });
  const isFixed = input.compensation.kind === 'fixed';
  const commissionValue = isFixed ? input.compensation.amount : input.compensation.percentage;
  const participationModel = isFixed ? 'fixed_payout' : 'revenue_share';
  const compensationProfile = buildInviteCompensationProfile({
    participationModel,
    commissionKind: isFixed ? 'fixed_amount' : 'pct_deal_value',
    commissionValue,
    enableCustomerAttribution: !isFixed,
    referralCommerce: isFixed
      ? undefined
      : normalizeReferralCommerce({
          ...defaultReferralCommerce(),
          createReferralLink: true,
          commissionMode: 'project_revenue_share',
          commerceCommissionPct: input.compensation.percentage,
          enabledServiceIds: serviceIds,
        }),
  });

  const participant: DemoParticipant = {
    ...base,
    id: uuidv4(),
    dealId: deal.id,
    inviteToken: uuidv4(),
    companyName: input.name.trim(),
    participantNotes: input.phone?.trim() ? `Phone: ${input.phone.trim()}` : base.participantNotes,
    participationModel,
    commissionKind: isFixed ? 'fixed_amount' : 'pct_deal_value',
    commissionValue,
    compensationProfile: compensationProfile
      ? {
          ...compensationProfile,
          commissionServiceIds: serviceIds,
          commissionSourceMode: 'selected',
          customerAttributionEnabled: !isFixed,
        }
      : {
          compensationType: isFixed ? 'FIXED_FEE' : 'REVENUE_SHARE',
          percentage: isFixed ? undefined : input.compensation.percentage,
          fixedAmount: isFixed ? input.compensation.amount : undefined,
          configured: true,
          configuredAt: new Date().toISOString(),
          commissionServiceIds: serviceIds,
          commissionSourceMode: 'selected',
          customerAttributionEnabled: !isFixed,
          revenueSources: [],
        },
    referralCommerce: isFixed
      ? undefined
      : normalizeReferralCommerce({
          ...defaultReferralCommerce(),
          createReferralLink: true,
          commissionMode: 'project_revenue_share',
          commerceCommissionPct: input.compensation.percentage,
          enabledServiceIds: serviceIds,
        }),
  };

  const sourceOrganizationId = await proveSourceOrganizationFromWorkflow(
    scoped.workflow.id,
    input.userId
  );
  const persisted = await createPilotParticipantForUser(input.userId, participant, {
    sourceOrganizationId,
  });
  await orchestrateOperationalMutation({
    userId: input.userId,
    mutation: 'snapshot_persist',
    projectId: deal.id,
    focusParticipant: persisted,
  });

  const context = await getReferralManagementContext({
    organizationId: input.organizationId,
    workflowId: input.workflowId,
    userId: input.userId,
  });
  return { context, participant: persisted, created: true, reused: false };
}

export async function updateReferralManagementPromoterServices(input: {
  organizationId: string;
  workflowId: string;
  userId: string;
  participantId: string;
  serviceIds: string[];
}) {
  const scoped = await requireReferralManagementWorkflow(input);
  if (!scoped.participant) {
    throw new ReferralManagementError('Participant not found', 'NOT_FOUND', 404);
  }

  const serviceIds = [...new Set(input.serviceIds.map((id) => id.trim()).filter(Boolean))];
  if (serviceIds.length === 0) {
    throw new ReferralManagementError(
      'Select at least one active service this promoter can refer.',
      'INVALID_STATE',
      422
    );
  }

  const services = await prisma.organization_services.findMany({
    where: {
      id: { in: serviceIds },
      organization_id: input.organizationId,
      active: true,
    },
    select: { id: true },
  });
  if (services.length !== serviceIds.length) {
    throw new ReferralManagementError(
      'Select at least one active service this promoter can refer.',
      'INVALID_STATE',
      422
    );
  }

  const participant = scoped.participant;
  const isFixed = compensationKindOf(participant) === 'fixed';
  const nextCommerce = isFixed
    ? participant.referralCommerce
    : normalizeReferralCommerce({
        ...(participant.referralCommerce ?? defaultReferralCommerce()),
        createReferralLink: true,
        enabledServiceIds: serviceIds,
      });

  const next: DemoParticipant = {
    ...participant,
    compensationProfile: {
      compensationType: isFixed ? 'FIXED_FEE' : 'REVENUE_SHARE',
      configured: true,
      configuredAt: new Date().toISOString(),
      revenueSources: [],
      ...participant.compensationProfile,
      commissionServiceIds: serviceIds,
      commissionSourceMode: 'selected',
    },
    referralCommerce: nextCommerce,
  };

  const persisted = await updatePilotParticipantPayload(participant.id, input.userId, next);
  if (!persisted) {
    throw new ReferralManagementError('Participant not found', 'NOT_FOUND', 404);
  }

  if (
    !isFixed &&
    nextCommerce &&
    shouldIssueReferralLink(nextCommerce) &&
    (participant.approvalStatus === 'Approved' || Boolean(participant.referralCode?.trim()))
  ) {
    const issued = await ensureReferralIssuance({
      organizationId: input.organizationId,
      operatorUserId: input.userId,
      participantEmail: persisted.email,
      participantName: persisted.name,
      sourceParticipantId: persisted.id,
      commissionKind: persisted.commissionKind,
      commissionValue: persisted.commissionValue,
      projectLabel: 'Referral Management',
      referralCommerce: nextCommerce,
    });
    await updatePilotParticipantPayload(persisted.id, input.userId, {
      ...persisted,
      referralCode: issued.code,
      customerCommerceUrl: issued.referralUrl,
      inviteLink: issued.referralUrl,
    });
  }

  await orchestrateOperationalMutation({
    userId: input.userId,
    mutation: 'snapshot_persist',
    projectId: persisted.dealId ?? scoped.snapshot.participants.find((row) => row.id === persisted.id)?.dealId,
    focusParticipant: persisted,
  });

  const context = await getReferralManagementContext({
    organizationId: input.organizationId,
    workflowId: input.workflowId,
    userId: input.userId,
  });
  return { context, participant: persisted };
}

export async function runReferralManagementAction(input: {
  organizationId: string;
  workflowId: string;
  userId: string;
  participantId: string;
  action: ParticipantCoordinationAction;
  origin?: string;
  missingFields?: string[];
  requestedChanges?: string;
  sendInvitationEmail?: boolean;
}) {
  const scoped = await requireReferralManagementWorkflow(input);
  if (!scoped.participant) {
    throw new ReferralManagementError('Participant not found', 'NOT_FOUND', 404);
  }

  let result;
  try {
    result = await executeCommercialParticipantAction({
      participant: scoped.participant,
      userId: input.userId,
      organizationId: input.organizationId,
      action: input.action,
      origin: input.origin,
      missingFields: input.missingFields,
      requestedChanges: input.requestedChanges,
      sendInvitationEmail: input.sendInvitationEmail,
    });
  } catch (error) {
    if (error instanceof CommercialCoordinationError) {
      throw new ReferralManagementError(error.message, error.code, error.status);
    }
    throw error;
  }

  const context = await getReferralManagementContext({
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
