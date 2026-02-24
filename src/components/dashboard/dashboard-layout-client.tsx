'use client';

/**
 * Dashboard Layout Client Wrapper
 * 
 * Client component that wraps the sidebar provider and layout structure.
 * Receives isBetaAdmin as a prop from the server layout to avoid
 * importing server-only modules in client code.
 */

import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { AppHeader } from '@/components/dashboard/app-header';

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  isBetaAdmin: boolean;
}

export function DashboardLayoutClient({
  children,
  isBetaAdmin,
}: DashboardLayoutClientProps) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar isBetaAdmin={isBetaAdmin} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader />
          <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
