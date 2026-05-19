/** Public origin for referral share URLs. */
export {
  buildCustomerFacingUrl,
  getBrandedAppOrigin as getReferralPublicBaseUrl,
} from '@/lib/runtime/customer-facing-url';

import { buildCustomerFacingUrl } from '@/lib/runtime/customer-facing-url';

export type ReferralShareSlugSource = {
  code: string;
  slug?: string | null;
  referralLinkSlug?: string | null;
};

export function resolveReferralSlug(source: ReferralShareSlugSource): string | null {
  const s = source.slug?.trim() || source.referralLinkSlug?.trim();
  return s || null;
}

/** Prefer `/ref/{slug}` when a vanity slug exists; otherwise `/r/{CODE}`. */
export function buildReferralSharePath(source: ReferralShareSlugSource): string {
  const slug = resolveReferralSlug(source);
  const code = source.code.trim().toUpperCase();
  if (slug) return `/ref/${slug}`;
  return `/r/${code}`;
}

export function buildReferralShareUrl(
  baseUrl: string,
  source: ReferralShareSlugSource
): string {
  const path = buildReferralSharePath(source);
  if (baseUrl?.trim()) {
    return buildCustomerFacingUrl(path, { origin: baseUrl });
  }
  return buildCustomerFacingUrl(path);
}

export function buildReferralQrApiPath(code: string): string {
  return `/api/referral/${encodeURIComponent(code.trim().toUpperCase())}/qr`;
}

export function buildReferralQrUrl(baseUrl: string, code: string): string {
  return buildCustomerFacingUrl(buildReferralQrApiPath(code), {
    origin: baseUrl,
  });
}
