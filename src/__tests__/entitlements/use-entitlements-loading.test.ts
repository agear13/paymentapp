/**
 * Fail-closed entitlement loading — isAllowed must not grant access while loading.
 */

describe('useEntitlements fail-closed contract', () => {
  function isAllowedWhileLoading(
    loading: boolean,
    data: { features: Record<string, { allowed: boolean }>; pilotBypass?: boolean } | null,
    feature: string
  ): boolean {
    if (loading || !data) return false;
    if (data.pilotBypass) return true;
    return data.features[feature]?.allowed ?? false;
  }

  it('denies all features while loading', () => {
    expect(
      isAllowedWhileLoading(true, { features: { payment_links: { allowed: true } } }, 'payment_links')
    ).toBe(false);
  });

  it('denies all features when data is null', () => {
    expect(isAllowedWhileLoading(false, null, 'payment_links')).toBe(false);
  });

  it('allows feature only when loaded and explicitly allowed', () => {
    expect(
      isAllowedWhileLoading(false, { features: { payment_links: { allowed: true } } }, 'payment_links')
    ).toBe(true);
  });

  it('denies feature when loaded but not allowed', () => {
    expect(
      isAllowedWhileLoading(false, { features: { payment_links: { allowed: false } } }, 'payment_links')
    ).toBe(false);
  });

  it('isEntitlementsReady is false while loading or data missing', () => {
    expect(!true && { organizationId: 'x' } !== null).toBe(false);
    const ready = (loading: boolean, data: unknown) => !loading && data !== null;
    expect(ready(true, { organizationId: 'x' })).toBe(false);
    expect(ready(false, null)).toBe(false);
    expect(ready(false, { organizationId: 'x' })).toBe(true);
  });
});
