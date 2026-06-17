'use client';

import { Card, CardContent } from '@/components/ui/card';
import { MerchantSettingsForm } from '@/components/dashboard/settings/merchant-settings-form';
import { PaymentRailsFocusSection } from '@/components/settings/payment-rails-focus-section';
import { PaymentSetupStatus } from '@/components/workflow/payment-setup-status';

type MerchantSettingsShellProps = {
  variant: 'pilot' | 'full';
};

/**
 * Payment Setup shell.
 *
 * Replaced the previous implementation which showed two overlapping progress UIs:
 *   - OperationalSettlementInitialization (engineering-language milestone strip)
 *   - WorkspaceActivationBanner (duplicate checklist)
 *
 * Now shows a single, clean source of truth:
 *   1. PaymentSetupStatus — current state + remaining work + commercial journey
 *   2. MerchantSettingsForm — the actual configuration
 */
export function MerchantSettingsShell({ variant }: MerchantSettingsShellProps) {
  return (
    <div className="space-y-6">
      {/* Single source of truth — replaces the duplicate OperationalSettlementInitialization
          + WorkspaceActivationBanner that previously showed the same state twice */}
      <PaymentSetupStatus />

      <PaymentRailsFocusSection>
        <Card>
          <CardContent className="pt-6">
            <MerchantSettingsForm variant={variant} />
          </CardContent>
        </Card>
      </PaymentRailsFocusSection>
    </div>
  );
}
