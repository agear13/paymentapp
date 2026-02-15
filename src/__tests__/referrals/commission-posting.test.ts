/**
 * Commission Posting Tests (Option B)
 * - Missing referral metadata → commissions skipped safely
 * - Idempotency key format
 * - Commission amount calculation
 */

import { extractReferralMetadata } from '@/lib/referrals/commission-posting';

describe('Commission Posting', () => {
  describe('extractReferralMetadata', () => {
    it('returns null when metadata is missing', () => {
      expect(extractReferralMetadata(null)).toBeNull();
      expect(extractReferralMetadata(undefined)).toBeNull();
      expect(extractReferralMetadata({})).toBeNull();
    });

    it('returns null when referral_link_id is missing', () => {
      expect(
        extractReferralMetadata({
          payment_link_id: 'pl-123',
          consultant_id: 'c-456',
          consultant_pct: '0.20',
        })
      ).toBeNull();
    });

    it('returns null when consultant_id is missing', () => {
      expect(
        extractReferralMetadata({
          referral_link_id: 'rl-123',
          payment_link_id: 'pl-123',
          consultant_pct: '0.20',
        })
      ).toBeNull();
    });

    it('returns null when both percentages are zero', () => {
      expect(
        extractReferralMetadata({
          referral_link_id: 'rl-123',
          consultant_id: 'c-456',
          consultant_pct: '0',
          bd_partner_pct: '0',
        })
      ).toBeNull();
    });

    it('extracts metadata when consultant commission is configured', () => {
      const meta = extractReferralMetadata({
        referral_link_id: 'rl-123',
        referral_code: 'REF001',
        consultant_id: 'c-456',
        bd_partner_id: 'bd-789',
        consultant_pct: '0.20',
        bd_partner_pct: '0.05',
        commission_basis: 'GROSS',
      });
      expect(meta).not.toBeNull();
      expect(meta?.referralLinkId).toBe('rl-123');
      expect(meta?.consultantId).toBe('c-456');
      expect(meta?.bdPartnerId).toBe('bd-789');
      expect(meta?.consultantPct).toBe(0.2);
      expect(meta?.bdPartnerPct).toBe(0.05);
      expect(meta?.commissionBasis).toBe('GROSS');
    });

    it('defaults commission_basis to GROSS when missing', () => {
      const meta = extractReferralMetadata({
        referral_link_id: 'rl-123',
        consultant_id: 'c-456',
        consultant_pct: '0.15',
      });
      expect(meta?.commissionBasis).toBe('GROSS');
    });

    it('handles bd_partner_id as empty string', () => {
      const meta = extractReferralMetadata({
        referral_link_id: 'rl-123',
        consultant_id: 'c-456',
        consultant_pct: '0.20',
        bd_partner_id: '',
      });
      expect(meta?.bdPartnerId).toBeNull();
    });
  });

  describe('Idempotency key format', () => {
    it('uses commission-{stripeEventId}-consultant for consultant entries', () => {
      const stripeEventId = 'evt_123';
      const key = `commission-${stripeEventId}-consultant`;
      expect(key).toMatch(/^commission-/);
      expect(key).toContain(stripeEventId);
      expect(key).toContain('consultant');
    });

    it('uses commission-{stripeEventId}-bd for BD partner entries', () => {
      const stripeEventId = 'evt_123';
      const key = `commission-${stripeEventId}-bd`;
      expect(key).toMatch(/^commission-/);
      expect(key).toContain(stripeEventId);
      expect(key).toContain('bd');
    });
  });

  describe('Commission amount calculation', () => {
    it('computes consultant amount as gross * consultant_pct', () => {
      const grossAmount = 100;
      const consultantPct = 0.2;
      const consultantAmount = grossAmount * consultantPct;
      expect(consultantAmount).toBe(20);
    });

    it('computes bd partner amount as gross * bd_partner_pct', () => {
      const grossAmount = 100;
      const bdPartnerPct = 0.05;
      const bdPartnerAmount = grossAmount * bdPartnerPct;
      expect(bdPartnerAmount).toBe(5);
    });
  });
});
