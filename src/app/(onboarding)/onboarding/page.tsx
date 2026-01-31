import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OnboardingForm } from '@/components/onboarding/onboarding-form';

export default async function OnboardingPage() {
  // Always show onboarding form for new signups
  // The form will handle existing organizations gracefully
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to Provvypay</h1>
        <p className="mt-2 text-muted-foreground">
          Let&apos;s get you set up in just 2 quick steps so you can start accepting payments.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Setup</CardTitle>
          <CardDescription>
            Configure your organization and payment methods to start processing payments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm />
        </CardContent>
      </Card>
    </div>
  );
}













