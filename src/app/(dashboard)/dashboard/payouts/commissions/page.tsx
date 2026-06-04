import { OperatorCommissionsWorkspace } from '@/components/payouts/operator-commissions-workspace';
import { ProjectSectionErrorBoundary } from '@/components/projects/project-section-error-boundary';
import { getIsBetaAdmin } from '@/lib/auth/beta-admin.server';
import { deriveOperationalCapabilities } from '@/lib/operations/capabilities/derive-operational-capabilities';
import { deriveReleaseInteractionState } from '@/lib/operations/capabilities/derive-release-interaction-state';
import { resolveCanViewAttributionCommissionsForSession } from '@/lib/operations/capabilities/resolve-attribution-view-capability.server';
import config from '@/lib/config/env';
import { logAttributionRuntimeDiag } from '@/lib/operations/dev/attribution-runtime-diag';

export default async function PayoutsCommissionsPage() {
  const isBetaAdmin = await getIsBetaAdmin();
  const canViewAttributionCommissions = await resolveCanViewAttributionCommissionsForSession();
  const releaseCapabilities = deriveOperationalCapabilities({
    isBetaAdmin,
    betaLockdownEnabled: config.features.betaLockdown,
    canViewAttributionCommissions,
  });

  const previewInteraction = deriveReleaseInteractionState({
    operationalCapabilities: releaseCapabilities,
    graphReady: true,
    graphSnapshotConverged: true,
    activationLoading: false,
  });

  logAttributionRuntimeDiag('PayoutsCommissionsPage(server)', {
    isBetaAdmin,
    canUseBetaSettlementFeatures: releaseCapabilities.canUseBetaSettlementFeatures,
    canViewAttributionCommissions: releaseCapabilities.canViewAttributionCommissions,
    canQueryReferralCommissionLedger: previewInteraction.canQueryReferralCommissionLedger,
    releaseInteractionEnabled: previewInteraction.releaseInteractionEnabled,
    graphReady: true,
    graphSnapshotConverged: true,
    releaseCapabilitiesPassedToWorkspace: true,
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
