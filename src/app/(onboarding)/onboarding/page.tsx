import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkflowOnboardingForm } from '@/components/onboarding/workflow-onboarding-form';

export default function OnboardingPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to Provvypay</h1>
        <p className="mt-2 text-muted-foreground max-w-lg mx-auto">
          Set up your operational coordination workflow — projects, participants, funding, and
          payouts — in a few guided steps.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Get started</CardTitle>
          <CardDescription>
            You can connect payment rails later. We will guide you through what needs attention
            first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkflowOnboardingForm />
        </CardContent>
      </Card>
    </div>
  );
}
