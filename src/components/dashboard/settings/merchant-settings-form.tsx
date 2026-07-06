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
import { Loader2, Upload, X, Building2, AlertCircle, Info, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { MaskedCredentialInput } from '@/components/dashboard/settings/masked-credential-input';
import {
  isStripeTestAccountId,
  maskHederaAccountId,
  maskStripeAccountId,
  maskWiseProfileId,
  maskEvmWalletAddress,
} from '@/lib/settings/mask-credential';

import { WORKSPACE_CURRENCIES, DEFAULT_WORKSPACE_CURRENCY } from '@/lib/currency/workspace-currencies';
import { notifyWorkspaceActivationRefresh } from '@/hooks/use-workspace-activation';
import { Checkbox } from '@/components/ui/checkbox';
import {
  EVM_RAIL_DEFAULT_NETWORKS,
  EVM_RAIL_DEFAULT_TOKENS,
  evmNetworkDisplayName,
  getPaymentRail,
} from '@/lib/payments/payment-rail-registry';

const evmRail = getPaymentRail('evm_wallet');

const merchantSettingsSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(255),
  organizationLogoUrl: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (value) =>
        !value ||
        value.startsWith('/uploads/logos/') ||
        value.startsWith('merchant-logos/') ||
        /^https?:\/\//i.test(value),
      'Must be a valid URL or uploaded logo path'
    ),
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
  evmWalletEnabled: z.boolean().optional(),
  evmWalletAddress: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((val) => !val || /^0x[a-fA-F0-9]{40}$/.test(val.trim()), {
      message: 'EVM wallet address must be a valid 0x address (42 characters)',
    }),
  evmSupportedNetworks: z.array(z.string()).optional(),
  evmSupportedTokens: z.array(z.string()).optional(),
});

const pilotMerchantSettingsSchema = z.object({
  stripeAccountId: z.string().trim().min(1, 'Stripe account ID is required'),
  wiseProfileId: z.string().trim().min(1, 'Wise details are required'),
  hederaAccountId: z
    .string()
    .trim()
    .min(1, 'HashPack wallet is required')
    .refine((val) => (!val.startsWith('0.0.') ? true : /^0\.0\.\d+$/.test(val)), {
      message: 'If using Hedera format, use 0.0.x',
    }),
});

type MerchantSettingsFormValues = z.infer<typeof merchantSettingsSchema> & {
  stripeAccountId: string;
  wiseProfileId: string;
  hederaAccountId: string;
};

interface MerchantSettingsFormProps {
  variant?: 'full' | 'pilot';
}

export function MerchantSettingsForm({ variant = 'full' }: MerchantSettingsFormProps) {
  const isPilotVariant = variant === 'pilot';
  const { organizationId, isLoading: isOrgLoading } = useOrganization();
  const [isLoading, setIsLoading] = React.useState(true);
  const [settingsId, setSettingsId] = React.useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = React.useState(false);
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
  const [logoPreviewError, setLogoPreviewError] = React.useState(false);
  const [wiseGloballyEnabled, setWiseGloballyEnabled] = React.useState(true); // Default to true, will be updated from API
  const [evmGloballyEnabled, setEvmGloballyEnabled] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<MerchantSettingsFormValues>({
    resolver: zodResolver(isPilotVariant ? pilotMerchantSettingsSchema : merchantSettingsSchema),
    defaultValues: {
      displayName: '',
      organizationLogoUrl: '',
      defaultCurrency: DEFAULT_WORKSPACE_CURRENCY,
      stripeAccountId: '',
      hederaAccountId: '',
      wiseProfileId: '',
      wiseEnabled: false,
      wiseCurrency: '',
      evmWalletEnabled: false,
      evmWalletAddress: '',
      evmSupportedNetworks: [...EVM_RAIL_DEFAULT_NETWORKS],
      evmSupportedTokens: [...EVM_RAIL_DEFAULT_TOKENS],
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
              defaultCurrency: settings.default_currency || DEFAULT_WORKSPACE_CURRENCY,
              stripeAccountId: settings.stripe_account_id || '',
              hederaAccountId: settings.hedera_account_id || '',
              wiseProfileId: settings.wise_profile_id || '',
              wiseEnabled: settings.wise_enabled || false,
              wiseCurrency: settings.wise_currency || '',
              evmWalletEnabled: settings.evm_wallet_enabled || false,
              evmWalletAddress: settings.evm_wallet_address || '',
              evmSupportedNetworks:
                settings.evm_supported_networks?.length > 0
                  ? settings.evm_supported_networks
                  : [...EVM_RAIL_DEFAULT_NETWORKS],
              evmSupportedTokens:
                settings.evm_supported_tokens?.length > 0
                  ? settings.evm_supported_tokens
                  : [...EVM_RAIL_DEFAULT_TOKENS],
            });
            
            // Set logo preview if URL exists
            if (settings.organization_logo_url) {
              setLogoPreview(settings.organization_logo_url);
              setLogoPreviewError(false);
            }
            
            // Update global Wise feature flag from API response
            if (settings._features?.wiseGloballyEnabled !== undefined) {
              setWiseGloballyEnabled(settings._features.wiseGloballyEnabled);
            }
            if (settings._features?.evmGloballyEnabled !== undefined) {
              setEvmGloballyEnabled(settings._features.evmGloballyEnabled);
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
      setLogoPreviewError(false);

      toast.success('Logo uploaded successfully');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to upload logo';
      toast.error(message);
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
    setLogoPreviewError(false);
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
      const evmWalletEnabled = data.evmWalletEnabled === true;
      const evmWalletAddress =
        evmWalletEnabled && data.evmWalletAddress?.trim()
          ? data.evmWalletAddress.trim()
          : null;
      const evmSupportedNetworks = evmWalletEnabled
        ? data.evmSupportedNetworks ?? [...EVM_RAIL_DEFAULT_NETWORKS]
        : [...EVM_RAIL_DEFAULT_NETWORKS];
      const evmSupportedTokens = evmWalletEnabled
        ? data.evmSupportedTokens ?? [...EVM_RAIL_DEFAULT_TOKENS]
        : [...EVM_RAIL_DEFAULT_TOKENS];

      if (settingsId) {
        // Update existing settings
        const updatePayload = isPilotVariant
          ? {
              stripeAccountId: data.stripeAccountId || undefined,
              wiseProfileId: data.wiseProfileId || undefined,
              hederaAccountId: data.hederaAccountId || undefined,
            }
          : {
              displayName: data.displayName,
              organizationLogoUrl: data.organizationLogoUrl || undefined,
              defaultCurrency: data.defaultCurrency,
              stripeAccountId: data.stripeAccountId || undefined,
              hederaAccountId: data.hederaAccountId || undefined,
              wiseProfileId: data.wiseProfileId || undefined,
              wiseEnabled: data.wiseEnabled,
              wiseCurrency: data.wiseCurrency || undefined,
              evmWalletEnabled,
              evmWalletAddress,
              evmSupportedNetworks,
              evmSupportedTokens,
            };
        const response = await fetch(`/api/merchant-settings/${settingsId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload),
        });

        if (!response.ok) {
          throw new Error('Failed to update settings');
        }

        toast.success(isPilotVariant ? 'Settings saved' : 'Collection settings saved');
        notifyWorkspaceActivationRefresh();
      } else {
        // Create new settings
        const createPayload = isPilotVariant
          ? {
              organizationId,
              displayName: 'Rabbit Hole Merchant',
              defaultCurrency: DEFAULT_WORKSPACE_CURRENCY,
              stripeAccountId: data.stripeAccountId || undefined,
              wiseProfileId: data.wiseProfileId || undefined,
              hederaAccountId: data.hederaAccountId || undefined,
              wiseEnabled: true,
            }
          : {
              organizationId,
              displayName: data.displayName,
              organizationLogoUrl: data.organizationLogoUrl || undefined,
              defaultCurrency: data.defaultCurrency,
              stripeAccountId: data.stripeAccountId || undefined,
              hederaAccountId: data.hederaAccountId || undefined,
              wiseProfileId: data.wiseProfileId || undefined,
              wiseEnabled: data.wiseEnabled,
              wiseCurrency: data.wiseCurrency || undefined,
              evmWalletEnabled,
              evmWalletAddress,
              evmSupportedNetworks,
              evmSupportedTokens,
            };
        const response = await fetch('/api/merchant-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createPayload),
        });

        if (!response.ok) {
          throw new Error('Failed to create settings');
        }

        const json = (await response.json()) as {
          settings?: { id?: string };
          id?: string;
          operationalOnboarding?: unknown;
        };
        const settings = json.settings ?? json;
        if (settings?.id) {
          setSettingsId(settings.id);
        }
        toast.success(isPilotVariant ? 'Settings saved' : 'Collection settings saved');
        notifyWorkspaceActivationRefresh();
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

  if (isPilotVariant) {
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                  Enter the Stripe account ID used for invoice payment collection.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="wiseProfileId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Wise Details</FormLabel>
                <FormControl>
                  <Input placeholder="Wise profile ID or account details" {...field} />
                </FormControl>
                <FormDescription>
                  Flexible text field for Wise payout and receiving details in this pilot.
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
                <FormLabel>HashPack Wallet</FormLabel>
                <FormControl>
                  <Input placeholder="0.0.12345 or wallet address" {...field} />
                </FormControl>
                <FormDescription>
                  Enter the HashPack wallet address. If using Hedera format, use 0.0.x.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end">
            <Button type="submit" disabled={form.formState.isSubmitting || isLoading}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save settings
            </Button>
          </div>
        </form>
      </Form>
    );
  }

  const stripeAccountId = form.watch('stripeAccountId');
  const stripeTestMode = isStripeTestAccountId(stripeAccountId);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold">Branding</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Configure how your organization appears across payment pages and operational
              workflows.
            </p>
          </div>

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
                  {logoPreview && !logoPreviewError && (
                    <div className="relative inline-block">
                      <div className="border rounded-lg p-4 bg-gray-50">
                        {/* Use regular img tag for uploaded files to avoid Next.js Image optimization issues */}
                        <img
                          src={logoPreview}
                          alt="Organization logo"
                          className="max-h-24 w-auto object-contain"
                          onError={() => {
                            console.warn('[MerchantBranding]', {
                              context: 'merchant-settings-form.preview',
                              logoUrl: logoPreview,
                              reason: 'image_load_failed',
                            });
                            setLogoPreviewError(true);
                          }}
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

                  {logoPreview && logoPreviewError ? (
                    <p className="text-sm text-muted-foreground">
                      Logo preview unavailable. Re-upload or save a valid logo file.
                    </p>
                  ) : null}
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
                  {WORKSPACE_CURRENCIES.map((currency) => (
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
        </div>

        <div className="space-y-6 border-t pt-8">
          <div>
            <h3 className="text-lg font-semibold">Payment provider</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Configure the financial accounts used to collect and settle payments.
            </p>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Changes to payment rail configuration can affect live payment processing.
            </AlertDescription>
          </Alert>

        <FormField
          control={form.control}
          name="stripeAccountId"
          render={({ field }) => (
            <FormItem>
              <div className="flex flex-wrap items-center gap-2">
                <FormLabel>Stripe account ID</FormLabel>
                {stripeTestMode ? (
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 bg-amber-50 text-amber-900 text-xs font-normal"
                  >
                    Test mode
                  </Badge>
                ) : null}
              </div>
              <FormControl>
                <MaskedCredentialInput
                  id="stripe-account-id"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  mask={maskStripeAccountId}
                  placeholder="acct_xxxxxxxxxxxxx"
                />
              </FormControl>
              <FormDescription>
                Your Stripe Connect account ID (starts with acct_).
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
              <FormLabel>Hedera account ID</FormLabel>
              <FormControl>
                <MaskedCredentialInput
                  id="hedera-account-id"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  mask={maskHederaAccountId}
                  placeholder="0.0.12345"
                />
              </FormControl>
              <FormDescription>
                Your Hedera account ID in the format 0.0.xxxxx.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-medium">{evmRail.merchantSettingsLabel}</h4>
          </div>

          {!evmGloballyEnabled ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                EVM Wallet payments are not enabled on this environment. Contact your administrator to
                enable EVM wallet payments.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="evmWalletEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable EVM Wallet payments</FormLabel>
                      <FormDescription>
                        Accept automated USDC and USDT payments on supported EVM networks.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="evmWalletAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Merchant receive wallet address</FormLabel>
                    <FormControl>
                      <MaskedCredentialInput
                        id="evm-wallet-address"
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        mask={maskEvmWalletAddress}
                        placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
                        disabled={!form.watch('evmWalletEnabled')}
                      />
                    </FormControl>
                    <FormDescription>
                      Your EVM receive address (0x + 40 hex characters). Customer payments settle to
                      this wallet.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="evmSupportedNetworks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supported networks</FormLabel>
                    <div className="space-y-2 rounded-lg border p-4">
                      {EVM_RAIL_DEFAULT_NETWORKS.map((networkId) => {
                        const checked = (field.value ?? []).includes(networkId);
                        return (
                          <label
                            key={networkId}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              disabled={!form.watch('evmWalletEnabled')}
                              onCheckedChange={(value) => {
                                const next = new Set(field.value ?? []);
                                if (value) next.add(networkId);
                                else next.delete(networkId);
                                field.onChange([...next]);
                              }}
                            />
                            {evmNetworkDisplayName(networkId)}
                          </label>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="evmSupportedTokens"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supported tokens</FormLabel>
                    <div className="space-y-2 rounded-lg border p-4">
                      {EVM_RAIL_DEFAULT_TOKENS.map((token) => {
                        const checked = (field.value ?? []).includes(token);
                        return (
                          <label key={token} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={checked}
                              disabled={!form.watch('evmWalletEnabled')}
                              onCheckedChange={(value) => {
                                const next = new Set(field.value ?? []);
                                if (value) next.add(token);
                                else next.delete(token);
                                field.onChange([...next]);
                              }}
                            />
                            {token}
                          </label>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch('evmWalletEnabled') && !form.watch('evmWalletAddress')?.trim() && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    EVM Wallet is enabled but no receive wallet is set. The rail will not appear on
                    invoices until you add your wallet address.
                  </AlertDescription>
                </Alert>
              )}

              {form.watch('evmWalletEnabled') && form.watch('evmWalletAddress')?.trim() && (
                <Alert className="border-violet-200 bg-violet-50">
                  <Info className="h-4 w-4 text-violet-600" />
                  <AlertDescription className="text-violet-900">
                    EVM Wallet is configured and will appear as a payment option on your invoices.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-600" />
            <h4 className="text-base font-medium">Wise (bank transfer)</h4>
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
                        {WORKSPACE_CURRENCIES.map((currency) => (
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
        </div>

        <div className="flex justify-end border-t pt-6">
          <Button type="submit" disabled={form.formState.isSubmitting || isLoading}>
            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </form>
    </Form>
  );
}













