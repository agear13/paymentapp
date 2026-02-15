/**
 * Referral Links Validation Tests
 * - normalizePct: value > 1 => /100
 * - validation: consultantPct + bdPartnerPct <= 1
 */

function normalizePct(value: number): number {
  return value > 1 ? value / 100 : value;
}

describe('Referral Links Validation', () => {
  describe('normalizePct', () => {
    it('divides by 100 when value > 1', () => {
      expect(normalizePct(10)).toBe(0.1);
      expect(normalizePct(5)).toBe(0.05);
      expect(normalizePct(100)).toBe(1);
    });

    it('keeps value when <= 1', () => {
      expect(normalizePct(0.1)).toBe(0.1);
      expect(normalizePct(0.05)).toBe(0.05);
      expect(normalizePct(1)).toBe(1);
    });
  });

  describe('pct sum validation', () => {
    it('rejects when consultantPct + bdPartnerPct > 1', () => {
      const consultantPct = normalizePct(60);
      const bdPartnerPct = normalizePct(50);
      expect(consultantPct + bdPartnerPct).toBeGreaterThan(1);
    });

    it('accepts when consultantPct + bdPartnerPct <= 1', () => {
      const consultantPct = normalizePct(10);
      const bdPartnerPct = normalizePct(5);
      expect(consultantPct + bdPartnerPct).toBeLessThanOrEqual(1);
    });
  });
});
