import { AgreementIntelligenceValidationDashboard } from '@/components/agreements/validation/agreement-intelligence-validation-dashboard';
import { EntitlementPageShell } from '@/components/entitlements/entitlement-page-shell';

export default function AgreementIntelligenceValidationPage() {
  return (
    <EntitlementPageShell feature="advanced_reporting">
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agreement Intelligence Validation</h1>
        <p className="text-muted-foreground mt-1 max-w-3xl">
          Measure whether operators understand, value, and act on Agreement Intelligence — usage,
          recommendation effectiveness, health accuracy, and lightweight feedback.
        </p>
      </div>
      <AgreementIntelligenceValidationDashboard />
    </div>
    </EntitlementPageShell>
  );
}
