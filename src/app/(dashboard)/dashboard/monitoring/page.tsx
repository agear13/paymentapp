import { MonitoringDashboard } from '@/components/dashboard/monitoring/monitoring-dashboard';
import { EntitlementPageShell } from '@/components/entitlements/entitlement-page-shell';

export default function MonitoringPage() {
  return (
    <EntitlementPageShell feature="advanced_reporting">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Monitoring</h1>
          <p className="text-muted-foreground">
            Monitor system health, alerts, and performance metrics
          </p>
        </div>

        <MonitoringDashboard />
      </div>
    </EntitlementPageShell>
  );
}







