/**
 * Helper to get the current user's organization
 * This is a simplified version that returns the first organization
 * In production, you'd want proper organization selection/context
 */

import { prisma } from '@/lib/server/prisma';
import { getCurrentUser } from '@/lib/auth/session';

export async function getUserOrganization() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return null;
    }

    // Get the user's organization via user_organizations junction table
    // This ensures proper data isolation between different users/orgs
    const userOrg = await prisma.$queryRaw<Array<{
      id: string;
      name: string;
      clerk_org_id: string;
      role: string;
    }>>`
      SELECT o.id, o.name, o.clerk_org_id, uo.role
      FROM organizations o
      INNER JOIN user_organizations uo ON uo.organization_id = o.id
      WHERE uo.user_id = ${user.id}
      ORDER BY uo.created_at ASC
      LIMIT 1
    `;

    if (!userOrg || userOrg.length === 0) {
      console.warn(`No organization found for user ${user.id}`);
      return null;
    }

    return userOrg[0];
  } catch (error) {
    console.error('Error fetching user organization:', error);
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

