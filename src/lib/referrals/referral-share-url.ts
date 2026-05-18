/**
 * Build public referral URLs for sharing (vanity /r fallback).
 * Does not mutate codes — surfaces existing referral_codes / referral_links rows only.
 */

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

/** Public origin for referral share URLs (env + Vercel fallbacks). */
export function getReferralPublicBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) return site.replace(/\/$/, '');
  return '';
}

export function buildReferralShareUrl(
  baseUrl: string,
  source: ReferralShareSlugSource
): string {
  const base = (baseUrl || getReferralPublicBaseUrl()).replace(/\/$/, '');
  return `${base}${buildReferralSharePath(source)}`;
}

export function buildReferralQrApiPath(code: string): string {
  return `/api/referral/${encodeURIComponent(code.trim().toUpperCase())}/qr`;
}

export function buildReferralQrUrl(baseUrl: string, code: string): string {
  const base = baseUrl.replace(/\/$/, '');
  return `${base}${buildReferralQrApiPath(code)}`;
}
