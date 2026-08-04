'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { XeroIntegrationPanel } from '@/components/dashboard/settings/xero-integration-panel';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

type WorkspaceXeroManageScreenProps = {
  organizationId: string;
  stablecoinSettlementsEnabled: boolean;
};

export function WorkspaceXeroManageScreen({
  organizationId,
  stablecoinSettlementsEnabled,
}: WorkspaceXeroManageScreenProps) {
  return (
    <div className="animate-fade-up space-y-8 pb-16">
      <header>
        <Link
          href={COMMERCIAL_OS_ROUTES.connected}
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Connected Systems
        </Link>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Xero integration</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-soft">
          Chart of accounts, payment mappings, sync queue, and disconnect — using your existing
          production configuration.
        </p>
      </header>

      <XeroIntegrationPanel
        organizationId={organizationId}
        stablecoinSettlementsEnabled={stablecoinSettlementsEnabled}
        returnTo={COMMERCIAL_OS_ROUTES.connectedXero}
      />
    </div>
  );
}
