import {
  classifyOrganizationId,
  isDemoSyntheticOrganizationId,
  isTimestampLikeOrganizationId,
  isValidOrganizationUuid,
  ORGANIZATION_UUID_RE,
} from '@/lib/organization/organization-id';

describe('organization-id', () => {
  const validUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  it('validates canonical organization UUIDs', () => {
    expect(ORGANIZATION_UUID_RE.test(validUuid)).toBe(true);
    expect(isValidOrganizationUuid(validUuid)).toBe(true);
    expect(classifyOrganizationId(validUuid)).toBe('uuid');
  });

  it('rejects timestamp-like organization ids', () => {
    expect(isTimestampLikeOrganizationId('1778387226579')).toBe(true);
    expect(classifyOrganizationId('1778387226579')).toBe('timestamp_like');
    expect(isValidOrganizationUuid('1778387226579')).toBe(false);
  });

  it('detects demo synthetic organization ids', () => {
    expect(isDemoSyntheticOrganizationId('demo-1234567890')).toBe(true);
    expect(isDemoSyntheticOrganizationId('part-1234567890')).toBe(true);
    expect(isDemoSyntheticOrganizationId('onb_1234567890_abc')).toBe(true);
    expect(classifyOrganizationId('demo-1234567890')).toBe('demo_synthetic');
  });

  it('rejects arbitrary non-uuid strings', () => {
    expect(classifyOrganizationId('org-1')).toBe('invalid');
    expect(isValidOrganizationUuid('org-1')).toBe(false);
  });
});
