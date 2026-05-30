/**
 * Operator obligations — canonical route under Payouts (not gated partners layout).
 */
import DealNetworkObligationsPage from '../../partners/deal-network/obligations/page';
import { ProjectSectionErrorBoundary } from '@/components/projects/project-section-error-boundary';
import { getIsBetaAdmin } from '@/lib/auth/beta-admin.server';
import { deriveOperationalCapabilities } from '@/lib/operations/capabilities/derive-operational-capabilities';
import config from '@/lib/config/env';

export default async function PayoutsObligationsPage() {
  const isBetaAdmin = await getIsBetaAdmin();
  const releaseCapabilities = deriveOperationalCapabilities({
    isBetaAdmin,
    betaLockdownEnabled: config.features.betaLockdown,
  });

  return (
    <ProjectSectionErrorBoundary sectionTitle="Payout obligations" boundaryScope="payouts">
      <DealNetworkObligationsPage releaseCapabilities={releaseCapabilities} />
    </ProjectSectionErrorBoundary>
  );
}
