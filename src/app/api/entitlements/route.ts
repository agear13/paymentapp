import { getCurrentUser } from '@/lib/auth/session';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { apiError, apiResponse } from '@/lib/api/middleware';
import { getDashboardProductProfile } from '@/lib/auth/dashboard-product.server';
import { getWorkspaceEntitlementsForUser } from '@/lib/entitlements/resolve-context.server';

/** GET /api/entitlements — workspace plan, usage, and feature decisions. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError('Unauthorized', 401);
  }

  const org = await getOrganizationForAuthenticatedUser(user.id);
  if (!org) {
    return apiError('No organization found', 404);
  }

  const productProfile = await getDashboardProductProfile();
  const entitlements = await getWorkspaceEntitlementsForUser({
    organizationId: org.id,
    userId: user.id,
    userEmail: user.email,
    productProfile,
  });

  return apiResponse({
    organizationId: org.id,
    ...entitlements,
  });
}
