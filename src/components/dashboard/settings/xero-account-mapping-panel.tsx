'use client';

import { XeroAccountMapping } from '@/components/dashboard/settings/xero-account-mapping';
import type { MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';

type XeroAccountMappingPanelProps = {
  organizationId: string;
  merchantRails: MerchantPaymentRails;
  showContextualHelp?: boolean;
  showGuidedSectionIds?: boolean;
  commercialOs?: boolean;
};

export function XeroAccountMappingPanel({
  organizationId,
  merchantRails,
  showContextualHelp = false,
  showGuidedSectionIds = false,
  commercialOs = false,
}: XeroAccountMappingPanelProps) {
  return (
    <XeroAccountMapping
      organizationId={organizationId}
      stablecoinSettlementsEnabled={merchantRails.stablecoinSettlementsEnabled}
      merchantRails={merchantRails}
      showContextualHelp={showContextualHelp}
      showGuidedSectionIds={showGuidedSectionIds}
      commercialOs={commercialOs}
      layout="progressive"
    />
  );
}
