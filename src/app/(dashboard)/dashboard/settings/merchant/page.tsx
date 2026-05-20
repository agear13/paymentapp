import { Card, CardContent } from '@/components/ui/card';
import { MerchantSettingsForm } from '@/components/dashboard/settings/merchant-settings-form';
import { OnboardingContinuationBanner } from '@/components/onboarding/onboarding-continuation-banner';
import { getDashboardProductProfile } from '@/lib/auth/dashboard-product.server';
import { getUserOrganization } from '@/lib/auth/get-org';
import { getOperatorOnboardingState } from '@/lib/onboarding/operator-onboarding.server';
import { getOnboardingSetupChecklist } from '@/lib/onboarding/onboarding-setup-checklist.server';

export default async function MerchantSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const profile = await getDashboardProductProfile();
  const isPilot = profile === 'rabbit_hole_pilot' || profile === 'strait_experiences_pilot';
  const params = await searchParams;
  const organization = await getUserOrganization();

  let showOnboardingBanner = params.onboarding === 'continue';
  let checklist = [] as Awaited<ReturnType<typeof getOnboardingSetupChecklist>>;

  if (organization) {
    const onboardingState = await getOperatorOnboardingState(organization.id);
    if (onboardingState && !onboardingState.completed) {
      showOnboardingBanner = true;
    }
    if (showOnboardingBanner) {
      checklist = await getOnboardingSetupChecklist(organization.id);
    }
  }

  return (
    <div className="space-y-6">
      {showOnboardingBanner ? <OnboardingContinuationBanner checklist={checklist} /> : null}

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Collection & settlement setup</h1>
        <p className="text-muted-foreground">
          {isPilot
            ? 'Configure how your pilot workspace collects revenue and coordinates settlement.'
            : 'Configure how your workspace collects revenue, coordinates payouts, and settles obligations.'}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <MerchantSettingsForm variant={isPilot ? 'pilot' : 'full'} />
        </CardContent>
      </Card>
    </div>
  );
}
