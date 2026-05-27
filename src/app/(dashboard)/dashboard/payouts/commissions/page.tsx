import { OperatorCommissionsWorkspace } from '@/components/payouts/operator-commissions-workspace';
import { ProjectSectionErrorBoundary } from '@/components/projects/project-section-error-boundary';

export default function PayoutsCommissionsPage() {
  return (
    <ProjectSectionErrorBoundary sectionTitle="Participant earnings" boundaryScope="payouts">
      <OperatorCommissionsWorkspace />
    </ProjectSectionErrorBoundary>
  );
}
