'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// ISO 4217 Currency codes - common ones
const currencies = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'NZD', name: 'New Zealand Dollar' },
];

const merchantSettingsSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(255),
  defaultCurrency: z.string().length(3, 'Currency must be a 3-letter ISO code'),
  stripeAccountId: z.string().optional().refine(
    (val) => !val || val.startsWith('acct_'),
    'Stripe account ID must start with "acct_"'
  ),
  hederaAccountId: z.string().optional().refine(
    (val) => !val || /^0\.0\.\d+$/.test(val),
    'Hedera account ID must be in format 0.0.xxxxx'
  ),
});

type MerchantSettingsFormValues = z.infer<typeof merchantSettingsSchema>;

export function MerchantSettingsForm() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [settingsId, setSettingsId] = React.useState<string | null>(null);
  const [organizationId, setOrganizationId] = React.useState<string | null>(null);

  const form = useForm<MerchantSettingsFormValues>({
    resolver: zodResolver(merchantSettingsSchema),
    defaultValues: {
      displayName: '',
      defaultCurrency: 'USD',
      stripeAccountId: '',
      hederaAccountId: '',
    },
  });

  // Fetch organization and existing settings on mount
  React.useEffect(() => {
    async function fetchData() {
      try {
        // Get organization
        const orgResponse = await fetch('/api/organizations');
        if (orgResponse.ok) {
          const orgs = await orgResponse.json();
          if (orgs && orgs.length > 0) {
            const org = orgs[0];
            setOrganizationId(org.id);

            // Get existing merchant settings
            const settingsResponse = await fetch(`/api/merchant-settings?organizationId=${org.id}`);
            if (settingsResponse.ok) {
              const settingsData = await settingsResponse.json();
              if (settingsData && settingsData.length > 0) {
                const settings = settingsData[0];
                setSettingsId(settings.id);
                form.reset({
                  displayName: settings.display_name || '',
                  defaultCurrency: settings.default_currency || 'USD',
                  stripeAccountId: settings.stripe_account_id || '',
                  hederaAccountId: settings.hedera_account_id || '',
                });
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
        toast.error('Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [form]);

  async function onSubmit(data: MerchantSettingsFormValues) {
    if (!organizationId) {
      toast.error('No organization found. Please complete onboarding first.');
      return;
    }

    setIsLoading(true);
    try {
      if (settingsId) {
        // Update existing settings
        const response = await fetch(`/api/merchant-settings/${settingsId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: data.displayName,
            defaultCurrency: data.defaultCurrency,
            stripeAccountId: data.stripeAccountId || undefined,
            hederaAccountId: data.hederaAccountId || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update settings');
        }

        toast.success('Merchant settings updated successfully');
      } else {
        // Create new settings
        const response = await fetch('/api/merchant-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId,
            displayName: data.displayName,
            defaultCurrency: data.defaultCurrency,
            stripeAccountId: data.stripeAccountId || undefined,
            hederaAccountId: data.hederaAccountId || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create settings');
        }

        const result = await response.json();
        setSettingsId(result.data.id);
        toast.success('Merchant settings created successfully');
      }
    } catch (error) {
      toast.error('Failed to save merchant settings');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display Name</FormLabel>
              <FormControl>
                <Input placeholder="My Business" {...field} />
              </FormControl>
              <FormDescription>
                This name will appear on payment pages and receipts.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="defaultCurrency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Default Currency</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a currency" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.code} - {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                The default currency for new payment links.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="stripeAccountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Stripe Account ID</FormLabel>
              <FormControl>
                <Input placeholder="acct_xxxxxxxxxxxxx" {...field} />
              </FormControl>
              <FormDescription>
                Your Stripe Connect account ID (starts with "acct_").
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="hederaAccountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hedera Account ID</FormLabel>
              <FormControl>
                <Input placeholder="0.0.12345" {...field} />
              </FormControl>
              <FormDescription>
                Your Hedera account ID in the format 0.0.xxxxx.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting || isLoading}>
            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {settingsId ? 'Update Settings' : 'Create Settings'}
          </Button>
        </div>
      </form>
    </Form>
  );
}













