import 'server-only';

import { prisma } from '@/lib/server/prisma';
import type { OperatorOnboardingState } from '@/lib/onboarding/operator-onboarding-types';

const ENTITY_TYPE = 'operator_onboarding';

export async function getOperatorOnboardingState(
  organizationId: string
): Promise<OperatorOnboardingState | null> {
  const row = await prisma.audit_logs.findFirst({
    where: {
      organization_id: organizationId,
      entity_type: ENTITY_TYPE,
      entity_id: organizationId,
    },
    orderBy: { created_at: 'desc' },
  });

  if (!row?.new_values || typeof row.new_values !== 'object') {
    return null;
  }

  return row.new_values as OperatorOnboardingState;
}

export async function saveOperatorOnboardingState(
  organizationId: string,
  userId: string,
  state: OperatorOnboardingState
): Promise<void> {
  await prisma.audit_logs.create({
    data: {
      organization_id: organizationId,
      user_id: userId,
      entity_type: ENTITY_TYPE,
      entity_id: organizationId,
      action: state.completed ? 'completed' : 'progress',
      new_values: state as object,
    },
  });
}
