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
import {
  buildMerchantSettingsCreatePayload,
  buildMerchantSettingsUpdatePayload,
  commercialOsSaveButtonLabel,
  deriveStripeSetupDisplayStatus,
  formValuesFromPersistedSnapshot,
  merchantSettingsSchemaForSections,
  parseMerchantSettingsSaveError,
  snapshotFromMerchantSettingsRow,
  type MerchantSettingsSaveValues,
  type PersistedMerchantSettingsSnapshot,
} from '@/lib/settings/merchant-settings-section-save';
import { StripeConnectSetupStatusBadge } from '@/components/journey/lovable/payments-settlement-ui';

import { WORKSPACE_CURRENCIES, DEFAULT_WORKSPACE_CURRENCY } from '@/lib/currency/workspace-currencies';
import { notifyWorkspaceActivationRefresh } from '@/hooks/use-workspace-activation';
import { Checkbox } from '@/components/ui/checkbox';
import {
  EVM_RAIL_DEFAULT_NETWORKS,
  EVM_RAIL_DEFAULT_TOKENS,
  evmNetworkDisplayName,
  getPaymentRail,
} from '@/lib/payments/payment-rail-registry';
import {
  MANUAL_BANK_RECOMMENDED_HELPER,
  WISE_MERCHANT_PROFILE_SAVED_COPY,
} from '@/lib/payments/wise-bank-transfer-ux';

const evmRail = getPaymentRail('evm_wallet');

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

type MerchantSettingsFormValues = MerchantSettingsSaveValues;

interface MerchantSettingsFormProps {
  variant?: 'full' | 'pilot';
  /** When set, only render these sections (Commercial OS payments page). */
  sections?: Array<'branding' | 'providers'>;
  /** Visual presentation — commercial-os uses tighter Lovable journey styling. */
  presentation?: 'dashboard' | 'commercial-os';
  /** Hide the form-level save button (parent provides section save). */
  hideSubmit?: boolean;
  onSaved?: () => void;
}

export function MerchantSettingsForm({
  variant = 'full',
  sections,
  presentation = 'dashboard',
  hideSubmit = false,
  onSaved,
}: MerchantSettingsFormProps) {
  const isPilotVariant = variant === 'pilot';
  const isCommercialOs = presentation === 'commercial-os';
  const showBranding = !sections || sections.includes('branding');
  const showProviders = !sections || sections.includes('providers');
  const sectionSpacing = isCommercialOs ? 'space-y-5' : 'space-y-6';
  const { organizationId, organization, isLoading: isOrgLoading } = useOrganization();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [settingsId, setSettingsId] = React.useState<string | null>(null);
  const [persistedSnapshot, setPersistedSnapshot] =
    React.useState<PersistedMerchantSettingsSnapshot | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = React.useState(false);
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
  const [logoPreviewError, setLogoPreviewError] = React.useState(false);
  const [wiseGloballyEnabled, setWiseGloballyEnabled] = React.useState(true); // Default to true, will be updated from API
  const [wiseAutoSettlementAvailable, setWiseAutoSettlementAvailable] = React.useState(false);
  const [evmGloballyEnabled, setEvmGloballyEnabled] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const activeSchema = React.useMemo(
    () => (isPilotVariant ? pilotMerchantSettingsSchema : merchantSettingsSchemaForSections(sections)),
    [isPilotVariant, sections]
  );

  const form = useForm<MerchantSettingsFormValues>({
    resolver: zodResolver(activeSchema),
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

  const applySettingsRow = React.useCallback(
    (settings: Record<string, unknown>) => {
      const snapshot = snapshotFromMerchantSettingsRow(settings);
      setSettingsId((settings.id as string) ?? null);
      setPersistedSnapshot(snapshot);
      form.reset(formValuesFromPersistedSnapshot(snapshot));

      if (settings.organization_logo_url) {
        setLogoPreview(settings.organization_logo_url as string);
        setLogoPreviewError(false);
      }

      if (settings._features && typeof settings._features === 'object') {
        const features = settings._features as {
          wiseGloballyEnabled?: boolean;
          wiseAutoSettlementAvailable?: boolean;
          evmGloballyEnabled?: boolean;
        };
        if (features.wiseGloballyEnabled !== undefined) {
          setWiseGloballyEnabled(features.wiseGloballyEnabled);
        }
        if (features.wiseAutoSettlementAvailable !== undefined) {
          setWiseAutoSettlementAvailable(features.wiseAutoSettlementAvailable);
        }
        if (features.evmGloballyEnabled !== undefined) {
          setEvmGloballyEnabled(features.evmGloballyEnabled);
        }
      }
    },
    [form]
  );

  const reloadSettings = React.useCallback(async (): Promise<boolean> => {
    if (!organizationId) return false;

    const settingsResponse = await fetch(
      `/api/merchant-settings?organizationId=${organizationId}`,
      { cache: 'no-store' }
    );

    if (!settingsResponse.ok) {
      return false;
    }

    const settingsData = (await settingsResponse.json()) as Record<string, unknown>[];
    if (settingsData?.length > 0) {
      applySettingsRow(settingsData[0]);
    }
    return true;
  }, [organizationId, applySettingsRow]);

  const reloadSettingsRef = React.useRef(reloadSettings);
  reloadSettingsRef.current = reloadSettings;

  // Fetch existing settings when organizationId is available
  React.useEffect(() => {
    async function fetchSettings() {
      if (!organizationId) {
        setIsLoading(false);
        return;
      }

      try {
        await reloadSettingsRef.current();
      } catch (error) {
        console.error('Failed to fetch settings:', error);
        toast.error('Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    }

    if (!isOrgLoading) {
      void fetchSettings();
    } else {
      setIsLoading(true);
    }
  }, [organizationId, isOrgLoading]);

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

    setSaveError(null);
    setIsSaving(true);
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

      const evmOptions = {
        evmWalletEnabled,
        evmWalletAddress,
        evmSupportedNetworks,
        evmSupportedTokens,
      };

      if (settingsId) {
        const updatePayload = buildMerchantSettingsUpdatePayload(sections, data, {
          isPilotVariant,
          ...evmOptions,
        });
        const response = await fetch(`/api/merchant-settings/${settingsId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload),
        });

        if (!response.ok) {
          const message = await parseMerchantSettingsSaveError(response);
          throw new Error(message);
        }

        const reloaded = await reloadSettings();
        if (!reloaded) {
          throw new Error('Settings saved but could not refresh saved status. Please reload the page.');
        }

        toast.success(
          isPilotVariant
            ? 'Settings saved'
            : isCommercialOs
              ? showProviders && !showBranding
                ? 'Payment providers saved'
                : showBranding && !showProviders
                  ? 'Branding saved'
                  : 'Collection settings saved'
              : 'Collection settings saved'
        );
        notifyWorkspaceActivationRefresh();
        onSaved?.();
      } else {
        const createPayload = buildMerchantSettingsCreatePayload(sections, data, organizationId, {
          isPilotVariant,
          organizationDisplayName: organization?.name,
          ...evmOptions,
        });
        const response = await fetch('/api/merchant-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createPayload),
        });

        if (!response.ok) {
          const message = await parseMerchantSettingsSaveError(response);
          throw new Error(message);
        }

        const json = (await response.json()) as {
          settings?: { id?: string };
          id?: string;
        };
        const settings = json.settings ?? json;
        if (settings?.id) {
          setSettingsId(settings.id);
        }

        const reloaded = await reloadSettings();
        if (!reloaded) {
          throw new Error('Settings saved but could not refresh saved status. Please reload the page.');
        }

        toast.success(
          isPilotVariant
            ? 'Settings saved'
            : isCommercialOs
              ? showProviders && !showBranding
                ? 'Payment providers saved'
                : showBranding && !showProviders
                  ? 'Branding saved'
                  : 'Collection settings saved'
              : 'Collection settings saved'
        );
        notifyWorkspaceActivationRefresh();
        onSaved?.();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save merchant settings';
      setSaveError(message);
      toast.error(message);
      console.error(error);
    } finally {
      setIsSaving(false);
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
  const stripeSetupStatus = deriveStripeSetupDisplayStatus(
    stripeAccountId,
    persistedSnapshot?.stripeAccountId
  );
  const saveButtonLabel = isCommercialOs
    ? commercialOsSaveButtonLabel(sections)
    : 'Save changes';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={isCommercialOs ? 'space-y-5' : 'space-y-10'}>
        {showBranding ? (
        <div className={`${sectionSpacing} ${showProviders && !isCommercialOs ? '' : ''}`}>
          {!isCommercialOs ? (
          <div>
            <h3 className="text-lg font-semibold">Branding</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Configure how your organization appears across payment pages and operational
              workflows.
            </p>
          </div>
          ) : (
          <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-[12.5px] text-ink-soft">
            Update how your organization appears on invoices and payment pages. Changes here do
            not affect payment provider account IDs — use{' '}
            <span className="font-medium text-foreground">Save branding</span> below when you are
            done.
          </div>
          )}

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
        ) : null}

        {showProviders ? (
        <div className={`${sectionSpacing} ${!isCommercialOs ? 'border-t pt-8' : ''}`}>
          {!isCommercialOs ? (
          <div>
            <h3 className="text-lg font-semibold">Payment provider</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Configure the financial accounts used to collect and settle payments.
            </p>
          </div>
          ) : null}

          {!isCommercialOs ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Changes to payment rail configuration can affect live payment processing.
            </AlertDescription>
          </Alert>
          ) : (
          <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-[12.5px] text-ink-soft">
            Enter account IDs for each payment provider you want to accept. Provvy does not run an
            OAuth connection flow for these rails — paste the IDs from your provider dashboards,
            then click <span className="font-medium text-foreground">Save payment providers</span>{' '}
            below.
          </div>
          )}

        <FormField
          control={form.control}
          name="stripeAccountId"
          render={({ field }) => (
            <FormItem>
              <div className="flex flex-wrap items-center gap-2">
                <FormLabel>Stripe Connect account ID</FormLabel>
                {showProviders ? (
                  <StripeConnectSetupStatusBadge status={stripeSetupStatus} />
                ) : null}
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
                Paste your existing Stripe Connect account ID (starts with{' '}
                <span className="font-mono">acct_</span>). Find it in the Stripe Dashboard under
                Connect → Accounts. Saving stores this ID in your workspace settings — Provvy does
                not connect to Stripe automatically.
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
            <h4 className="text-base font-medium">Wise profile (automated checkout)</h4>
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
                      <FormLabel className="text-base">Save Wise profile</FormLabel>
                      <FormDescription>
                        Store your Wise Business profile for receiving-account lookups and future
                        automated checkout. For bank transfers today, use Bank transfer (manual
                        verification) on invoices.
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
                    Wise is toggled on but no Profile ID is set. Automated Wise checkout will not
                    be available until you add your Profile ID. Use Bank transfer (manual
                    verification) on invoices in the meantime.
                  </AlertDescription>
                </Alert>
              )}

              {form.watch('wiseEnabled') && form.watch('wiseProfileId') && !wiseAutoSettlementAvailable && (
                <Alert className="border-amber-200 bg-amber-50">
                  <Info className="h-4 w-4 text-amber-700" />
                  <AlertDescription className="text-amber-900 space-y-2">
                    <p>{WISE_MERCHANT_PROFILE_SAVED_COPY}</p>
                    <p className="text-sm">{MANUAL_BANK_RECOMMENDED_HELPER}</p>
                  </AlertDescription>
                </Alert>
              )}

              {form.watch('wiseEnabled') && form.watch('wiseProfileId') && wiseAutoSettlementAvailable && (
                <Alert className="border-emerald-200 bg-emerald-50">
                  <Building2 className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-emerald-800">
                    Wise profile saved. Automated Wise checkout can appear on invoices when you
                    select Wise bank transfer (automated checkout — pilot).
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>
        </div>
        ) : null}

        {!hideSubmit ? (
        <div className={`flex flex-col items-end gap-3 ${isCommercialOs ? '' : 'border-t pt-6'}`}>
          {saveError ? (
            <Alert variant="destructive" className="w-full">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          ) : null}
          <Button
            type="submit"
            disabled={form.formState.isSubmitting || isSaving || isLoading}
            className={isCommercialOs ? 'rounded-xl bg-gradient-purple text-primary-foreground shadow-glow hover:brightness-110' : undefined}
          >
            {(form.formState.isSubmitting || isSaving) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {saveButtonLabel}
          </Button>
        </div>
        ) : null}
      </form>
    </Form>
  );
}













