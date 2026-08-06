import 'server-only';

import { prisma } from '@/lib/server/prisma';
import type { OperatorOnboardingState } from '@/lib/onboarding/operator-onboarding-types';

const ENTITY_TYPE = 'operator_onboarding';

const EQUIVALENCE_KEYS: (keyof OperatorOnboardingState)[] = [
  'step',
  'workspace_name',
  'workspace_industry',
  'workspace_team_size',
  'onboarding_use_case',
  'onboarding_context',
  'organizationId',
  'merchantSettingsId',
  'projectId',
  'completed',
  'completedAt',
  'collection_preference',
  'pending_billing_plan',
];

export function operatorOnboardingStatesEquivalent(
  current: OperatorOnboardingState | null,
  next: OperatorOnboardingState
): boolean {
  if (!current) return false;
  return EQUIVALENCE_KEYS.every((key) => current[key] === next[key]);
}

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
  state: OperatorOnboardingState,
  options?: { skipIfEquivalent?: boolean }
): Promise<boolean> {
  if (options?.skipIfEquivalent) {
    const current = await getOperatorOnboardingState(organizationId);
    if (operatorOnboardingStatesEquivalent(current, state)) {
      return false;
    }
  }

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

  return true;
}
