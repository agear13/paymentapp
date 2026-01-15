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
import { Loader2, Upload, X } from 'lucide-react';

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
});

type MerchantSettingsFormValues = z.infer<typeof merchantSettingsSchema>;

export function MerchantSettingsForm() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [settingsId, setSettingsId] = React.useState<string | null>(null);
  const [organizationId, setOrganizationId] = React.useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = React.useState(false);
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<MerchantSettingsFormValues>({
    resolver: zodResolver(merchantSettingsSchema),
    defaultValues: {
      displayName: '',
      organizationLogoUrl: '',
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
                  organizationLogoUrl: settings.organization_logo_url || '',
                  defaultCurrency: settings.default_currency || 'USD',
                  stripeAccountId: settings.stripe_account_id || '',
                  hederaAccountId: settings.hedera_account_id || '',
                });
                
                // Set logo preview if URL exists
                if (settings.organization_logo_url) {
                  setLogoPreview(settings.organization_logo_url);
                }
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













