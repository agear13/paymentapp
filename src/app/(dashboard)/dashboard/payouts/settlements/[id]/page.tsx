import { EntitlementPageShell } from '@/components/entitlements/entitlement-page-shell';
import SettlementDetailPage from '../../../partners/payouts/[id]/page';

export default function PayoutSettlementDetailPage() {
  return (
    <EntitlementPageShell feature="automated_settlement_coordination">
      <SettlementDetailPage />
    </EntitlementPageShell>
  );
}
