'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useOrganization } from '@/hooks/use-organization';
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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, Upload, X, Building2, AlertCircle, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  organizationLogoUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  defaultCurrency: z.string().length(3, 'Currency must be a 3-letter ISO code'),
  stripeAccountId: z.string().optional().refine(
    (val) => !val || val.startsWith('acct_'),
    'Stripe account ID must start with "acct_"'
  ),
  hederaAccountId: z.string().optional().refine(
    (val) => !val || /^0\.0\.\d+$/.test(val),
    'Hedera account ID must be in format 0.0.xxxxx'
  ),
  // Wise settings
  wiseProfileId: z.string().optional().refine(
    (val) => !val || /^\d+$/.test(val),
    'Wise Profile ID must be a numeric ID'
  ),
  wiseEnabled: z.boolean().optional(),
  wiseCurrency: z.string().length(3, 'Currency must be a 3-letter ISO code').optional().or(z.literal('')),
});

type MerchantSettingsFormValues = z.infer<typeof merchantSettingsSchema>;

export function MerchantSettingsForm() {
  const { organizationId, isLoading: isOrgLoading } = useOrganization();
  const [isLoading, setIsLoading] = React.useState(true);
  const [settingsId, setSettingsId] = React.useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = React.useState(false);
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
  const [wiseGloballyEnabled, setWiseGloballyEnabled] = React.useState(true); // Default to true, will be updated from API
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<MerchantSettingsFormValues>({
    resolver: zodResolver(merchantSettingsSchema),
    defaultValues: {
      displayName: '',
      organizationLogoUrl: '',
      defaultCurrency: 'USD',
      stripeAccountId: '',
      hederaAccountId: '',
      wiseProfileId: '',
      wiseEnabled: false,
      wiseCurrency: '',
    },
  });

  // Fetch existing settings when organizationId is available
  React.useEffect(() => {
    async function fetchSettings() {
      if (!organizationId) {
        setIsLoading(false);
        return;
      }

      try {
        // Get existing merchant settings
        const settingsResponse = await fetch(`/api/merchant-settings?organizationId=${organizationId}`);
        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json();
          if (settingsData && settingsData.length > 0) {
            const settings = settingsData[0];
            setSettingsId(settings.id);
            form.reset({
              displayName: settings.display_name || '',
              organizationLogoUrl: settings.organization_logo_url || '',
              defaultCurrency: settings.default_currency || 'USD',
              stripeAccountId: settings.stripe_account_id || '',
              hederaAccountId: settings.hedera_account_id || '',
              wiseProfileId: settings.wise_profile_id || '',
              wiseEnabled: settings.wise_enabled || false,
              wiseCurrency: settings.wise_currency || '',
            });
            
            // Set logo preview if URL exists
            if (settings.organization_logo_url) {
              setLogoPreview(settings.organization_logo_url);
            }
            
            // Update global Wise feature flag from API response
            if (settings._features?.wiseGloballyEnabled !== undefined) {
              setWiseGloballyEnabled(settings._features.wiseGloballyEnabled);
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

    if (!isOrgLoading) {
      fetchSettings();
    }
  }, [organizationId, isOrgLoading, form]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file) {
      return;
    }

    if (!organizationId) {
      toast.error('Organization not found. Please refresh the page and try again.');
      console.error('Organization ID is missing');
      return;
    }

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload PNG, JPG, or WEBP');
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 2MB');
      return;
    }

    setIsUploadingLogo(true);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('logo', file);
      formData.append('organizationId', organizationId);

      console.log('Uploading logo...', { 
        fileName: file.name, 
        fileSize: file.size, 
        fileType: file.type,
        organizationId 
      });

      // Upload file
      const response = await fetch('/api/merchant-settings/upload-logo', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Upload failed:', error);
        throw new Error(error.error || 'Failed to upload logo');
      }

      const result = await response.json();
      console.log('Upload successful:', result);

      // Update form with new URL
      form.setValue('organizationLogoUrl', result.url);
      setLogoPreview(result.url);

      toast.success('Logo uploaded successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload logo');
      console.error('Logo upload error:', error);
    } finally {
      setIsUploadingLogo(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = () => {
    form.setValue('organizationLogoUrl', '');
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
            organizationLogoUrl: data.organizationLogoUrl || undefined,
            defaultCurrency: data.defaultCurrency,
            stripeAccountId: data.stripeAccountId || undefined,
            hederaAccountId: data.hederaAccountId || undefined,
            wiseProfileId: data.wiseProfileId || undefined,
            wiseEnabled: data.wiseEnabled,
            wiseCurrency: data.wiseCurrency || undefined,
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
            organizationLogoUrl: data.organizationLogoUrl || undefined,
            defaultCurrency: data.defaultCurrency,
            stripeAccountId: data.stripeAccountId || undefined,
            hederaAccountId: data.hederaAccountId || undefined,
            wiseProfileId: data.wiseProfileId || undefined,
            wiseEnabled: data.wiseEnabled,
            wiseCurrency: data.wiseCurrency || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create settings');
        }

        const result = await response.json();
        setSettingsId(result.id);
        toast.success('Merchant settings created successfully');
      }
    } catch (error) {
      toast.error('Failed to save merchant settings');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading || isOrgLoading) {
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
          name="organizationLogoUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization Logo (Optional)</FormLabel>
              <FormControl>
                <div className="space-y-4">
                  {/* Logo Preview */}
                  {logoPreview && (
                    <div className="relative inline-block">
                      <div className="border rounded-lg p-4 bg-gray-50">
                        {/* Use regular img tag for uploaded files to avoid Next.js Image optimization issues */}
                        <img
                          src={logoPreview}
                          alt="Organization logo"
                          className="max-h-24 w-auto object-contain"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                        onClick={handleRemoveLogo}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* File Upload */}
                  <div className="flex items-center gap-4">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleFileSelect}
                      disabled={isUploadingLogo}
                      className="hidden"
                      id="logo-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingLogo}
                    >
                      {isUploadingLogo ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Logo
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Hidden input to maintain form state */}
                  <Input
                    type="hidden"
                    {...field}
                    value={field.value || ''}
                  />
                </div>
              </FormControl>
              <FormDescription>
                Upload your organization logo (PNG, JPG, or WEBP, max 2MB). This will appear on invoices and payment pages.
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

        {/* Wise (Bank Transfer) Section */}
        <div className="border-t pt-6 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-emerald-600" />
            <h3 className="text-lg font-semibold">Wise (Bank Transfer)</h3>
          </div>

          {!wiseGloballyEnabled ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Wise payments are not enabled on this environment. Contact your administrator to enable Wise.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="wiseEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Wise Payments</FormLabel>
                      <FormDescription>
                        Allow customers to pay via bank transfer using Wise.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="wiseProfileId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wise Profile ID</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="84420198" 
                        {...field} 
                        disabled={!form.watch('wiseEnabled')}
                      />
                    </FormControl>
                    <FormDescription>
                      Your Wise Business profile ID (numeric).{' '}
                      <a 
                        href="https://api-docs.wise.com/api-reference/profile" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-emerald-600 hover:underline inline-flex items-center gap-1"
                      >
                        Find via Wise API: GET /v2/profiles (id field)
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="wiseCurrency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wise Currency</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === '__default__' ? '' : value)} 
                      value={field.value || '__default__'} 
                      disabled={!form.watch('wiseEnabled')}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency (defaults to merchant currency)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__default__">Use default currency</SelectItem>
                        {currencies.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {currency.code} - {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Currency for Wise bank details. Defaults to your merchant default currency.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch('wiseEnabled') && !form.watch('wiseProfileId') && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Wise is enabled but no Profile ID is set. Wise will not appear as a payment option until you add your Profile ID.
                  </AlertDescription>
                </Alert>
              )}

              {form.watch('wiseEnabled') && form.watch('wiseProfileId') && (
                <Alert className="border-emerald-200 bg-emerald-50">
                  <Building2 className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-emerald-800">
                    Wise is configured and will appear as a payment option on your invoices.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

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













