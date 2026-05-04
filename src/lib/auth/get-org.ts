/**
 * Helper to get the current user's organization
 * This is a simplified version that returns the first organization
 * In production, you'd want proper organization selection/context
 */

import { prisma } from '@/lib/server/prisma';
import { getCurrentUser } from '@/lib/auth/session';

type UserOrgRow = {
  id: string;
  name: string;
  clerk_org_id: string;
  role: string;
};

async function loadFirstOrganizationForUserId(userId: string): Promise<UserOrgRow | null> {
  const userOrg = await prisma.$queryRaw<UserOrgRow[]>`
    SELECT o.id, o.name, o.clerk_org_id, uo.role
    FROM organizations o
    INNER JOIN user_organizations uo ON uo.organization_id = o.id
    WHERE uo.user_id = ${userId}
    ORDER BY uo.created_at ASC
    LIMIT 1
  `;

  if (!userOrg || userOrg.length === 0) {
    console.warn(`No organization found for user ${userId}`);
    return null;
  }

  return userOrg[0];
}

/**
 * Resolve the authenticated session user's primary organization (server-side only).
 */
export async function getUserOrganization() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return null;
    }

    return loadFirstOrganizationForUserId(user.id);
  } catch (error) {
    console.error('Error fetching user organization:', error);
    return null;
  }
}

/**
 * Same org resolution as {@link getUserOrganization}, keyed by an already-authenticated user id.
 * Use in API routes after `requireAuth` so org is never taken from client input.
 */
export async function getOrganizationForAuthenticatedUser(userId: string) {
  try {
    if (!userId?.trim()) {
      return null;
    }
    return loadFirstOrganizationForUserId(userId);
  } catch (error) {
    console.error('Error fetching organization for user:', error);
    return null;
  }
}

export async function requireOrganization() {
  try {
    const org = await getUserOrganization();
    
    if (!org) {
      throw new Error('No organization found. Please complete onboarding.');
    }
    
    return org;
  } catch (error) {
    console.error('Error requiring organization:', error);
    throw new Error('No organization found. Please complete onboarding.');
  }
}

