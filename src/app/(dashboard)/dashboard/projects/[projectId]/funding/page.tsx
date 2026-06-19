import * as React from 'react';
import { ProjectCommercialForecast } from '@/components/projects/project-commercial-forecast';
import { ProjectFundingWorkflowBanner } from '@/components/commercial/project-funding-workflow-banner';

export default function ProjectFundingPage() {
  return (
    <div className="space-y-6">
      {/* Supplier onboarding progress + accounting review prompt */}
      <React.Suspense fallback={null}>
        <ProjectFundingWorkflowBanner />
      </React.Suspense>

      {/* Commercial forecast: revenue, obligations, risks */}
      <ProjectCommercialForecast />
    </div>
  );
}
