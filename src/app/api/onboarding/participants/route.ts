import { NextRequest } from 'next/server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { apiError, apiResponse, validateBody } from '@/lib/api/middleware';
import {
  getPilotSnapshotForUser,
  syncPilotSnapshotForUser,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
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
import {
  onboardingDraftFromRequestBody,
  onboardingParticipantsPostSchema,
  participantsFromOnboardingDrafts,
} from '@/lib/onboarding/onboarding-participant-persist';
import { refreshProjectObligationsAfterParticipantPersist } from '@/lib/onboarding/refresh-onboarding-project-obligations.server';

/** POST /api/onboarding/participants — add participants to the onboarding project (canonical pilot model). */
export async function POST(request: NextRequest) {
  const auth = await getCurrentUserForApi(request);
  if (!auth.user) return auth.response!;
  const user = auth.user;

  const { data: body, error } = await validateBody(request, onboardingParticipantsPostSchema);
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

  const drafts = body.participants.map(onboardingDraftFromRequestBody);

  const newParticipants = participantsFromOnboardingDrafts(drafts, deal);

  logOnboardingPipelineDemoParticipants('storageWrite', newParticipants, {
    projectId: body.projectId,
    participantIds: newParticipants.map((p) => p.id),
  });

  await syncPilotSnapshotForUser(user.id, snapshot.deals, [
    ...snapshot.participants,
    ...newParticipants,
  ]);

  await refreshProjectObligationsAfterParticipantPersist(user.id, deal.id);

  const afterSnapshot = await getPilotSnapshotForUser(user.id);
  const writtenIds = new Set(newParticipants.map((p) => p.id));
  const readBack = afterSnapshot.participants.filter((p) => writtenIds.has(p.id));
  logOnboardingPipelineDemoParticipants('storageReadBack', readBack, {
    projectId: body.projectId,
  });

  const prev = (await getOperatorOnboardingState(org.id)) ?? { step: 'participants' as const };
  await saveOperatorOnboardingState(org.id, user.id, {
    ...prev,
    step: 'agreement_review',
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
