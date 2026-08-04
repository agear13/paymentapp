'use client';

import { XeroConnection } from '@/components/dashboard/settings/xero-connection';
import { XeroSyncQueue } from '@/components/dashboard/settings/xero-sync-queue';
import { XeroAccountMapping } from '@/components/dashboard/settings/xero-account-mapping';
import { XeroAccountingHealth } from '@/components/dashboard/settings/xero-accounting-health';
import { XeroIntegrationsGate } from '@/components/entitlements/xero-integrations-gate';
import { XeroSetupProgress } from '@/components/xero/xero-setup-progress';
import { XeroGuidedSetupOrchestrator } from '@/components/xero/xero-guided-setup-orchestrator';
import type { MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';

type XeroIntegrationPanelProps = {
  organizationId: string;
  stablecoinSettlementsEnabled: boolean;
  merchantRails?: MerchantPaymentRails;
  returnTo?: string;
  /** Legacy guided copy/layout (pre–Setup Assistant). */
  guidedSetup?: boolean;
  /** When true, shows the Setup Assistant orchestration layer (ENABLE_GUIDED_SETUP). */
  guidedSetupAssistant?: boolean;
};

/**
 * Reuses the production Xero configuration UI from legacy Integrations settings.
 */
export function XeroIntegrationPanel({
  organizationId,
  stablecoinSettlementsEnabled,
  merchantRails,
  returnTo,
  guidedSetup = false,
  guidedSetupAssistant = false,
}: XeroIntegrationPanelProps) {
  const rails: MerchantPaymentRails = merchantRails ?? {
    stripeEnabled: true,
    wiseEnabled: false,
    stablecoinSettlementsEnabled,
  };

  const showAssistant = guidedSetupAssistant;
  const showLegacyProgress = guidedSetup && !showAssistant;

  return (
    <XeroIntegrationsGate>
      <div className="space-y-6">
        {showAssistant ? (
          <XeroGuidedSetupOrchestrator
            organizationId={organizationId}
            merchantRails={rails}
            variant="commercial"
          />
        ) : null}

        {showLegacyProgress ? (
          <XeroSetupProgress organizationId={organizationId} variant="commercial" />
        ) : null}

        <XeroConnection
          organizationId={organizationId}
          returnTo={returnTo}
          suppressOAuthSuccessBanner={guidedSetup || showAssistant}
        />

        {!showAssistant ? <XeroAccountingHealth organizationId={organizationId} /> : null}

        <details
          id="advanced-accounting-settings"
          className="rounded-lg border border-border bg-card"
          open={guidedSetup || showAssistant}
        >
          <summary className="cursor-pointer px-6 py-4 text-sm font-medium">
            {guidedSetup || showAssistant ? 'Account mappings' : 'Advanced Accounting Settings'}
          </summary>
          <div className="border-t p-6">
            {guidedSetup || showAssistant ? (
              <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
                Provvy needs to know which Xero accounts to use when syncing invoices and payments.
                We&apos;ve pre-filled recommended options — you can adjust these if your accountant
                prefers different accounts.
              </p>
            ) : null}
            <XeroAccountMapping
              organizationId={organizationId}
              stablecoinSettlementsEnabled={rails.stablecoinSettlementsEnabled}
              merchantRails={rails}
              showContextualHelp={showAssistant}
              showGuidedSectionIds={showAssistant}
            />
          </div>
        </details>

        <XeroSyncQueue organizationId={organizationId} showGuidedSectionId={showAssistant} />
      </div>
    </XeroIntegrationsGate>
  );
}
