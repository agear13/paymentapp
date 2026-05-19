/**
 * Canonical merchant logo/branding resolution for customer-facing surfaces.
 */

import { resolveAssetUrl } from '@/lib/storage/resolve-asset-url';
import { logOperationalError } from '@/lib/operational/log-operational-error';
import {
  resolveCustomerFacingOrigin,
  type CustomerFacingUrlOptions,
} from '@/lib/runtime/customer-facing-url';

export type MerchantBrandingFallbackReason =
  | 'none'
  | 'missing_logo'
  | 'invalid_source'
  | 'unresolvable_origin'
  | 'malformed_url';

export type MerchantBrandingResolvedFrom =
  | 'absolute'
  | 'protocol_relative'
  | 'relative'
  | 'none';

export type MerchantBrandingResolution = {
  merchantName: string;
  logoUrl: string | null;
  initials: string;
  usedFallback: boolean;
  fallbackReason: MerchantBrandingFallbackReason;
  resolvedFrom: MerchantBrandingResolvedFrom;
  sourceLogoPath: string | null;
};

export type ResolveMerchantBrandingInput = {
  merchantName: string;
  logoSource?: string | null;
  context?: string;
} & Pick<CustomerFacingUrlOptions, 'requestOrigin' | 'runtimeOrigin' | 'infrastructureOverride'>;

export function merchantInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function logMerchantBrandingResolution(
  context: string,
  resolution: MerchantBrandingResolution,
  candidate?: string | null
): void {
  const payload = {
    context,
    source: candidate ?? resolution.sourceLogoPath,
    resolvedUrl: resolution.logoUrl,
    resolvedFrom: resolution.resolvedFrom,
    usedFallback: resolution.usedFallback,
    fallbackReason: resolution.fallbackReason,
  };

  if (resolution.logoUrl && !resolution.usedFallback) {
    console.info('[MerchantBranding]', payload);
    return;
  }

  if (resolution.fallbackReason === 'missing_logo') {
    return;
  }

  console.warn('[MerchantBranding]', payload);
  if (process.env.NODE_ENV === 'production' && resolution.fallbackReason === 'unresolvable_origin') {
    logOperationalError(new Error('Merchant logo origin could not be resolved'), {
      component: context,
      route: candidate ?? undefined,
    });
  }
}

function buildFallback(
  merchantName: string,
  sourceLogoPath: string | null,
  fallbackReason: MerchantBrandingFallbackReason,
  context?: string
): MerchantBrandingResolution {
  const resolution: MerchantBrandingResolution = {
    merchantName,
    logoUrl: null,
    initials: merchantInitials(merchantName),
    usedFallback: true,
    fallbackReason,
    resolvedFrom: 'none',
    sourceLogoPath,
  };
  logMerchantBrandingResolution(context ?? 'resolveMerchantBranding', resolution, sourceLogoPath);
  return resolution;
}

function resolveCanonicalOrigin(
  options: Pick<
    CustomerFacingUrlOptions,
    'requestOrigin' | 'runtimeOrigin' | 'infrastructureOverride'
  >
): string | null {
  const resolution = resolveCustomerFacingOrigin(options);
  return resolution.configured ? resolution.origin : null;
}

/**
 * Resolve operator logo URL and fallback metadata for customer-facing rendering.
 */
export function resolveMerchantBranding(
  input: ResolveMerchantBrandingInput
): MerchantBrandingResolution {
  const context = input.context ?? 'resolveMerchantBranding';
  const merchantName = input.merchantName?.trim() || 'Merchant';
  const source = input.logoSource?.trim() || null;

  if (!source) {
    return buildFallback(merchantName, null, 'missing_logo', context);
  }

  if (/^https?:\/\//i.test(source)) {
    try {
      const parsed = new URL(source);
      if (!parsed.hostname) {
        return buildFallback(merchantName, source, 'malformed_url', context);
      }
      const resolution: MerchantBrandingResolution = {
        merchantName,
        logoUrl: parsed.toString(),
        initials: merchantInitials(merchantName),
        usedFallback: false,
        fallbackReason: 'none',
        resolvedFrom: 'absolute',
        sourceLogoPath: source,
      };
      logMerchantBrandingResolution(context, resolution, source);
      return resolution;
    } catch {
      return buildFallback(merchantName, source, 'malformed_url', context);
    }
  }

  if (source.startsWith('//')) {
    try {
      const absolute = `https:${source}`;
      const parsed = new URL(absolute);
      const resolution: MerchantBrandingResolution = {
        merchantName,
        logoUrl: parsed.toString(),
        initials: merchantInitials(merchantName),
        usedFallback: false,
        fallbackReason: 'none',
        resolvedFrom: 'protocol_relative',
        sourceLogoPath: source,
      };
      logMerchantBrandingResolution(context, resolution, source);
      return resolution;
    } catch {
      return buildFallback(merchantName, source, 'malformed_url', context);
    }
  }

  const assetResolution = resolveAssetUrl({
    source,
    category: 'merchant-logos',
    visibility: 'public',
    requestOrigin: input.requestOrigin,
    runtimeOrigin: input.runtimeOrigin,
    infrastructureOverride: input.infrastructureOverride,
  });

  if (assetResolution.url) {
    const resolvedFrom =
      assetResolution.resolvedFrom === 'legacy_relative' ? 'relative' : 'absolute';
    const resolution: MerchantBrandingResolution = {
      merchantName,
      logoUrl: assetResolution.url,
      initials: merchantInitials(merchantName),
      usedFallback: false,
      fallbackReason: 'none',
      resolvedFrom,
      sourceLogoPath: source,
    };
    logMerchantBrandingResolution(context, resolution, source);
    return resolution;
  }

  const relativePath = source.startsWith('/') ? source : `/${source}`;
  const origin = resolveCanonicalOrigin({
    requestOrigin: input.requestOrigin,
    runtimeOrigin: input.runtimeOrigin,
    infrastructureOverride: input.infrastructureOverride,
  });

  if (!origin) {
    return buildFallback(merchantName, source, 'unresolvable_origin', context);
  }

  const logoUrl = `${origin.replace(/\/+$/, '')}${relativePath}`;
  const resolution: MerchantBrandingResolution = {
    merchantName,
    logoUrl,
    initials: merchantInitials(merchantName),
    usedFallback: false,
    fallbackReason: 'none',
    resolvedFrom: 'relative',
    sourceLogoPath: source,
  };
  logMerchantBrandingResolution(context, resolution, source);
  return resolution;
}

/**
 * @deprecated Use resolveMerchantBranding().logoUrl
 */
export function resolveMerchantLogoUrl(
  logoUrl: string | null | undefined,
  origin: string
): string | null {
  return resolveMerchantBranding({
    merchantName: 'Merchant',
    logoSource: logoUrl,
    requestOrigin: origin,
    context: 'resolveMerchantLogoUrl',
  }).logoUrl;
}
