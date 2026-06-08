import { OperatorSettlementsWorkspace } from '@/components/payouts/operator-settlements-workspace';
import { EntitlementPageShell } from '@/components/entitlements/entitlement-page-shell';
import { getIsBetaAdmin } from '@/lib/auth/beta-admin.server';
import { deriveOperationalCapabilities } from '@/lib/operations/capabilities/derive-operational-capabilities';
import config from '@/lib/config/env';

export default async function PayoutsSettlementsPage() {
  const isBetaAdmin = await getIsBetaAdmin();
  const releaseCapabilities = deriveOperationalCapabilities({
    isBetaAdmin,
    betaLockdownEnabled: config.features.betaLockdown,
  });

  return (
    <EntitlementPageShell feature="automated_settlement_coordination">
      <OperatorSettlementsWorkspace releaseCapabilities={releaseCapabilities} />
    </EntitlementPageShell>
  );
}
