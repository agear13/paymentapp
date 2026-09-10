/**
 * Conservative Gateway URL classification.
 *
 * Cregis documents a per-project Gateway Server and does not publish a public
 * sandbox vs production hostname. Unknown URLs are not assumed to be sandbox.
 */
export function assessCregisGatewayLooksProduction(
  url: string | null | undefined
): boolean | null {
  if (!url?.trim()) return null;
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }

  if (
    hostname.includes('production') ||
    hostname.startsWith('prod-') ||
    hostname.startsWith('prod.') ||
    /(^|\.)prod\./.test(hostname)
  ) {
    return true;
  }

  if (
    hostname.includes('sandbox') ||
    hostname.includes('shasta') ||
    hostname.includes('nile') ||
    /(^|\.)test\./.test(hostname) ||
    hostname.includes('dev.')
  ) {
    return false;
  }

  return null;
}
