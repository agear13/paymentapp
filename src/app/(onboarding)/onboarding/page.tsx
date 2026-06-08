import { Suspense } from 'react';
import { WorkflowOnboardingForm } from '@/components/onboarding/workflow-onboarding-form';

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <WorkflowOnboardingForm />
    </Suspense>
  );
}
