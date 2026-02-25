/**
 * Dashboard Layout (Server Component)
 * 
 * Computes isBetaAdmin on the server and passes to client sidebar.
 * This avoids importing server-only modules from client components.
 * 
 * Force dynamic to ensure session cookies are always read fresh.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { getIsBetaAdmin } from '@/lib/auth/beta-admin.server';
import { DashboardLayoutClient } from '@/components/dashboard/dashboard-layout-client';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Compute beta admin status on server (uses cookies/headers)
  const isBetaAdmin = await getIsBetaAdmin();

  return (
    <DashboardLayoutClient isBetaAdmin={isBetaAdmin}>
      {children}
    </DashboardLayoutClient>
  );
}




