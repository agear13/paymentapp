export function resolveMerchantLogoUrl(
  logoUrl: string | null | undefined,
  origin: string
): string | null {
  const trimmed = logoUrl?.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('/')) {
    const normalizedOrigin = origin.replace(/\/+$/, '');
    return `${normalizedOrigin}${trimmed}`;
  }

  return null;
}
