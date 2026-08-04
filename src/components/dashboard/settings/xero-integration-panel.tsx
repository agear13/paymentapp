'use client';

import { XeroConnection } from '@/components/dashboard/settings/xero-connection';
import { XeroSyncQueue } from '@/components/dashboard/settings/xero-sync-queue';
import { XeroAccountMapping } from '@/components/dashboard/settings/xero-account-mapping';
import { XeroAccountingHealth } from '@/components/dashboard/settings/xero-accounting-health';
import { XeroIntegrationsGate } from '@/components/entitlements/xero-integrations-gate';

type XeroIntegrationPanelProps = {
  organizationId: string;
  stablecoinSettlementsEnabled: boolean;
  returnTo?: string;
};

/**
 * Reuses the production Xero configuration UI from legacy Integrations settings.
 */
export function XeroIntegrationPanel({
  organizationId,
  stablecoinSettlementsEnabled,
  returnTo,
}: XeroIntegrationPanelProps) {
  return (
    <XeroIntegrationsGate>
      <div className="space-y-6">
        <XeroConnection organizationId={organizationId} returnTo={returnTo} />
        <XeroAccountingHealth organizationId={organizationId} />
        <details id="advanced-accounting-settings" className="rounded-lg border border-border bg-card">
          <summary className="cursor-pointer px-6 py-4 text-sm font-medium">
            Advanced Accounting Settings
          </summary>
          <div className="border-t p-6">
            <XeroAccountMapping
              organizationId={organizationId}
              stablecoinSettlementsEnabled={stablecoinSettlementsEnabled}
            />
          </div>
        </details>
        <XeroSyncQueue organizationId={organizationId} />
      </div>
    </XeroIntegrationsGate>
  );
}
