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
  /** Commercial OS styling and copy. */
  commercialOs?: boolean;
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
  commercialOs = false,
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
          variant={commercialOs ? 'commercial' : 'default'}
        />

        {!showAssistant ? <XeroAccountingHealth organizationId={organizationId} /> : null}

        <details
          id="advanced-accounting-settings"
          className="rounded-lg border border-border bg-card"
          open={guidedSetup || showAssistant}
        >
          <summary className="cursor-pointer px-6 py-4 text-sm font-medium">
            {commercialOs || guidedSetup || showAssistant
              ? 'Choose which Xero accounts to use'
              : 'Advanced Accounting Settings'}
          </summary>
          <div className="border-t p-6">
            {commercialOs || guidedSetup || showAssistant ? (
              <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
                Pick the Xero accounts Provvy uses for invoices and payments. Saved choices appear
                in the summary at the bottom.
              </p>
            ) : null}
            <XeroAccountMapping
              organizationId={organizationId}
              stablecoinSettlementsEnabled={rails.stablecoinSettlementsEnabled}
              merchantRails={rails}
              showContextualHelp={showAssistant}
              showGuidedSectionIds={showAssistant}
              commercialOs={commercialOs}
            />
          </div>
        </details>

        <XeroSyncQueue organizationId={organizationId} showGuidedSectionId={showAssistant} />
      </div>
    </XeroIntegrationsGate>
  );
}
