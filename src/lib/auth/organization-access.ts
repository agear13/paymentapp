import { prisma } from '@/lib/server/prisma';
import { checkUserPermission } from '@/lib/auth/permissions';

/**
 * Returns true when the user is a member of the organization.
 */
export async function hasOrganizationAccess(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const membership = await prisma.user_organizations.findUnique({
    where: {
      user_id_organization_id: {
        user_id: userId,
        organization_id: organizationId,
      },
    },
    select: { id: true },
  });

  return membership !== null;
}

/**
 * Enforces org membership and then permission checks.
 */
export async function hasOrganizationPermission(
  userId: string,
  organizationId: string,
  permission:
    | 'view_settings'
    | 'manage_settings'
    | 'view_payment_links'
    | 'edit_payment_links'
    | 'create_payment_links'
): Promise<boolean> {
  const hasAccess = await hasOrganizationAccess(userId, organizationId);
  if (!hasAccess) return false;

  return checkUserPermission(userId, organizationId, permission);
}

/**
 * Strict role check for OWNER/ADMIN style operations.
 */
export async function hasOrganizationRole(
  userId: string,
  organizationId: string,
  allowedRoles: string[]
): Promise<boolean> {
  const membership = await prisma.user_organizations.findUnique({
    where: {
      user_id_organization_id: {
        user_id: userId,
        organization_id: organizationId,
      },
    },
    select: { role: true },
  });

  if (!membership) return false;
  return allowedRoles.includes(membership.role.toUpperCase());
}
