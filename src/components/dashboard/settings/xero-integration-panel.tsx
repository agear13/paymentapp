'use client';

import { XeroConnection } from '@/components/dashboard/settings/xero-connection';
import { XeroSyncQueue } from '@/components/dashboard/settings/xero-sync-queue';
import { XeroAccountMapping } from '@/components/dashboard/settings/xero-account-mapping';
import { XeroAccountMappingPanel } from '@/components/dashboard/settings/xero-account-mapping-panel';
import { XeroAccountingHealth } from '@/components/dashboard/settings/xero-accounting-health';
import { XeroIntegrationsGate } from '@/components/entitlements/xero-integrations-gate';
import { XeroSetupProgress } from '@/components/xero/xero-setup-progress';
import { XeroGuidedSetupOrchestrator } from '@/components/xero/xero-guided-setup-orchestrator';
import { XeroInvoiceReadinessHero } from '@/components/xero/xero-invoice-readiness-hero';
import { useCommercialReadinessOptional } from '@/hooks/use-commercial-readiness';
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
  const readiness = useCommercialReadinessOptional();
  const rails: MerchantPaymentRails = merchantRails ?? {
    stripeEnabled: true,
    wiseEnabled: false,
    stablecoinSettlementsEnabled,
  };

  const showAssistant = guidedSetupAssistant;
  const showLegacyProgress = guidedSetup && !showAssistant;
  const showCommercialLayout = commercialOs || guidedSetup || showAssistant;

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

        {!showAssistant && showCommercialLayout ? (
          <XeroInvoiceReadinessHero variant="commercial" />
        ) : null}

        <XeroConnection
          organizationId={organizationId}
          returnTo={returnTo}
          suppressOAuthSuccessBanner={guidedSetup || showAssistant}
          variant={commercialOs ? 'commercial' : 'default'}
        />

        {!showCommercialLayout ? <XeroAccountingHealth organizationId={organizationId} /> : null}

        {showCommercialLayout ? (
          <XeroAccountMappingPanel
            organizationId={organizationId}
            merchantRails={rails}
            showContextualHelp={showAssistant}
            showGuidedSectionIds={showAssistant}
            commercialOs={commercialOs}
          />
        ) : (
          <details
            id="advanced-accounting-settings"
            className="rounded-lg border border-border bg-card"
            open={guidedSetup || showAssistant}
          >
            <summary className="cursor-pointer px-6 py-4 text-sm font-medium">
              Advanced Accounting Settings
            </summary>
            <div className="border-t p-6">
              <XeroAccountMapping
                organizationId={organizationId}
                stablecoinSettlementsEnabled={rails.stablecoinSettlementsEnabled}
                merchantRails={rails}
              />
            </div>
          </details>
        )}

        {readiness?.queue.showPastPayments ? (
          <XeroSyncQueue
            organizationId={organizationId}
            showGuidedSectionId={showAssistant}
            variant={commercialOs ? 'commercial' : 'default'}
          />
        ) : null}
      </div>
    </XeroIntegrationsGate>
  );
}
