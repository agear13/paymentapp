import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OnboardingForm } from '@/components/onboarding/onboarding-form';
import { getUserOrganization } from '@/lib/auth/get-org';
import { redirect } from 'next/navigation';

export default async function OnboardingPage() {
  // If user already has an organization, redirect to dashboard
  const organization = await getUserOrganization();
  if (organization) {
    redirect('/dashboard');
  }
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to Provvypay</h1>
        <p className="mt-2 text-muted-foreground">
          Let's get your organization set up so you can start accepting payments.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Your Organization</CardTitle>
          <CardDescription>
            This will be your workspace for managing payment links and transactions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm />
        </CardContent>
      </Card>
    </div>
  );
}













