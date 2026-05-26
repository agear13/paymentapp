'use client';

import { Card, CardContent } from '@/components/ui/card';
import { MerchantSettingsForm } from '@/components/dashboard/settings/merchant-settings-form';
import { WorkspaceActivationBanner } from '@/components/onboarding/workspace-activation-banner';
import { PaymentRailsFocusSection } from '@/components/settings/payment-rails-focus-section';
import { OperationalSettlementInitialization } from '@/components/operations/operational-settlement-initialization';
import { useWorkspaceActivation } from '@/hooks/use-workspace-activation';

type MerchantSettingsShellProps = {
  variant: 'pilot' | 'full';
};

export function MerchantSettingsShell({ variant }: MerchantSettingsShellProps) {
  const { operationalOnboarding, operationalInitialization, loading } = useWorkspaceActivation();

  return (
    <div className="space-y-6">
      <OperationalSettlementInitialization
        onboarding={operationalOnboarding}
        initialization={operationalInitialization}
        loading={loading}
      >
        <Card className="border-primary/15 bg-primary/[0.02]">
          <CardContent className="pt-6">
            <WorkspaceActivationBanner nextActionVariant="merchant-settings" />
          </CardContent>
        </Card>
      </OperationalSettlementInitialization>

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
