/**
 * Unit tests for deterministic referral code helpers (no DB).
 */

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 50);
}

function pilotSlug(sourceParticipantId: string): string {
  const compact = sourceParticipantId.replace(/-/g, '').slice(0, 40);
  return `pilot-${compact}`.slice(0, 64);
}

function deterministicCodeFromSource(sourceParticipantId: string, hint?: string | null): string {
  if (hint?.trim()) {
    const fromHint = normalizeCode(hint);
    if (fromHint.length >= 4) return fromHint;
  }
  const compact = sourceParticipantId.replace(/-/g, '').toUpperCase();
  return `P${compact.slice(0, 8)}`;
}

describe('referral issuance determinism', () => {
  const pilotId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  it('builds stable pilot slug', () => {
    expect(pilotSlug(pilotId)).toBe('pilot-a1b2c3d4e5f67890abcdef1234567890');
    expect(pilotSlug(pilotId)).toBe(pilotSlug(pilotId));
  });

  it('prefers hint code when valid', () => {
    expect(deterministicCodeFromSource(pilotId, 'my-deal-01')).toBe('MY-DEAL-01');
  });

  it('falls back to P-prefix from participant id', () => {
    expect(deterministicCodeFromSource(pilotId, null)).toBe('PA1B2C3D4');
    expect(deterministicCodeFromSource(pilotId, 'ab')).toBe('PA1B2C3D4');
  });
});
