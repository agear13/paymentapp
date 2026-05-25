import { OperatorSettlementsWorkspace } from '@/components/payouts/operator-settlements-workspace';
import { getIsBetaAdmin } from '@/lib/auth/beta-admin.server';
import { deriveOperationalCapabilities } from '@/lib/operations/capabilities/derive-operational-capabilities';
import config from '@/lib/config/env';

export default async function PayoutsSettlementsPage() {
  const isBetaAdmin = await getIsBetaAdmin();
  const releaseCapabilities = deriveOperationalCapabilities({
    isBetaAdmin,
    betaLockdownEnabled: config.features.betaLockdown,
  });

  return <OperatorSettlementsWorkspace releaseCapabilities={releaseCapabilities} />;
}
