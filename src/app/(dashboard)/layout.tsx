/**
 * Dashboard Layout (Server Component)
 * 
 * Computes product profile on the server and passes to client shell.
 * This avoids importing server-only modules from client components.
 * 
 * Force dynamic to ensure session cookies are always read fresh.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { getDashboardProductProfile } from '@/lib/auth/dashboard-product.server';
import { DashboardLayoutClient } from '@/components/dashboard/dashboard-layout-client';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const productProfile = await getDashboardProductProfile();

  return (
    <DashboardLayoutClient productProfile={productProfile}>
      {children}
    </DashboardLayoutClient>
  );
}




