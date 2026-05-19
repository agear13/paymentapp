/**
 * Canonical asset URL resolution — CDN, R2 public base, proxy routes, legacy paths.
 */

import {
  ASSET_CATEGORY_RULES,
  isValidStorageObjectKey,
} from '@/lib/storage/asset-validation';
import {
  getPublicAssetBaseUrl,
  readStorageConfig,
} from '@/lib/storage/storage-config';
import type { AssetCategory, ResolveAssetUrlInput, ResolveAssetUrlResult } from '@/lib/storage/types';
import {
  resolveCustomerFacingOrigin,
  type CustomerFacingUrlOptions,
} from '@/lib/runtime/customer-facing-url';

function isLoopbackUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return /^localhost$/i.test(hostname) || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function logAssetResolution(payload: Record<string, unknown>): void {
  console.info('[StorageService]', { context: 'resolveAssetUrl', ...payload });
}

export function resolveAssetUrl(input: ResolveAssetUrlInput): ResolveAssetUrlResult {
  const source = input.source?.trim() || null;
  if (!source) {
    return { url: null, resolvedFrom: 'none', source: null };
  }

  if (input.proxyPath && input.visibility === 'private') {
    const result: ResolveAssetUrlResult = {
      url: input.proxyPath,
      resolvedFrom: 'proxy',
      source,
    };
    logAssetResolution({ source, url: result.url, resolvedFrom: result.resolvedFrom });
    return result;
  }

  if (/^https?:\/\//i.test(source)) {
    if (process.env.NODE_ENV === 'production' && isLoopbackUrl(source)) {
      return { url: null, resolvedFrom: 'none', source };
    }
    const result: ResolveAssetUrlResult = {
      url: source,
      resolvedFrom: 'absolute',
      source,
    };
    logAssetResolution({ source, url: result.url, resolvedFrom: result.resolvedFrom });
    return result;
  }

  if (source.startsWith('//')) {
    const absolute = `https:${source}`;
    if (process.env.NODE_ENV === 'production' && isLoopbackUrl(absolute)) {
      return { url: null, resolvedFrom: 'none', source };
    }
    const result: ResolveAssetUrlResult = {
      url: absolute,
      resolvedFrom: 'absolute',
      source,
    };
    logAssetResolution({ source, url: result.url, resolvedFrom: result.resolvedFrom });
    return result;
  }

  const config = readStorageConfig();
  const publicBase = getPublicAssetBaseUrl(config);

  if (isValidStorageObjectKey(source, input.category)) {
    if (publicBase) {
      const url = `${publicBase.replace(/\/+$/, '')}/${source.replace(/^\/+/, '')}`;
      const result: ResolveAssetUrlResult = {
        url,
        resolvedFrom: config.assetCdnUrl ? 'cdn' : 'public_base',
        source,
      };
      logAssetResolution({ source, url: result.url, resolvedFrom: result.resolvedFrom });
      return result;
    }
  }

  if (source.startsWith('/uploads/') || source.startsWith('uploads/')) {
    const relativePath = source.startsWith('/') ? source : `/${source}`;
    const originOptions: CustomerFacingUrlOptions = {
      requestOrigin: input.requestOrigin,
      runtimeOrigin: input.runtimeOrigin,
      infrastructureOverride: input.infrastructureOverride,
    };
    const originResolution = resolveCustomerFacingOrigin(originOptions);
    if (originResolution.configured) {
      const url = `${originResolution.origin.replace(/\/+$/, '')}${relativePath}`;
      const result: ResolveAssetUrlResult = {
        url,
        resolvedFrom: 'legacy_relative',
        source,
      };
      logAssetResolution({ source, url: result.url, resolvedFrom: result.resolvedFrom });
      return result;
    }
  }

  if (input.category && ASSET_CATEGORY_RULES[input.category].visibility === 'public' && publicBase) {
    const normalizedKey = source.replace(/^\/+/, '');
    if (normalizedKey.startsWith(`${input.category}/`)) {
      const url = `${publicBase.replace(/\/+$/, '')}/${normalizedKey}`;
      const result: ResolveAssetUrlResult = {
        url,
        resolvedFrom: config.assetCdnUrl ? 'cdn' : 'public_base',
        source,
      };
      logAssetResolution({ source, url: result.url, resolvedFrom: result.resolvedFrom });
      return result;
    }
  }

  return { url: null, resolvedFrom: 'none', source };
}

export function resolvePublicAssetUrlForKey(
  storageKey: string,
  category: AssetCategory,
  options?: Pick<ResolveAssetUrlInput, 'requestOrigin' | 'runtimeOrigin' | 'infrastructureOverride'>
): string | null {
  const visibility = ASSET_CATEGORY_RULES[category].visibility;
  return resolveAssetUrl({
    source: storageKey,
    category,
    visibility,
    ...options,
  }).url;
}
