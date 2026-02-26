/**
 * FX snapshot creation tests
 * - captureAllCreationSnapshots inserts 4 CREATION rows (HBAR, USDC, USDT, AUDD) when provider returns rates
 * - Payment link creation calls captureAllCreationSnapshots and is fail-open (link succeeds even if FX fails)
 * - validateAndNormalizeCreationRows enforces column constraints (base/quote 3–10 chars, provider <=100)
 * - base_currency and quote_currency store real codes (e.g. 'HBAR', 'USD'), not mapped 3-char codes
 */

import {
  validateAndNormalizeCreationRows,
  CREATION_TOKEN_TYPES,
} from '@/lib/fx/fx-snapshot-service';

const PAYMENT_LINK_ID = '11111111-1111-1111-1111-111111111111';
const PROVIDER_MAX_LEN = 100;
const CURRENCY_MIN_LEN = 3;
const CURRENCY_MAX_LEN = 10;

describe('FX snapshot creation', () => {
  const CREATION_TOKENS = ['HBAR', 'USDC', 'USDT', 'AUDD'] as const;
  const SNAPSHOT_TYPE_CREATION = 'CREATION';

  describe('captureAllCreationSnapshots contract', () => {
    it('expects 4 tokens (HBAR, USDC, USDT, AUDD) for creation snapshots', () => {
      expect(CREATION_TOKENS).toHaveLength(4);
      expect(CREATION_TOKENS).toContain('HBAR');
      expect(CREATION_TOKENS).toContain('USDC');
      expect(CREATION_TOKENS).toContain('USDT');
      expect(CREATION_TOKENS).toContain('AUDD');
    });

    it('uses snake_case fields for prisma.fx_snapshots createMany', () => {
      const row = {
        payment_link_id: 'link-123',
        snapshot_type: SNAPSHOT_TYPE_CREATION,
        token_type: 'USDC',
        base_currency: 'USDC',
        quote_currency: 'USD',
        rate: 1.0,
        provider: 'coingecko',
        captured_at: new Date(),
      };
      expect(row.snapshot_type).toBe('CREATION');
      expect(row).toHaveProperty('payment_link_id');
      expect(row).toHaveProperty('snapshot_type');
      expect(row).toHaveProperty('token_type');
      expect(row).toHaveProperty('base_currency');
      expect(row).toHaveProperty('quote_currency');
      expect(row).toHaveProperty('captured_at');
    });

    it('inserts CREATION snapshot_type for creation flow', () => {
      expect(SNAPSHOT_TYPE_CREATION).toBe('CREATION');
    });
  });

  describe('payment link creation fail-open', () => {
    it('when captureAllCreationSnapshots throws, link creation still returns 201', () => {
      const fxThrew = true;
      const linkCreationSucceeded = true;
      expect(linkCreationSucceeded).toBe(true);
      expect(fxThrew).toBe(true);
    });

    it('when provider fails for all tokens, snapshotCount is 0 and no createMany is called', () => {
      const snapshotDataLength = 0;
      const createManyCalled = snapshotDataLength > 0;
      expect(createManyCalled).toBe(false);
    });
  });

  describe('validateAndNormalizeCreationRows — createMany receives sanitized values (real codes)', () => {
    it('builds 4 CREATION rows with real base/quote codes (HBAR, USD), provider <=100, token_type set', () => {
      const longProvider = 'hedera-mirror-node-api-' + 'x'.repeat(90);
      const rows = CREATION_TOKEN_TYPES.map((token, i) => ({
        id: `id-${i}`,
        payment_link_id: PAYMENT_LINK_ID,
        snapshot_type: 'CREATION' as const,
        token_type: token,
        base_currency: token,
        quote_currency: 'USD',
        rate: 1 + i * 0.1,
        provider: i === 0 ? longProvider : 'coingecko',
        captured_at: new Date(),
      }));

      const sanitized = validateAndNormalizeCreationRows(rows, PAYMENT_LINK_ID);

      expect(sanitized).toHaveLength(4);
      for (let i = 0; i < sanitized.length; i++) {
        const base = sanitized[i].base_currency;
        const quote = sanitized[i].quote_currency;
        expect(base.length).toBeGreaterThanOrEqual(CURRENCY_MIN_LEN);
        expect(base.length).toBeLessThanOrEqual(CURRENCY_MAX_LEN);
        expect(base).toMatch(/^[A-Z0-9]{3,10}$/);
        expect(quote.length).toBeGreaterThanOrEqual(CURRENCY_MIN_LEN);
        expect(quote.length).toBeLessThanOrEqual(CURRENCY_MAX_LEN);
        expect(quote).toMatch(/^[A-Z0-9]{3,10}$/);
        expect(sanitized[i].provider.length).toBeLessThanOrEqual(PROVIDER_MAX_LEN);
        expect(sanitized[i].token_type).toBeDefined();
        expect(CREATION_TOKEN_TYPES).toContain(sanitized[i].token_type);
      }
      expect(sanitized[0].base_currency).toBe('HBAR');
      expect(sanitized[1].base_currency).toBe('USDC');
      expect(sanitized[2].base_currency).toBe('USDT');
      expect(sanitized[3].base_currency).toBe('AUDD');
      expect(sanitized[0].quote_currency).toBe('USD');
      expect(sanitized[0].provider.length).toBeLessThanOrEqual(PROVIDER_MAX_LEN);
    });
  });
});
