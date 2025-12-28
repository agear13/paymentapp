import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MerchantSettingsForm } from '@/components/dashboard/settings/merchant-settings-form';

export default function MerchantSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Merchant Settings</h1>
        <p className="text-muted-foreground">
          Configure your payment processing and integration settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Configuration</CardTitle>
          <CardDescription>
            Set up your payment accounts and default preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MerchantSettingsForm />
        </CardContent>
      </Card>
    </div>
  );
}













