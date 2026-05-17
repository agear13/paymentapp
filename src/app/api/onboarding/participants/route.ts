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
  getOperatorOnboardingState,
  saveOperatorOnboardingState,
} from '@/lib/onboarding/operator-onboarding.server';

const participantSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  role: z.enum(['Contributor', 'Contractor', 'Referrer', 'Partner']),
});

const schema = z.object({
  projectId: z.string().min(1),
  participants: z.array(participantSchema).max(20),
});

/** POST /api/onboarding/participants — add lightweight participants to the onboarding project */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError('Unauthorized', 401);
  }

  const { data: body, error } = await validateBody(request, schema);
  if (error) {
    return error;
  }

  const org = await getOrganizationForAuthenticatedUser(user.id);
  if (!org) {
    return apiError('Organization required', 400);
  }

  const snapshot = await getPilotSnapshotForUser(user.id);
  const deal = snapshot.deals.find((d) => d.id === body.projectId);
  if (!deal) {
    return apiError('Project not found', 404);
  }

  const newParticipants = body.participants.map((p) =>
    buildOnboardingParticipant({
      name: p.name,
      email: p.email,
      role: p.role,
      dealId: deal.id,
      dealName: deal.dealName,
    })
  );

  await syncPilotSnapshotForUser(user.id, snapshot.deals, [
    ...snapshot.participants,
    ...newParticipants,
  ]);

  const prev = (await getOperatorOnboardingState(org.id)) ?? { step: 'participants' as const };
  await saveOperatorOnboardingState(org.id, user.id, {
    ...prev,
    step: 'funding',
    projectId: deal.id,
    organizationId: org.id,
  });

  return apiResponse({ added: newParticipants.length });
}
