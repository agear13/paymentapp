/**
 * Role-Based Permission System
 * Defines roles and permissions for organization-based access control
 */

import { User } from '@supabase/supabase-js'
import { prisma } from '@/lib/server/prisma'

// Define user roles
export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

// Define permissions
export enum Permission {
  // Organization permissions
  ORG_MANAGE = 'org:manage',
  ORG_VIEW = 'org:view',
  
  // Payment link permissions
  PAYMENT_LINK_CREATE = 'payment_link:create',
  PAYMENT_LINK_VIEW = 'payment_link:view',
  PAYMENT_LINK_EDIT = 'payment_link:edit',
  PAYMENT_LINK_DELETE = 'payment_link:delete',
  
  // Settings permissions
  SETTINGS_MANAGE = 'settings:manage',
  SETTINGS_VIEW = 'settings:view',
  
  // Ledger permissions
  LEDGER_VIEW = 'ledger:view',
  LEDGER_MANAGE = 'ledger:manage',
  
  // Xero integration permissions
  XERO_CONNECT = 'xero:connect',
  XERO_SYNC = 'xero:sync',
  XERO_VIEW = 'xero:view',
}

// Role to permissions mapping
const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.OWNER]: [
    Permission.ORG_MANAGE,
    Permission.ORG_VIEW,
    Permission.PAYMENT_LINK_CREATE,
    Permission.PAYMENT_LINK_VIEW,
    Permission.PAYMENT_LINK_EDIT,
    Permission.PAYMENT_LINK_DELETE,
    Permission.SETTINGS_MANAGE,
    Permission.SETTINGS_VIEW,
    Permission.LEDGER_VIEW,
    Permission.LEDGER_MANAGE,
    Permission.XERO_CONNECT,
    Permission.XERO_SYNC,
    Permission.XERO_VIEW,
  ],
  [UserRole.ADMIN]: [
    Permission.ORG_VIEW,
    Permission.PAYMENT_LINK_CREATE,
    Permission.PAYMENT_LINK_VIEW,
    Permission.PAYMENT_LINK_EDIT,
    Permission.PAYMENT_LINK_DELETE,
    Permission.SETTINGS_VIEW,
    Permission.LEDGER_VIEW,
    Permission.XERO_SYNC,
    Permission.XERO_VIEW,
  ],
  [UserRole.MEMBER]: [
    Permission.ORG_VIEW,
    Permission.PAYMENT_LINK_CREATE,
    Permission.PAYMENT_LINK_VIEW,
    Permission.PAYMENT_LINK_EDIT,
    Permission.SETTINGS_VIEW,
    Permission.LEDGER_VIEW,
  ],
  [UserRole.VIEWER]: [
    Permission.ORG_VIEW,
    Permission.PAYMENT_LINK_VIEW,
    Permission.SETTINGS_VIEW,
    Permission.LEDGER_VIEW,
  ],
}

/** Maps DB `user_organizations.role` (e.g. OWNER, admin) to `UserRole`. */
function mapDbRoleToUserRole(dbRole: string): UserRole | null {
  const normalized = dbRole.trim().toUpperCase();
  const map: Record<string, UserRole> = {
    OWNER: UserRole.OWNER,
    ADMIN: UserRole.ADMIN,
    MEMBER: UserRole.MEMBER,
    VIEWER: UserRole.VIEWER,
  };
  return map[normalized] ?? null;
}

/**
 * Get user's role in an organization (from `user_organizations`).
 */
export async function getUserRole(
  userId: string,
  organizationId: string
): Promise<UserRole | null> {
  const row = await prisma.user_organizations.findUnique({
    where: {
      user_id_organization_id: {
        user_id: userId,
        organization_id: organizationId,
      },
    },
    select: { role: true },
  });

  if (!row) {
    return null;
  }

  return mapDbRoleToUserRole(row.role);
}

/**
 * Check if user has a specific permission (synchronous, role-based)
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false
}

/**
 * Check if user has a specific permission in an organization (async version for API routes)
 * @param userId - Supabase user ID
 * @param organizationId - Organization ID
 * @param permissionString - Permission string like 'create_payment_links', 'view_payment_links'
 */
export async function checkUserPermission(
  userId: string,
  organizationId: string,
  permissionString: string
): Promise<boolean> {
  try {
    // Get user's role in the organization
    const role = await getUserRole(userId, organizationId);
    
    if (!role) {
      return false;
    }
    
    // Map permission strings to Permission enum
    const permissionMap: Record<string, Permission> = {
      'create_payment_links': Permission.PAYMENT_LINK_CREATE,
      'view_payment_links': Permission.PAYMENT_LINK_VIEW,
      'edit_payment_links': Permission.PAYMENT_LINK_EDIT,
      /** Soft-cancel (status → CANCELED); same privilege tier as editing drafts/open invoices. */
      'cancel_payment_links': Permission.PAYMENT_LINK_EDIT,
      'delete_payment_links': Permission.PAYMENT_LINK_DELETE,
      'manage_settings': Permission.SETTINGS_MANAGE,
      'view_settings': Permission.SETTINGS_VIEW,
      'view_ledger': Permission.LEDGER_VIEW,
      'manage_ledger': Permission.LEDGER_MANAGE,
    };
    
    const permission = permissionMap[permissionString];
    if (!permission) {
      console.warn(`Unknown permission: ${permissionString}`);
      return false;
    }
    
    return rolePermissions[role]?.includes(permission) ?? false;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission))
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission))
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return rolePermissions[role] ?? []
}

/**
 * Check if user can access organization
 */
export async function canAccessOrganization(
  userId: string,
  organizationId: string
): Promise<boolean> {
  try {
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
  } catch (error) {
    console.error('Error checking organization access:', error)
    return false
  }
}

/**
 * Require specific permission or throw error
 */
export async function requirePermission(
  userId: string,
  organizationId: string,
  permission: Permission
): Promise<void> {
  const role = await getUserRole(userId, organizationId)
  
  if (!role || !hasPermission(role, permission)) {
    throw new Error(`Permission denied: ${permission}`)
  }
}




