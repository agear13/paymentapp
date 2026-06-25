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
import { OperationalChunkRecovery } from '@/components/operational/operational-chunk-recovery';
import { CustomerFacingOriginProvider } from '@/components/operational/customer-facing-origin-provider';
import { DashboardOperationalStatus } from '@/components/operations/dashboard-operational-status';
import { OperationalCoordinationProvider } from '@/components/operations/operational-coordination-provider';
import { CsrfBootstrap } from '@/components/security/csrf-bootstrap';
import { OrganizationIdentityBootstrap } from '@/components/organization/organization-identity-bootstrap';

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  productProfile: DashboardProductProfile;
  customerFacingOrigin: string;
  customerFacingConfigured: boolean;
  infrastructureOverride: boolean;
}

export function DashboardLayoutClient({
  children,
  productProfile,
  customerFacingOrigin,
  customerFacingConfigured,
  infrastructureOverride,
}: DashboardLayoutClientProps) {
  return (
    <>
    <CsrfBootstrap />
    <OrganizationIdentityBootstrap />
    <CustomerFacingOriginProvider
      origin={customerFacingOrigin}
      configured={customerFacingConfigured}
      infrastructureOverride={infrastructureOverride}
    >
      <OperationalCoordinationProvider>
        <SidebarProvider>
          <OperationalChunkRecovery scope="dashboard-layout" />
          <div className="flex h-screen w-full overflow-hidden">
            <AppSidebar productProfile={productProfile} />
            <div className="flex flex-1 flex-col overflow-hidden">
              <AppHeader productProfile={productProfile} />
              <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
                <div className="mx-auto max-w-6xl space-y-6">
                  <DashboardOperationalStatus />
                  {children}
                </div>
              </main>
            </div>
          </div>
        </SidebarProvider>
      </OperationalCoordinationProvider>
    </CustomerFacingOriginProvider>
    </>
  );
}
