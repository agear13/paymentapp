import {
  isPilotOrganizationDevFallbackAllowed,
  resolvePilotOrganizationFromMemberships,
} from '@/lib/pilot/resolve-pilot-organization';

describe('pilot organization resolution', () => {
  const memberships = [
    { id: 'org-a', name: 'Alpha' },
    { id: 'org-b', name: 'Beta' },
  ];

  it('prefers an explicit organization id', () => {
    const result = resolvePilotOrganizationFromMemberships({
      explicitOrgId: 'org-explicit',
      memberships,
    });
    expect(result).toEqual({
      organizationId: 'org-explicit',
      resolution: 'explicit',
    });
  });

  it('auto-selects when the user belongs to exactly one organization', () => {
    const result = resolvePilotOrganizationFromMemberships({
      memberships: [{ id: 'solo-org', name: 'Solo' }],
    });
    expect(result).toEqual({
      organizationId: 'solo-org',
      resolution: 'single_membership',
    });
  });

  it('stays unresolved when multiple memberships exist without an explicit selection', () => {
    const result = resolvePilotOrganizationFromMemberships({
      memberships,
    });
    expect(result).toEqual({
      organizationId: null,
      resolution: 'unresolved',
    });
  });

  it('uses PILOT_ORGANIZATION_ID only as a development fallback', () => {
    const result = resolvePilotOrganizationFromMemberships({
      memberships: [],
      devFallbackOrgId: 'dev-org',
      allowDevFallback: true,
    });
    expect(result).toEqual({
      organizationId: 'dev-org',
      resolution: 'dev_fallback',
    });
  });

  it('does not use PILOT_ORGANIZATION_ID in production', () => {
    expect(isPilotOrganizationDevFallbackAllowed('production')).toBe(false);

    const result = resolvePilotOrganizationFromMemberships({
      memberships: [],
      devFallbackOrgId: 'dev-org',
      allowDevFallback: false,
    });
    expect(result).toEqual({
      organizationId: null,
      resolution: 'unresolved',
    });
  });
});
