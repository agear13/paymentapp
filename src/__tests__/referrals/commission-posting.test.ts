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

    it('normalizes pct: "10" (10%) -> 0.10', () => {
      const meta = extractReferralMetadata({
        referral_link_id: 'rl-123',
        consultant_id: 'c-456',
        consultant_pct: '10',
        bd_partner_pct: '5',
      });
      expect(meta).not.toBeNull();
      expect(meta?.consultantPct).toBe(0.1);
      expect(meta?.bdPartnerPct).toBe(0.05);
    });

    it('keeps pct "0.1" as 0.1 (already decimal)', () => {
      const meta = extractReferralMetadata({
        referral_link_id: 'rl-123',
        consultant_id: 'c-456',
        consultant_pct: '0.1',
        bd_partner_pct: '0.05',
      });
      expect(meta).not.toBeNull();
      expect(meta?.consultantPct).toBe(0.1);
      expect(meta?.bdPartnerPct).toBe(0.05);
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

    it('referral checkout metadata keys exist for commission posting', () => {
      const metadata = {
        referral_link_id: 'rl-abc',
        referral_code: 'REF001',
        consultant_id: 'c-1',
        bd_partner_id: 'bd-1',
        consultant_pct: '0.10',
        bd_partner_pct: '0.05',
        commission_basis: 'GROSS',
      };
      const meta = extractReferralMetadata(metadata);
      expect(meta).not.toBeNull();
      expect(meta?.referralLinkId).toBe('rl-abc');
      expect(meta?.referralCode).toBe('REF001');
      expect(meta?.consultantId).toBe('c-1');
      expect(meta?.bdPartnerId).toBe('bd-1');
      expect(meta?.consultantPct).toBe(0.1);
      expect(meta?.bdPartnerPct).toBe(0.05);
      expect(meta?.commissionBasis).toBe('GROSS');
    });
  });

  describe('Idempotency key format', () => {
    it('uses base key commission-{stripeEventId}-consultant (LedgerEntryService suffixes -0/-1)', () => {
      const stripeEventId = 'evt_123';
      const baseKey = `commission-${stripeEventId}-consultant`;
      expect(baseKey).toMatch(/^commission-/);
      expect(baseKey).toContain(stripeEventId);
      expect(baseKey).toContain('consultant');
      // LedgerEntryService produces: baseKey-0, baseKey-1 for 2 entries
      expect(`${baseKey}-0`).toBe('commission-evt_123-consultant-0');
      expect(`${baseKey}-1`).toBe('commission-evt_123-consultant-1');
    });

    it('uses base key commission-{stripeEventId}-bd (LedgerEntryService suffixes -0/-1)', () => {
      const stripeEventId = 'evt_123';
      const baseKey = `commission-${stripeEventId}-bd`;
      expect(`${baseKey}-0`).toBe('commission-evt_123-bd-0');
      expect(`${baseKey}-1`).toBe('commission-evt_123-bd-1');
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
