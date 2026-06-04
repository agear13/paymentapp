import 'server-only';

import { createUserClient } from '@/lib/supabase/server';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { checkUserPermission } from '@/lib/auth/permissions';

/** Server-side: operator may view attribution commissions when org member with view_payment_links. */
export async function resolveCanViewAttributionCommissionsForSession(): Promise<boolean> {
  try {
    const supabase = await createUserClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return false;

    const org = await getOrganizationForAuthenticatedUser(user.id);
    if (!org) return false;

    return checkUserPermission(user.id, org.id, 'view_payment_links');
  } catch {
    return false;
  }
}
