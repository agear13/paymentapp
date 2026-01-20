'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
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

const onboardingSchema = z.object({
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters').max(255),
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(255),
  defaultCurrency: z.string().length(3, 'Please select a currency'),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

export function OnboardingForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      organizationName: '',
      displayName: '',
      defaultCurrency: 'USD',
    },
  });

  async function onSubmit(data: OnboardingFormValues) {
    console.log('🚀 Onboarding form submitted with data:', data);
    setIsLoading(true);
    try {
      // Step 1: Create organization
      console.log('📝 Creating organization...');
      const orgPayload = {
        name: data.organizationName,
        clerkOrgId: `temp_${Date.now()}`,
      };
      console.log('📦 Organization payload:', orgPayload);
      
      const orgResponse = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orgPayload),
      });
      
      console.log('📡 Organization response status:', orgResponse.status);

      if (!orgResponse.ok) {
        const errorData = await orgResponse.json().catch(() => ({}));
        console.error('Organization creation failed:', errorData);
        throw new Error(errorData.error || 'Failed to create organization');
      }

      const organization = await orgResponse.json();
      console.log('📦 Organization created:', organization);

      // Store clerk_org_id in localStorage (used for API calls)
      if (organization.clerk_org_id) {
        window.localStorage.setItem('provvypay.organizationId', organization.clerk_org_id);
      }

      // Step 2: Create merchant settings
      console.log('⚙️ Creating merchant settings...');
      const settingsPayload = {
        organizationId: organization.id,
        displayName: data.displayName,
        defaultCurrency: data.defaultCurrency,
      };
      console.log('📦 Merchant settings payload:', settingsPayload);
      
      const settingsResponse = await fetch('/api/merchant-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsPayload),
      });
      
      console.log('📡 Merchant settings response status:', settingsResponse.status);

      if (!settingsResponse.ok) {
        const errorData = await settingsResponse.json().catch(() => ({}));
        console.error('Merchant settings creation failed:', errorData);
        throw new Error(errorData.error || 'Failed to create merchant settings');
      }

      console.log('✅ Onboarding completed successfully!');
      toast.success('Organization created successfully!');
      router.push('/dashboard');
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to complete onboarding';
      console.error('❌ Onboarding error:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        raw: error,
      });
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSkip() {
    // Skip onboarding and go straight to dashboard
    // The dashboard will handle the case where no organization exists
    toast.info('You can set up your organization later from Settings');
    router.push('/dashboard');
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="organizationName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization Name</FormLabel>
              <FormControl>
                <Input placeholder="Acme Corp" {...field} />
              </FormControl>
              <FormDescription>
                This is your organization's name within Provvypay.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Business Display Name</FormLabel>
              <FormControl>
                <Input placeholder="Acme Corporation" {...field} />
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

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" disabled={isLoading} onClick={handleSkip}>
            Skip for now
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Complete Setup
          </Button>
        </div>
      </form>
    </Form>
  );
}













