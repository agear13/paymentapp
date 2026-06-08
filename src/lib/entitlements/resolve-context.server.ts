import 'server-only';

import type { DashboardProductProfile } from '@/lib/auth/admin-shared';
import {
  isRabbitHolePilotUser,
  isStraitExperiencesPilotUser,
} from '@/lib/auth/dashboard-product.server';
import { prisma } from '@/lib/server/prisma';
import type { EntitlementContext, SubscriptionPlan, SubscriptionStatus } from '@/lib/entitlements/types';
import { normalizeSubscriptionPlan } from '@/lib/entitlements/plans';
import { getWorkspaceUsage } from '@/lib/entitlements/usage.server';
import { buildWorkspaceEntitlements } from '@/lib/entitlements/workspace-entitlements';

function normalizeSubscriptionStatus(value: string | null | undefined): SubscriptionStatus {
  if (value === 'trialing' || value === 'past_due' || value === 'canceled') return value;
  return 'active';
}

function isPilotProfile(profile: DashboardProductProfile): boolean {
  return profile === 'rabbit_hole_pilot' || profile === 'strait_experiences_pilot';
}

export function resolveProductProfileFromEmail(email: string | null | undefined): DashboardProductProfile {
  if (!email) return 'standard';
  if (isRabbitHolePilotUser(email)) return 'rabbit_hole_pilot';
  if (isStraitExperiencesPilotUser(email)) return 'strait_experiences_pilot';
  return 'standard';
}

export async function resolveEntitlementContext(input: {
  organizationId: string;
  userId: string;
  userEmail?: string | null;
  productProfile?: DashboardProductProfile;
}): Promise<EntitlementContext> {
  const org = await prisma.organizations.findUnique({
    where: { id: input.organizationId },
    select: {
      id: true,
      subscription_plan: true,
      subscription_status: true,
    },
  });

  const plan = normalizeSubscriptionPlan(org?.subscription_plan);
  const status = normalizeSubscriptionStatus(org?.subscription_status);
  const productProfile =
    input.productProfile ?? resolveProductProfileFromEmail(input.userEmail ?? null);
  const usage = await getWorkspaceUsage(input.organizationId, input.userId);

  return {
    organizationId: input.organizationId,
    userId: input.userId,
    productProfile,
    plan,
    status,
    usage,
    pilotBypass: isPilotProfile(productProfile),
  };
}

export async function getWorkspaceEntitlementsForUser(input: {
  organizationId: string;
  userId: string;
  userEmail?: string | null;
  productProfile?: DashboardProductProfile;
}) {
  const ctx = await resolveEntitlementContext(input);
  return buildWorkspaceEntitlements(ctx);
}

export async function updateOrganizationSubscription(input: {
  organizationId: string;
  plan: SubscriptionPlan;
  status?: SubscriptionStatus;
}) {
  return prisma.organizations.update({
    where: { id: input.organizationId },
    data: {
      subscription_plan: input.plan,
      ...(input.status ? { subscription_status: input.status } : {}),
    },
    select: {
      id: true,
      subscription_plan: true,
      subscription_status: true,
    },
  });
}
