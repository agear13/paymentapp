'use client';

import { useMemo } from 'react';
import { SetupAssistant } from '@/components/commercial-os/setup-assistant';
import { XeroSetupStatusCard } from '@/components/xero/xero-setup-status-card';
import { useCommercialReadiness } from '@/hooks/use-commercial-readiness';
import {
  XERO_GUIDED_SETUP_CONFIG,
  buildXeroGuidedTourSteps,
} from '@/lib/xero/xero-guided-setup-config';
import type { MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';

type XeroGuidedSetupOrchestratorProps = {
  organizationId: string;
  merchantRails: MerchantPaymentRails;
  variant?: 'default' | 'commercial';
};

/** Setup status + optional walkthrough — readiness is the single source of truth. */
export function XeroGuidedSetupOrchestrator({
  merchantRails,
  variant = 'commercial',
}: XeroGuidedSetupOrchestratorProps) {
  const readiness = useCommercialReadiness();

  const steps = useMemo(
    () => (readiness.loading ? [] : buildXeroGuidedTourSteps(readiness, merchantRails)),
    [readiness, merchantRails]
  );

  return (
    <div className="space-y-4">
      <XeroSetupStatusCard variant={variant} />
      <SetupAssistant
        config={XERO_GUIDED_SETUP_CONFIG}
        steps={steps}
        variant={variant}
        tourOnly
      />
    </div>
  );
}
