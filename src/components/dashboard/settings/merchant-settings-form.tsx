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
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<MerchantSettingsFormValues>({
    resolver: zodResolver(merchantSettingsSchema),
    defaultValues: {
      displayName: '',
      defaultCurrency: 'USD',
      stripeAccountId: '',
      hederaAccountId: '',
    },
  });

  async function onSubmit(data: MerchantSettingsFormValues) {
    setIsLoading(true);
    try {
      // TODO: Implement API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success('Merchant settings updated successfully');
    } catch (error) {
      toast.error('Failed to update merchant settings');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
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
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  );
}













