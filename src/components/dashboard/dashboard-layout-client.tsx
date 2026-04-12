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
import { ProvvyCopilotProvider } from '@/components/copilot/provvy-copilot-provider';
import { ProvvyCopilotPanel } from '@/components/copilot/provvy-copilot-panel';

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  productProfile: DashboardProductProfile;
}

export function DashboardLayoutClient({
  children,
  productProfile,
}: DashboardLayoutClientProps) {
  return (
    <ProvvyCopilotProvider>
      <SidebarProvider>
        <div className="flex h-screen w-full min-w-0 overflow-hidden">
          <AppSidebar productProfile={productProfile} />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <AppHeader productProfile={productProfile} />
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <main className="bg-muted/30 min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
              <ProvvyCopilotPanel />
            </div>
          </div>
        </div>
      </SidebarProvider>
    </ProvvyCopilotProvider>
  );
}
