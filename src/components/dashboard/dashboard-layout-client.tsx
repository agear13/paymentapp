'use client';

/**
 * Dashboard Layout Client Wrapper
 * 
 * Client component that wraps the sidebar provider and layout structure.
 * Receives productProfile from the server layout to avoid importing
 * server-only modules in client code.
 */

import type { DashboardProductProfile } from '@/lib/auth/admin-shared';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { AppHeader } from '@/components/dashboard/app-header';

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  productProfile: DashboardProductProfile;
}

export function DashboardLayoutClient({
  children,
  productProfile,
}: DashboardLayoutClientProps) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar productProfile={productProfile} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader productProfile={productProfile} />
          <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
