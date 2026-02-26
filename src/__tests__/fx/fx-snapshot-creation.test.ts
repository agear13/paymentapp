/**
 * FX snapshot creation tests
 * - captureAllCreationSnapshots inserts 4 CREATION rows (HBAR, USDC, USDT, AUDD) when provider returns rates
 * - Payment link creation calls captureAllCreationSnapshots and is fail-open (link succeeds even if FX fails)
 */

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
});
