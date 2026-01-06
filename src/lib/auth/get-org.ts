/**
 * Helper to get the current user's organization
 * This is a simplified version that returns the first organization
 * In production, you'd want proper organization selection/context
 */

import { prisma } from '@/lib/server/prisma';
import { getCurrentUser } from '@/lib/auth/session';

export async function getUserOrganization() {
  const user = await getCurrentUser();
  
  if (!user) {
    return null;
  }

  // Get the first organization (simplified approach)
  // In production, you'd want to:
  // 1. Get the user's selected organization from session/cookie
  // 2. Or get it from a user_organizations table
  // 3. Or prompt them to select if they have multiple
  const organization = await prisma.organizations.findFirst({
    select: {
      id: true,
      name: true,
      clerk_org_id: true,
    },
  });

  return organization;
}

export async function requireOrganization() {
  const org = await getUserOrganization();
  
  if (!org) {
    throw new Error('No organization found. Please complete onboarding.');
  }
  
  return org;
}

