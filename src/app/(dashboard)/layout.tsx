/**
 * Dashboard Layout (Server Component)
 *
 * Computes product profile on the server and passes to client shell.
 * Force dynamic to ensure session cookies and request origin are read fresh.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { headers } from 'next/headers';

import { getDashboardProductProfile } from '@/lib/auth/dashboard-product.server';
import { DashboardLayoutClient } from '@/components/dashboard/dashboard-layout-client';
import {
  isInfrastructureDomainAllowed,
  resolveCustomerFacingOrigin,
  resolveRequestOrigin,
} from '@/lib/runtime/customer-facing-url';

async function getDashboardRequestOrigin(): Promise<string | undefined> {
  const headerList = await headers();
  return resolveRequestOrigin({
    nextUrl: { origin: 'https://placeholder.local', protocol: 'https:' },
    headers: {
      get: (name: string) => headerList.get(name),
    },
  });
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const productProfile = await getDashboardProductProfile();
  const requestOrigin = await getDashboardRequestOrigin();
  const customerFacing = resolveCustomerFacingOrigin({
    requestOrigin,
    runtimeOrigin: requestOrigin,
  });

  return (
    <DashboardLayoutClient
      productProfile={productProfile}
      customerFacingOrigin={customerFacing.configured ? customerFacing.origin : ''}
      customerFacingConfigured={customerFacing.configured}
      infrastructureOverride={
        customerFacing.configured
          ? customerFacing.infrastructureOverride
          : isInfrastructureDomainAllowed()
      }
    >
      {children}
    </DashboardLayoutClient>
  );
}
