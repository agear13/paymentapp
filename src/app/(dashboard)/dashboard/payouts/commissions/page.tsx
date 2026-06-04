import { OperatorCommissionsWorkspace } from '@/components/payouts/operator-commissions-workspace';
import { ProjectSectionErrorBoundary } from '@/components/projects/project-section-error-boundary';
import { getIsBetaAdmin } from '@/lib/auth/beta-admin.server';
import { deriveOperationalCapabilities } from '@/lib/operations/capabilities/derive-operational-capabilities';
import config from '@/lib/config/env';

export default async function PayoutsCommissionsPage() {
  const isBetaAdmin = await getIsBetaAdmin();
  const releaseCapabilities = deriveOperationalCapabilities({
    isBetaAdmin,
    betaLockdownEnabled: config.features.betaLockdown,
  });

  console.info('[ATTRIBUTION_COMMISSIONS]', {
    isBetaAdmin,
    canUseBetaSettlementFeatures: releaseCapabilities.canUseBetaSettlementFeatures,
    canQueryReferralCommissionLedger: null,
    surface: 'PayoutsCommissionsPage(server)',
  });

  return (
    <ProjectSectionErrorBoundary sectionTitle="Participant earnings" boundaryScope="payouts">
      <OperatorCommissionsWorkspace
        releaseCapabilities={releaseCapabilities}
        isBetaAdmin={isBetaAdmin}
      />
    </ProjectSectionErrorBoundary>
  );
}
