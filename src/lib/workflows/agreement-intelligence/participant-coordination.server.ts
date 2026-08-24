import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import {
  getWorkflowAgreementContext,
  refreshWorkflowActivation,
} from '@/lib/workflows/agreement-intelligence/agreement-service.server';
import { WorkflowAgreementError } from '@/lib/workflows/agreement-intelligence/types';
import {
  AGREEMENT_INTELLIGENCE_SLUG,
  compensationKindOf,
  type ParticipantCoordinationAction,
} from '@/lib/workflows/agreement-intelligence/participant-coordination';
import { parseAgreementIntelligenceConfiguration } from '@/lib/workflows/agreement-intelligence/configuration';
import { pickCurrentAgreement, agreementDrivesWorkflowLifecycle } from '@/lib/workflows/agreement-intelligence/agreement-collection';
import {
  CommercialCoordinationError,
  executeCommercialParticipantAction,
} from '@/lib/participants/coordinate-commercial-participant.server';

export class ParticipantCoordinationError extends WorkflowAgreementError {}

function mapCommercialError(error: unknown): never {
  if (error instanceof CommercialCoordinationError) {
    const code = error.code as ConstructorParameters<typeof ParticipantCoordinationError>[1];
    throw new ParticipantCoordinationError(error.message, code, error.status);
  }
  throw error;
}

async function requireOperationalWorkflow(input: {
  organizationId: string;
  workflowId: string;
  userId: string;
  participantId: string;
  agreementId?: string;
}) {
  const row = await prisma.organization_workflows.findFirst({
    where: { id: input.workflowId, organization_id: input.organizationId },
    include: {
      agreements: {
        orderBy: [{ is_current: 'desc' }, { updated_at: 'desc' }],
      },
    },
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

  const currentAgreement = pickCurrentAgreement(row.agreements);
  let targetAgreement = currentAgreement;
  if (input.agreementId) {
    targetAgreement =
      row.agreements.find((item) => item.id === input.agreementId) ??
      (await prisma.organization_workflow_agreements.findFirst({
        where: {
          id: input.agreementId,
          organization_id: input.organizationId,
          organization_workflow_id: input.workflowId,
        },
      }));
  }

  const drivesWorkflow = agreementDrivesWorkflowLifecycle(targetAgreement, currentAgreement);
  if (drivesWorkflow) {
    if (row.lifecycle_status !== 'ACTIVE' && row.lifecycle_status !== 'PARTICIPANT_SETUP') {
      throw new ParticipantCoordinationError(
        'Participant coordination is only available after the workflow is activated.',
        'INVALID_STATE',
        409
      );
    }
  } else if (
    !targetAgreement ||
    targetAgreement.extraction_status !== 'APPROVED' ||
    !targetAgreement.bootstrapped_at ||
    !targetAgreement.pilot_deal_id
  ) {
    throw new ParticipantCoordinationError(
      'Participant coordination is only available after the workflow is activated.',
      'INVALID_STATE',
      409
    );
  }

  const pilotDealId = targetAgreement?.pilot_deal_id;
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
    targetAgreement,
    pilotDealId,
    participant,
    configuration: parseAgreementIntelligenceConfiguration(row.configuration),
  };
}

async function contextAfterMutation(input: {
  organizationId: string;
  workflowId: string;
  userId: string;
  agreementId?: string;
}) {
  await refreshWorkflowActivation(input);
  return getWorkflowAgreementContext(
    input.organizationId,
    input.workflowId,
    input.userId,
    input.agreementId
  );
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
  sendInvitationEmail?: boolean;
  agreementId?: string;
}) {
  const scoped = await requireOperationalWorkflow(input);

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
    mapCommercialError(error);
  }

  const context = await contextAfterMutation({
    organizationId: input.organizationId,
    workflowId: input.workflowId,
    userId: input.userId,
    agreementId: scoped.targetAgreement?.id ?? input.agreementId,
  });

  return {
    ...context,
    coordination: {
      action: input.action,
      ...result,
    },
  };
}
