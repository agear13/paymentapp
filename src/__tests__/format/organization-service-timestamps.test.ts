import {
  formatServiceActivityLine,
  serviceCreatedAtIso,
  serviceUpdatedAtIso,
} from '@/lib/format/organization-service-timestamps';

describe('organization-service-timestamps', () => {
  const valid = new Date('2024-06-01T12:00:00.000Z');

  it('serviceUpdatedAtIso falls back to created when updated missing', () => {
    expect(serviceUpdatedAtIso(valid, undefined)).toBe(valid.toISOString());
    expect(serviceUpdatedAtIso(valid, null)).toBe(valid.toISOString());
  });

  it('serviceUpdatedAtIso prefers updated when valid', () => {
    const u = new Date('2025-01-02T00:00:00.000Z');
    expect(serviceUpdatedAtIso(valid, u)).toBe(u.toISOString());
  });

  it('serviceCreatedAtIso returns null for invalid', () => {
    expect(serviceCreatedAtIso(undefined)).toBeNull();
    expect(serviceCreatedAtIso(new Date(Number.NaN))).toBeNull();
  });

  it('formatServiceActivityLine handles missing strings', () => {
    expect(formatServiceActivityLine(undefined, undefined)).toBe('Recently added');
  });
});
