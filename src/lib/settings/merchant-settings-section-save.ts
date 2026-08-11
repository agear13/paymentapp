import { z } from 'zod';
import { DEFAULT_WORKSPACE_CURRENCY } from '@/lib/currency/workspace-currencies';
import {
  EVM_RAIL_DEFAULT_NETWORKS,
  EVM_RAIL_DEFAULT_TOKENS,
} from '@/lib/payments/payment-rail-registry';

export type MerchantSettingsSection = 'branding' | 'providers';

export type StripeSetupDisplayStatus = 'connected' | 'setup_required' | 'unsaved_changes';

export const merchantSettingsBrandingSchema = z.object({
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
});

export const merchantSettingsProvidersSchema = z.object({
  stripeAccountId: z
    .string()
    .optional()
    .refine((val) => !val || val.trim().startsWith('acct_'), {
      message: 'Stripe Connect account ID must start with "acct_"',
    }),
  hederaAccountId: z
    .string()
    .optional()
    .refine((val) => !val || /^0\.0\.\d+$/.test(val), {
      message: 'Hedera account ID must be in format 0.0.xxxxx',
    }),
  wiseProfileId: z
    .string()
    .optional()
    .refine((val) => !val || /^\d+$/.test(val), {
      message: 'Wise Profile ID must be a numeric ID',
    }),
  wiseEnabled: z.boolean().optional(),
  wiseCurrency: z
    .string()
    .length(3, 'Currency must be a 3-letter ISO code')
    .optional()
    .or(z.literal('')),
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

export type MerchantSettingsProvidersValues = z.infer<typeof merchantSettingsProvidersSchema>;
export type MerchantSettingsBrandingValues = z.infer<typeof merchantSettingsBrandingSchema>;

export type MerchantSettingsSaveValues = MerchantSettingsBrandingValues &
  MerchantSettingsProvidersValues;

export function merchantSettingsSchemaForSections(sections?: MerchantSettingsSection[]) {
  if (!sections || sections.length === 0) {
    return merchantSettingsBrandingSchema.merge(merchantSettingsProvidersSchema);
  }
  if (sections.includes('branding') && !sections.includes('providers')) {
    return merchantSettingsBrandingSchema;
  }
  if (sections.includes('providers') && !sections.includes('branding')) {
    return merchantSettingsProvidersSchema;
  }
  return merchantSettingsBrandingSchema.merge(merchantSettingsProvidersSchema);
}

export function resolveMerchantSettingsSections(sections?: MerchantSettingsSection[]): {
  branding: boolean;
  providers: boolean;
  full: boolean;
} {
  const full = !sections || sections.length === 0;
  return {
    full,
    branding: full || sections.includes('branding'),
    providers: full || sections.includes('providers'),
  };
}

export function normalizeStripeAccountId(value: string | null | undefined): string {
  return (value ?? '').trim();
}

export function isStripeAccountIdDirty(
  formValue: string | null | undefined,
  persistedValue: string | null | undefined
): boolean {
  return normalizeStripeAccountId(formValue) !== normalizeStripeAccountId(persistedValue);
}

export function deriveStripeSetupDisplayStatus(
  formValue: string | null | undefined,
  persistedValue: string | null | undefined
): StripeSetupDisplayStatus {
  if (isStripeAccountIdDirty(formValue, persistedValue)) {
    return 'unsaved_changes';
  }
  return normalizeStripeAccountId(persistedValue).length > 0 ? 'connected' : 'setup_required';
}

export function isStripePersistedConnected(persistedValue: string | null | undefined): boolean {
  return normalizeStripeAccountId(persistedValue).length > 0;
}

export function commercialOsSaveButtonLabel(sections?: MerchantSettingsSection[]): string {
  const scope = resolveMerchantSettingsSections(sections);
  if (scope.branding && !scope.providers) return 'Save branding';
  if (scope.providers && !scope.branding) return 'Save payment providers';
  return 'Save changes';
}

type EvmPayloadOptions = {
  evmWalletEnabled: boolean;
  evmWalletAddress: string | null;
  evmSupportedNetworks: string[];
  evmSupportedTokens: string[];
};

function providerFields(
  data: MerchantSettingsSaveValues,
  options: EvmPayloadOptions
): Record<string, unknown> {
  return {
    stripeAccountId: normalizeStripeAccountId(data.stripeAccountId) || undefined,
    hederaAccountId: data.hederaAccountId || undefined,
    wiseProfileId: data.wiseProfileId || undefined,
    wiseEnabled: data.wiseEnabled,
    wiseCurrency: data.wiseCurrency || undefined,
    evmWalletEnabled: options.evmWalletEnabled,
    evmWalletAddress: options.evmWalletAddress,
    evmSupportedNetworks: options.evmSupportedNetworks,
    evmSupportedTokens: options.evmSupportedTokens,
  };
}

export function buildMerchantSettingsUpdatePayload(
  sections: MerchantSettingsSection[] | undefined,
  data: MerchantSettingsSaveValues,
  options: EvmPayloadOptions & { isPilotVariant: boolean }
): Record<string, unknown> {
  if (options.isPilotVariant) {
    return {
      stripeAccountId: normalizeStripeAccountId(data.stripeAccountId) || undefined,
      wiseProfileId: data.wiseProfileId || undefined,
      hederaAccountId: data.hederaAccountId || undefined,
    };
  }

  const scope = resolveMerchantSettingsSections(sections);

  if (scope.providers && !scope.branding) {
    return providerFields(data, options);
  }

  if (scope.branding && !scope.providers) {
    return {
      displayName: data.displayName,
      organizationLogoUrl: data.organizationLogoUrl || undefined,
      defaultCurrency: data.defaultCurrency,
    };
  }

  return {
    displayName: data.displayName,
    organizationLogoUrl: data.organizationLogoUrl || undefined,
    defaultCurrency: data.defaultCurrency,
    ...providerFields(data, options),
  };
}

export function buildMerchantSettingsCreatePayload(
  sections: MerchantSettingsSection[] | undefined,
  data: MerchantSettingsSaveValues,
  organizationId: string,
  options: EvmPayloadOptions & {
    isPilotVariant: boolean;
    organizationDisplayName?: string | null;
  }
): Record<string, unknown> {
  if (options.isPilotVariant) {
    return {
      organizationId,
      displayName: 'Rabbit Hole Merchant',
      defaultCurrency: DEFAULT_WORKSPACE_CURRENCY,
      stripeAccountId: normalizeStripeAccountId(data.stripeAccountId) || undefined,
      wiseProfileId: data.wiseProfileId || undefined,
      hederaAccountId: data.hederaAccountId || undefined,
      wiseEnabled: true,
    };
  }

  const scope = resolveMerchantSettingsSections(sections);
  const fallbackDisplayName =
    data.displayName?.trim() ||
    options.organizationDisplayName?.trim() ||
    'My workspace';

  if (scope.providers && !scope.branding) {
    return {
      organizationId,
      displayName: fallbackDisplayName,
      defaultCurrency: data.defaultCurrency || DEFAULT_WORKSPACE_CURRENCY,
      ...providerFields(data, options),
    };
  }

  return {
    organizationId,
    displayName: data.displayName,
    organizationLogoUrl: data.organizationLogoUrl || undefined,
    defaultCurrency: data.defaultCurrency,
    ...providerFields(data, options),
  };
}

export async function parseMerchantSettingsSaveError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    return body.error || body.message || 'Failed to save merchant settings';
  } catch {
    return 'Failed to save merchant settings';
  }
}

export type PersistedMerchantSettingsSnapshot = {
  stripeAccountId: string;
  displayName: string;
  organizationLogoUrl: string;
  defaultCurrency: string;
  hederaAccountId: string;
  wiseProfileId: string;
  wiseEnabled: boolean;
  wiseCurrency: string;
  evmWalletEnabled: boolean;
  evmWalletAddress: string;
  evmSupportedNetworks: string[];
  evmSupportedTokens: string[];
};

export function snapshotFromMerchantSettingsRow(
  settings: Record<string, unknown>
): PersistedMerchantSettingsSnapshot {
  return {
    stripeAccountId: (settings.stripe_account_id as string | null) || '',
    displayName: (settings.display_name as string | null) || '',
    organizationLogoUrl: (settings.organization_logo_url as string | null) || '',
    defaultCurrency: (settings.default_currency as string | null) || DEFAULT_WORKSPACE_CURRENCY,
    hederaAccountId: (settings.hedera_account_id as string | null) || '',
    wiseProfileId: (settings.wise_profile_id as string | null) || '',
    wiseEnabled: Boolean(settings.wise_enabled),
    wiseCurrency: (settings.wise_currency as string | null) || '',
    evmWalletEnabled: Boolean(settings.evm_wallet_enabled),
    evmWalletAddress: (settings.evm_wallet_address as string | null) || '',
    evmSupportedNetworks: Array.isArray(settings.evm_supported_networks)
      ? (settings.evm_supported_networks as string[])
      : [],
    evmSupportedTokens: Array.isArray(settings.evm_supported_tokens)
      ? (settings.evm_supported_tokens as string[])
      : [],
  };
}

export function formValuesFromPersistedSnapshot(
  snapshot: PersistedMerchantSettingsSnapshot
): MerchantSettingsSaveValues {
  return {
    displayName: snapshot.displayName,
    organizationLogoUrl: snapshot.organizationLogoUrl,
    defaultCurrency: snapshot.defaultCurrency || DEFAULT_WORKSPACE_CURRENCY,
    stripeAccountId: snapshot.stripeAccountId,
    hederaAccountId: snapshot.hederaAccountId,
    wiseProfileId: snapshot.wiseProfileId,
    wiseEnabled: snapshot.wiseEnabled,
    wiseCurrency: snapshot.wiseCurrency,
    evmWalletEnabled: snapshot.evmWalletEnabled,
    evmWalletAddress: snapshot.evmWalletAddress,
    evmSupportedNetworks:
      snapshot.evmSupportedNetworks.length > 0
        ? snapshot.evmSupportedNetworks
        : [...EVM_RAIL_DEFAULT_NETWORKS],
    evmSupportedTokens:
      snapshot.evmSupportedTokens.length > 0
        ? snapshot.evmSupportedTokens
        : [...EVM_RAIL_DEFAULT_TOKENS],
  };
}
