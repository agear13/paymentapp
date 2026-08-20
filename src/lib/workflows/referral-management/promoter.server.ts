import 'server-only';

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/server/prisma';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { buildOnboardingParticipant } from '@/lib/onboarding/build-onboarding-project';
import type { OnboardingParticipantRole } from '@/lib/onboarding/operator-onboarding-types';
import {
  createPilotParticipantForUser,
  getPilotSnapshotForUser,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { orchestrateOperationalMutation } from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';
import { defaultReferralCommerce, normalizeReferralCommerce } from '@/lib/referrals/referral-commerce-config';
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
  type ReferralCompensationInput,
  type ReferralPromoterRole,
} from '@/lib/workflows/referral-management/constants';
import { getReferralManagementContext } from '@/lib/workflows/referral-management/hub.server';

export class ReferralManagementError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number = 400
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

export async function addReferralManagementPromoter(input: {
  organizationId: string;
  workflowId: string;
  userId: string;
  name: string;
  email: string;
  phone?: string | null;
  role: ReferralPromoterRole;
  compensation: ReferralCompensationInput;
}) {
  const scoped = await requireReferralManagementWorkflow(input);
  const deal = await ensureReferralManagementDeal(input);
  if (!deal) {
    throw new ReferralManagementError('Workflow not found', 'NOT_FOUND', 404);
  }

  const service = await prisma.organization_services.findFirst({
    where: {
      id: input.compensation.serviceId,
      organization_id: input.organizationId,
      active: true,
    },
    select: { id: true, name: true },
  });
  if (!service) {
    throw new ReferralManagementError(
      'Service selection required before a promoter can be added.',
      'INVALID_STATE',
      422
    );
  }

  const duplicate = scoped.snapshot.participants.find(
    (item) =>
      item.email.trim().toLowerCase() === input.email.trim().toLowerCase() &&
      Boolean(compensationKindOf(item))
  );
  if (duplicate) {
    throw new ReferralManagementError(
      'A promoter with this email already exists. Open the existing relationship instead of creating a duplicate.',
      'CONFLICT',
      409
    );
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
          enabledServiceIds: [service.id],
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
          commissionServiceIds: [service.id],
          commissionSourceMode: 'selected',
          customerAttributionEnabled: !isFixed,
        }
      : {
          compensationType: isFixed ? 'FIXED_FEE' : 'REVENUE_SHARE',
          percentage: isFixed ? undefined : input.compensation.percentage,
          fixedAmount: isFixed ? input.compensation.amount : undefined,
          configured: true,
          configuredAt: new Date().toISOString(),
          commissionServiceIds: [service.id],
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
          enabledServiceIds: [service.id],
        }),
  };

  const persisted = await createPilotParticipantForUser(input.userId, participant);
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
  return { context, participant: persisted, created: true };
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
