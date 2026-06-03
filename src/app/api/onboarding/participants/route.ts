import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { apiError, apiResponse, validateBody } from '@/lib/api/middleware';
import {
  getPilotSnapshotForUser,
  syncPilotSnapshotForUser,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { buildOnboardingParticipant } from '@/lib/onboarding/build-onboarding-project';
import {
  ONBOARDING_PARTICIPANT_ROLE_VALUES,
} from '@/lib/onboarding/operator-onboarding-types';
import {
  getOperatorOnboardingState,
  saveOperatorOnboardingState,
} from '@/lib/onboarding/operator-onboarding.server';
import {
  runOperationalInitializationConvergence,
} from '@/lib/operations/onboarding/run-operational-initialization-convergence.server';
import {
  ensureOnboardingPipelineSessionForServer,
  logOnboardingPipelineDemoParticipants,
  logOnboardingPipelineDrafts,
} from '@/lib/ai-extractor/onboarding-pipeline-instrumentation';

const participantSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  role: z.enum(ONBOARDING_PARTICIPANT_ROLE_VALUES),
});

const schema = z.object({
  projectId: z.string().min(1),
  participants: z.array(participantSchema).max(20),
});

/** POST /api/onboarding/participants — add participants to the onboarding project (canonical pilot model). */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError('Unauthorized', 401);
  }

  const { data: body, error } = await validateBody(request, schema);
  if (error) {
    return error;
  }

  ensureOnboardingPipelineSessionForServer(`api:onboarding/participants:${body.projectId}`);
  logOnboardingPipelineDrafts('apiRequestBodyReceived', body.participants, {
    projectId: body.projectId,
  });

  const org = await getOrganizationForAuthenticatedUser(user.id);
  if (!org) {
    return apiError('Organization required', 400);
  }

  const snapshot = await getPilotSnapshotForUser(user.id);
  const deal = snapshot.deals.find((d) => d.id === body.projectId);
  if (!deal) {
    return apiError('Project not found', 404);
  }

  const newParticipants = body.participants
    .filter((p) => p.name.trim())
    .map((p) =>
      buildOnboardingParticipant({
        name: p.name,
        email: p.email?.trim() || undefined,
        role: p.role,
        deal,
      })
    );

  logOnboardingPipelineDemoParticipants('storageWrite', newParticipants, {
    projectId: body.projectId,
    participantIds: newParticipants.map((p) => p.id),
  });

  await syncPilotSnapshotForUser(user.id, snapshot.deals, [
    ...snapshot.participants,
    ...newParticipants,
  ]);

  const afterSnapshot = await getPilotSnapshotForUser(user.id);
  const writtenIds = new Set(newParticipants.map((p) => p.id));
  const readBack = afterSnapshot.participants.filter((p) => writtenIds.has(p.id));
  logOnboardingPipelineDemoParticipants('storageReadBack', readBack, {
    projectId: body.projectId,
  });

  const prev = (await getOperatorOnboardingState(org.id)) ?? { step: 'participants' as const };
  await saveOperatorOnboardingState(org.id, user.id, {
    ...prev,
    step: 'funding',
    projectId: deal.id,
    organizationId: org.id,
  });

  const convergence = await runOperationalInitializationConvergence({
    userId: user.id,
    organizationId: org.id,
    projectId: deal.id,
    triggerSource: 'onboarding-participants',
    orchestrate: false,
  });

  return apiResponse({
    added: newParticipants.length,
    projectId: deal.id,
    correlationId: convergence.correlationId,
    operationalInitialization: convergence.snapshot,
    operationalOnboarding: convergence.onboarding,
  });
}
