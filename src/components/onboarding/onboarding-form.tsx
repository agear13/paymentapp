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
import { Loader2, CheckCircle2, CreditCard, Building } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

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

const organizationSchema = z.object({
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters').max(255),
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(255),
  defaultCurrency: z.string().length(3, 'Please select a currency'),
});

const paymentMethodsSchema = z.object({
  stripeAccountId: z.string().optional().refine(
    (val) => !val || val.startsWith('acct_'),
    'Stripe account ID must start with "acct_"'
  ),
  hederaAccountId: z.string().optional().refine(
    (val) => !val || /^0\.0\.\d+$/.test(val),
    'Hedera account ID must be in format 0.0.xxxxx'
  ),
}).refine(
  (data) => data.stripeAccountId || data.hederaAccountId,
  {
    message: 'At least one payment method is required to accept payments',
    path: ['stripeAccountId'],
  }
);

type OrganizationFormValues = z.infer<typeof organizationSchema>;
type PaymentMethodsFormValues = z.infer<typeof paymentMethodsSchema>;

type OnboardingStep = 'organization' | 'payment-methods' | 'complete';

export function OnboardingForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState<OnboardingStep>('organization');
  const [settingsId, setSettingsId] = React.useState<string | null>(null);

  const orgForm = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      organizationName: '',
      displayName: '',
      defaultCurrency: 'USD',
    },
  });

  const paymentForm = useForm<PaymentMethodsFormValues>({
    resolver: zodResolver(paymentMethodsSchema),
    defaultValues: {
      stripeAccountId: '',
      hederaAccountId: '',
    },
  });

  async function onOrganizationSubmit(data: OrganizationFormValues) {
    console.log('🚀 Step 1: Organization form submitted with data:', data);
    setIsLoading(true);
    try {
      // Create organization
      console.log('📝 Creating organization...');
      const orgPayload = {
        name: data.organizationName,
        clerkOrgId: `temp_${Date.now()}`,
      };
      
      const orgResponse = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orgPayload),
      });

      if (!orgResponse.ok) {
        const errorData = await orgResponse.json().catch(() => ({}));
        console.error('Organization creation failed:', errorData);
        throw new Error(errorData.error || 'Failed to create organization');
      }

      const organization = await orgResponse.json();
      console.log('📦 Organization created:', organization);

      // Store database UUID in localStorage
      if (organization.id) {
        window.localStorage.setItem('provvypay.organizationId', organization.id);
      }

      // Create initial merchant settings (without payment methods)
      console.log('⚙️ Creating merchant settings...');
      const settingsPayload = {
        organizationId: organization.id,
        displayName: data.displayName,
        defaultCurrency: data.defaultCurrency,
      };
      
      const settingsResponse = await fetch('/api/merchant-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsPayload),
      });

      if (!settingsResponse.ok) {
        const errorData = await settingsResponse.json().catch(() => ({}));
        console.error('Merchant settings creation failed:', errorData);
        throw new Error(errorData.error || 'Failed to create merchant settings');
      }

      const settingsData = await settingsResponse.json();
      setSettingsId(settingsData.data.id);
      console.log('✅ Step 1 completed successfully!');
      
      toast.success('Organization created successfully!');
      setCurrentStep('payment-methods');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create organization';
      console.error('❌ Organization creation error:', error);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  async function onPaymentMethodsSubmit(data: PaymentMethodsFormValues) {
    console.log('🚀 Step 2: Payment methods submitted with data:', data);
    setIsLoading(true);
    try {
      if (!settingsId) {
        throw new Error('Merchant settings not found');
      }

      // Update merchant settings with payment methods
      const response = await fetch(`/api/merchant-settings/${settingsId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripeAccountId: data.stripeAccountId || undefined,
          hederaAccountId: data.hederaAccountId || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update payment methods');
      }

      console.log('✅ Payment methods configured successfully!');
      
      // Set cookie to indicate user has completed onboarding
      document.cookie = 'provvypay_has_org=true; path=/; max-age=31536000'; // 1 year
      
      toast.success('Payment methods configured successfully!');
      setCurrentStep('complete');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to configure payment methods';
      console.error('❌ Payment methods error:', error);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  function handleComplete() {
    router.push('/dashboard');
  }

  function handleSkipPaymentMethods() {
    toast.info('You can configure payment methods later from Settings > Merchant Settings');
    document.cookie = 'provvypay_has_org=true; path=/; max-age=31536000';
    router.push('/dashboard');
  }

  // Step 1: Organization Setup
  if (currentStep === 'organization') {
    return (
      <div className="space-y-6">
        {/* Progress Indicator */}
        <div className="flex items-center gap-2">
          <Badge variant="default">Step 1 of 2</Badge>
          <span className="text-sm text-muted-foreground">Organization Setup</span>
        </div>

        <Form {...orgForm}>
          <form onSubmit={orgForm.handleSubmit(onOrganizationSubmit)} className="space-y-6">
            <FormField
              control={orgForm.control}
              name="organizationName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Corp" {...field} />
                  </FormControl>
                  <FormDescription>
                    This is your organization&apos;s name within Provvypay.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={orgForm.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Display Name *</FormLabel>
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
              control={orgForm.control}
              name="defaultCurrency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Currency *</FormLabel>
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

            <div className="flex justify-end">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue to Payment Setup
              </Button>
            </div>
          </form>
        </Form>
      </div>
    );
  }

  // Step 2: Payment Methods Setup
  if (currentStep === 'payment-methods') {
    return (
      <div className="space-y-6">
        {/* Progress Indicator */}
        <div className="flex items-center gap-2">
          <Badge variant="default">Step 2 of 2</Badge>
          <span className="text-sm text-muted-foreground">Payment Methods</span>
        </div>

        <Alert>
          <CreditCard className="h-4 w-4" />
          <AlertTitle>Configure Payment Methods</AlertTitle>
          <AlertDescription>
            To accept payments, you need to connect at least one payment processor. 
            You can add Stripe for traditional card payments and/or Hedera for cryptocurrency payments.
          </AlertDescription>
        </Alert>

        <Form {...paymentForm}>
          <form onSubmit={paymentForm.handleSubmit(onPaymentMethodsSubmit)} className="space-y-6">
            <FormField
              control={paymentForm.control}
              name="stripeAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stripe Account ID (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="acct_xxxxxxxxxxxxx" {...field} />
                  </FormControl>
                  <FormDescription>
                    Your Stripe Connect account ID for accepting card payments. Starts with &quot;acct_&quot;.
                    <a 
                      href="https://dashboard.stripe.com/settings/account" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="ml-1 text-primary hover:underline"
                    >
                      Get your Stripe Account ID
                    </a>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={paymentForm.control}
              name="hederaAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hedera Account ID (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="0.0.12345" {...field} />
                  </FormControl>
                  <FormDescription>
                    Your Hedera account ID for accepting cryptocurrency payments in the format 0.0.xxxxx.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Alert variant="destructive" className="bg-yellow-50 dark:bg-yellow-950 text-yellow-900 dark:text-yellow-100 border-yellow-200 dark:border-yellow-800">
              <Building className="h-4 w-4" />
              <AlertTitle>At least one payment method required</AlertTitle>
              <AlertDescription>
                You must configure at least one payment method (Stripe or Hedera) to create payment links that can collect payments.
                You can skip this step and configure it later from Settings &gt; Merchant Settings.
              </AlertDescription>
            </Alert>

            <div className="flex justify-between gap-4">
              <Button type="button" variant="outline" disabled={isLoading} onClick={handleSkipPaymentMethods}>
                Skip for now
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Complete Setup
              </Button>
            </div>
          </form>
        </Form>
      </div>
    );
  }

  // Step 3: Complete
  if (currentStep === 'complete') {
    return (
      <div className="space-y-6 text-center py-8">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-100 dark:bg-green-950 p-3">
            <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Setup Complete!</h2>
          <p className="text-muted-foreground">
            Your organization is ready. You can now create payment links and start accepting payments.
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium">Next Steps:</p>
          <ul className="text-sm text-muted-foreground space-y-1 text-left max-w-md mx-auto">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <span>Create your first payment link from the dashboard</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <span>Customize your branding in Settings &gt; Merchant Settings</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <span>Connect accounting integrations in Settings &gt; Integrations</span>
            </li>
          </ul>
        </div>

        <Button onClick={handleComplete} size="lg">
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return null;
}













