/**
 * Developer Control Centre — Layout + Access Gate
 *
 * This route is only accessible when ONE of the following is true:
 *   1. NODE_ENV === 'development'
 *   2. The authenticated user's email is in ADMIN_EMAIL_ALLOWLIST
 *      (same list that gates /admin/beta-ops)
 *
 * Any other access returns a 404. Customers never see this route.
 */

import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/config/env';

async function checkDeveloperAccess(): Promise<boolean> {
  // Always allow in development
  if (process.env.NODE_ENV === 'development') return true;

  // Allow when dev tools are explicitly enabled (e.g. Render staging)
  if (process.env.NEXT_PUBLIC_DEV_TOOLS === 'true') return true;

  // Check authenticated admin user
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return false;
    return isAdminEmail(user.email ?? '');
  } catch {
    return false;
  }
}

export default async function DeveloperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const allowed = await checkDeveloperAccess();

  if (!allowed) {
    notFound();
  }

  return <>{children}</>;
}
