'use client';

import { SetupAssistant } from '@/components/commercial-os/setup-assistant';
import { XeroHealthCheckCard } from '@/components/xero/xero-health-check-card';
import { useXeroGuidedSetupState } from '@/hooks/use-xero-guided-setup-state';
import {
  XERO_GUIDED_SETUP_CONFIG,
} from '@/lib/xero/xero-guided-setup-config';
import type { MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';

type XeroGuidedSetupOrchestratorProps = {
  organizationId: string;
  merchantRails: MerchantPaymentRails;
  variant?: 'default' | 'commercial';
};

/** Wires the generic SetupAssistant to live Xero page sections. */
export function XeroGuidedSetupOrchestrator({
  organizationId,
  merchantRails,
  variant = 'commercial',
}: XeroGuidedSetupOrchestratorProps) {
  const { loading, steps, healthChecks, refresh } = useXeroGuidedSetupState(
    organizationId,
    merchantRails
  );

  return (
    <div className="space-y-4">
      <SetupAssistant
        config={XERO_GUIDED_SETUP_CONFIG}
        steps={loading ? [] : steps}
        variant={variant}
      />
      <XeroHealthCheckCard
        checks={healthChecks}
        loading={loading}
        onRefresh={refresh}
        variant={variant}
      />
    </div>
  );
}
