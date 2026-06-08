import { BillingSettingsPanel } from '@/components/dashboard/settings/billing-settings-panel';

export default function BillingSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          View your subscription, renewal date, and payment method. Manage billing in Stripe.
        </p>
      </div>

      <BillingSettingsPanel />
    </div>
  );
}
