import { Suspense } from 'react';
import { AssessmentLayout } from '@/components/journey/lovable';

export default function JourneyOnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AssessmentLayout>{children}</AssessmentLayout>
    </Suspense>
  );
}
