/**
 * Operator obligations — canonical route under Payouts (not gated partners layout).
 */
import DealNetworkObligationsPage from '../../partners/deal-network/obligations/page';
import { ProjectSectionErrorBoundary } from '@/components/projects/project-section-error-boundary';

export default function PayoutsObligationsPage() {
  return (
    <ProjectSectionErrorBoundary sectionTitle="Payout obligations" boundaryScope="payouts">
      <DealNetworkObligationsPage />
    </ProjectSectionErrorBoundary>
  );
}
