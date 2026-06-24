/**
 * Australian Business Register (ABR) lookup with graceful fallback.
 *
 * Uses the public ABR JSON endpoint when ABR_GUID is configured.
 * Falls back to local checksum validation when the service is unavailable.
 */

import { validateABN } from '@/lib/commercial/supplier-onboarding';

export type AbrLookupResult = {
  abn: string;
  isValid: boolean;
  verified: boolean;
  verificationSource: 'abr' | 'checksum' | 'not_applicable';
  businessName: string | null;
  abnStatus: string | null;
  gstRegistered: boolean | null;
  message: string;
};

const ABR_TIMEOUT_MS = 8000;

function parseAbrJsonPayload(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  try {
    if (trimmed.startsWith('{')) {
      return JSON.parse(trimmed) as Record<string, unknown>;
    }
    const match = trimmed.match(/^[a-zA-Z0-9_]+\((.*)\)\s*;?\s*$/);
    if (match?.[1]) {
      return JSON.parse(match[1]) as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function checksumFallback(abn: string, notApplicable: boolean): AbrLookupResult {
  const validation = validateABN(abn, notApplicable);
  return {
    abn: validation.abn,
    isValid: validation.isValid || validation.isNotApplicable,
    verified: validation.isValid && !validation.isNotApplicable,
    verificationSource: validation.isNotApplicable ? 'not_applicable' : 'checksum',
    businessName: validation.businessName,
    abnStatus: validation.abnStatus,
    gstRegistered: null,
    message: validation.isNotApplicable
      ? 'ABN not applicable for this supplier.'
      : validation.isValid
      ? 'ABN format verified locally — live registry lookup unavailable.'
      : validation.errorMessage ?? 'Invalid ABN format.',
  };
}

/**
 * Look up an ABN via ABR when configured; otherwise checksum-only.
 * Never throws — always returns a result suitable for form validation.
 */
export async function lookupAbn(
  rawAbn: string,
  notApplicable = false
): Promise<AbrLookupResult> {
  if (notApplicable) {
    return checksumFallback('', true);
  }

  const checksum = validateABN(rawAbn, false);
  if (!checksum.isValid) {
    return {
      abn: checksum.abn,
      isValid: false,
      verified: false,
      verificationSource: 'checksum',
      businessName: null,
      abnStatus: null,
      gstRegistered: null,
      message: checksum.errorMessage ?? 'Invalid ABN format.',
    };
  }

  const guid = process.env.ABR_GUID?.trim();
  if (!guid) {
    return checksumFallback(rawAbn, false);
  }

  const abn = checksum.abn.replace(/\s/g, '');
  const url = `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${encodeURIComponent(abn)}&guid=${encodeURIComponent(guid)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ABR_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return checksumFallback(rawAbn, false);
    }

    const text = await res.text();
    const data = parseAbrJsonPayload(text);
    if (!data) {
      return checksumFallback(rawAbn, false);
    }

    const entityName =
      (data.EntityName as string | undefined) ??
      (data.BusinessName as string | undefined) ??
      null;
    const abnStatus = (data.AbnStatus as string | undefined) ?? null;
    const gstRaw = data.Gst as string | undefined;
    const gstRegistered =
      gstRaw != null && gstRaw.trim().length > 0
        ? gstRaw.toLowerCase().includes('registered')
        : null;

    const active =
      abnStatus?.toLowerCase().includes('active') ?? entityName != null;

    return {
      abn,
      isValid: active,
      verified: active,
      verificationSource: 'abr',
      businessName: entityName,
      abnStatus,
      gstRegistered,
      message: active
        ? `Verified with Australian Business Register — ${entityName ?? 'Active ABN'}.`
        : 'ABR returned a non-active status for this ABN.',
    };
  } catch {
    return checksumFallback(rawAbn, false);
  }
}
