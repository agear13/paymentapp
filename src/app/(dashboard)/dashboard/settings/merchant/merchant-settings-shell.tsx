'use client';

import { Card, CardContent } from '@/components/ui/card';
import { MerchantSettingsForm } from '@/components/dashboard/settings/merchant-settings-form';
import { WorkspaceActivationBanner } from '@/components/onboarding/workspace-activation-banner';

type MerchantSettingsShellProps = {
  variant: 'pilot' | 'full';
};

export function MerchantSettingsShell({ variant }: MerchantSettingsShellProps) {
  return (
    <div className="space-y-6">
      <Card className="border-primary/15 bg-primary/[0.02]">
        <CardContent className="pt-6">
          <WorkspaceActivationBanner />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <MerchantSettingsForm variant={variant} />
        </CardContent>
      </Card>
    </div>
  );
}
