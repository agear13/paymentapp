import {
  buildXeroExportContext,
  buildXeroInvoiceReference,
  buildXeroLayerPaymentNarration,
  buildXeroLayerPaymentReference,
  enrichXeroLineDescription,
  maskWalletAddress,
  resolveImmutableAccountingFxRate,
  resolveImmutableAccountingFxSnapshot,
  resolveXeroPostingValues,
  shortenTransactionHash,
} from '@/lib/xero/xero-layer-export';

describe('xero-layer-export', () => {
  describe('resolveXeroPostingValues', () => {
    it('legacy invoice export unchanged when layers match invoice denomination', () => {
      const posting = resolveXeroPostingValues({
        amount: 250,
        currency: 'AUD',
        invoice_currency: 'AUD',
        commercial_currency: 'AUD',
        commercial_amount: 250,
        accounting_currency: 'AUD',
        accounting_amount: 250,
      });

      expect(posting).toEqual({
        amount: '250.00',
        currency: 'AUD',
        usesAccountingLayer: false,
      });
    });

    it('USDC invoice valued in AUD uses accounting layer', () => {
      const posting = resolveXeroPostingValues({
        amount: 500,
        currency: 'USD',
        invoice_currency: 'USD',
        commercial_currency: 'USDC',
        commercial_amount: 500,
        accounting_currency: 'AUD',
        accounting_amount: 770,
        base_currency: 'AUD',
        base_amount: 770,
      });

      expect(posting).toEqual({
        amount: '770.00',
        currency: 'AUD',
        usesAccountingLayer: true,
      });
    });

    it('USDT invoice valued in AUD uses accounting layer', () => {
      const posting = resolveXeroPostingValues({
        amount: 100,
        currency: 'USD',
        invoice_currency: 'USD',
        commercial_currency: 'USDT',
        commercial_amount: 100,
        accounting_currency: 'AUD',
        accounting_amount: 154,
      });

      expect(posting.usesAccountingLayer).toBe(true);
      expect(posting.currency).toBe('AUD');
      expect(posting.amount).toBe('154.00');
    });

    it('AUD invoice paid in USDC stays on legacy denomination when accounting matches', () => {
      const posting = resolveXeroPostingValues({
        amount: 250,
        currency: 'AUD',
        invoice_currency: 'AUD',
        accounting_currency: 'AUD',
        accounting_amount: 250,
      });

      expect(posting).toEqual({
        amount: '250.00',
        currency: 'AUD',
        usesAccountingLayer: false,
      });
    });

    it('missing accounting layer falls back to invoice denomination', () => {
      const posting = resolveXeroPostingValues({
        amount: 100,
        currency: 'AUD',
        invoice_currency: 'AUD',
      });

      expect(posting).toEqual({
        amount: '100.00',
        currency: 'AUD',
        usesAccountingLayer: false,
      });
    });
  });

  describe('immutable FX snapshots', () => {
    const snapshots = [
      {
        id: 'fx-accounting-1',
        snapshot_type: 'ACCOUNTING',
        base_currency: 'USDC',
        quote_currency: 'AUD',
        rate: 1.54,
        provider: 'coingecko',
        captured_at: new Date('2026-07-08T00:00:00Z'),
        commercial_currency: 'USDC',
        commercial_amount: 500,
        accounting_currency: 'AUD',
        accounting_amount: 770,
        valuation_method: 'INVOICE_CREATION_LOCK',
      },
      {
        id: 'fx-settlement-1',
        snapshot_type: 'SETTLEMENT',
        base_currency: 'USDC',
        quote_currency: 'AUD',
        rate: 1.55,
        provider: 'coingecko',
        captured_at: new Date('2026-07-08T01:00:00Z'),
      },
    ];

    it('prefers ACCOUNTING snapshot over SETTLEMENT', () => {
      const snapshot = resolveImmutableAccountingFxSnapshot(snapshots);
      expect(snapshot?.id).toBe('fx-accounting-1');
    });

    it('returns accounting snapshot rate without recalculation', () => {
      const { rate, snapshotId } = resolveImmutableAccountingFxRate(snapshots, true);
      expect(rate).toBe(1.54);
      expect(snapshotId).toBe('fx-accounting-1');
    });

    it('does not return rate when accounting layer inactive', () => {
      const { rate } = resolveImmutableAccountingFxRate(snapshots, false);
      expect(rate).toBeNull();
    });
  });

  describe('metadata enrichment', () => {
    it('buildXeroExportContext exposes three-layer metadata for Danielle workflow', () => {
      const ctx = buildXeroExportContext({
        link: {
          id: 'link-123',
          amount: 500,
          currency: 'USD',
          invoice_currency: 'USD',
          commercial_currency: 'USDC',
          commercial_amount: 500,
          accounting_currency: 'AUD',
          accounting_amount: 770,
          settlement_currency: 'USDC',
          settlement_amount: 500,
          invoice_reference: 'INV-0042',
          invoice_date: new Date('2026-07-01T00:00:00Z'),
        },
        paymentEvents: [
          {
            event_type: 'PAYMENT_CONFIRMED',
            payment_method: 'EVM_WALLET',
            amount_received: 500,
            currency_received: 'USDC',
            metadata: {
              network: 'base',
              transaction_hash: '0xabcdef1234567890',
              wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
            },
          },
        ],
        fxSnapshots: [
          {
            id: 'fx-accounting-1',
            snapshot_type: 'ACCOUNTING',
            base_currency: 'USDC',
            quote_currency: 'AUD',
            rate: 1.54,
            provider: 'coingecko',
            captured_at: new Date('2026-07-08T00:00:00Z'),
            commercial_currency: 'USDC',
            commercial_amount: 500,
            accounting_currency: 'AUD',
            accounting_amount: 770,
            valuation_method: 'INVOICE_CREATION_LOCK',
          },
        ],
        merchantDefaultCurrency: 'AUD',
        settlementTimestamp: new Date('2026-07-08T02:00:00Z'),
      });

      expect(ctx.posting).toMatchObject({
        amount: '770.00',
        currency: 'AUD',
        usesAccountingLayer: true,
      });
      expect(ctx.metadata.commercialAmount).toBe('500.00');
      expect(ctx.metadata.commercialCurrency).toBe('USDC');
      expect(ctx.metadata.accountingAmount).toBe('770.00');
      expect(ctx.metadata.settlementAmount).toBe('500.00');
      expect(ctx.metadata.fxSnapshotId).toBe('fx-accounting-1');
      expect(ctx.metadata.fxRate).toBe(1.54);
      expect(ctx.metadata.commercialInvoiceReference).toBe('INV-0042');
      expect(ctx.metadata.network).toBe('base');
      expect(ctx.metadata.walletMasked).toBe('0x1234…5678');
    });
  });

  describe('Xero field formatting', () => {
    it('buildXeroInvoiceReference includes commercial and accounting context', () => {
      const ref = buildXeroInvoiceReference({
        invoiceReference: 'INV-0042',
        paymentLinkId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        metadata: {
          commercialAmount: '500.00',
          commercialCurrency: 'USDC',
          accountingAmount: '770.00',
          accountingCurrency: 'AUD',
        } as never,
        usesAccountingLayer: true,
      });

      expect(ref).toContain('INV-0042');
      expect(ref).toContain('COM:500.00 USDC');
      expect(ref).toContain('ACC:770.00 AUD');
      expect(ref!.length).toBeLessThanOrEqual(255);
    });

    it('enrichXeroLineDescription preserves commercial and accounting audit lines', () => {
      const description = enrichXeroLineDescription(
        'Consulting services',
        {
          commercialAmount: '500.00',
          commercialCurrency: 'USDC',
          accountingAmount: '770.00',
          accountingCurrency: 'AUD',
          commercialInvoiceReference: 'INV-0042',
          originalInvoiceDate: '2026-07-01T00:00:00.000Z',
          fxRate: 1.54,
          fxSnapshotId: 'fx-accounting-1',
        } as never,
        true
      );

      expect(description).toContain('Consulting services');
      expect(description).toContain('Commercial: 500.00 USDC');
      expect(description).toContain('Accounting: 770.00 AUD');
      expect(description).toContain('FX Snapshot: fx-accounting-1');
    });

    it('buildXeroLayerPaymentNarration includes settlement audit without changing posting', () => {
      const narration = buildXeroLayerPaymentNarration({
        metadata: {
          commercialAmount: '500.00',
          commercialCurrency: 'USDC',
          accountingAmount: '770.00',
          accountingCurrency: 'AUD',
          settlementAmount: '500.00',
          settlementCurrency: 'USDC',
          paymentRail: 'EVM_WALLET',
          network: 'base',
          token: 'USDC',
          transactionHash: '0xabcdef1234567890',
          walletMasked: '0x1234…5678',
          fxRate: 1.54,
          fxProvider: 'coingecko',
          fxCapturedAt: '2026-07-08T00:00:00.000Z',
          valuationMethod: 'INVOICE_CREATION_LOCK',
          fxSnapshotId: 'fx-accounting-1',
        } as never,
        posting: { amount: '770.00', currency: 'AUD', usesAccountingLayer: true },
        paymentMethod: 'EVM_WALLET',
        paymentToken: 'USDC',
        transactionId: '0xabcdef1234567890',
      });

      expect(narration).toContain('Posted to Xero: 770.00 AUD');
      expect(narration).toContain('Sold: 500.00 USDC');
      expect(narration).toContain('Paid: 500.00 USDC');
      expect(narration).toContain('Network: base');
      expect(narration).toContain('FX Snapshot ID: fx-accounting-1');
    });

    it('maskWalletAddress and shortenTransactionHash respect field limits', () => {
      expect(maskWalletAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe(
        '0x1234…5678'
      );
      expect(shortenTransactionHash('0xabcdef1234567890abcdef1234567890')).toBe('0xabcdef12345678…');
    });

    it('buildXeroLayerPaymentReference stays within Xero limits', () => {
      const ref = buildXeroLayerPaymentReference({
        paymentMethod: 'EVM_WALLET',
        paymentToken: 'USDC',
        transactionId: '0xabcdef1234567890',
        metadata: {
          commercialCurrency: 'USDC',
          settlementCurrency: 'USDC',
          transactionHash: '0xabcdef1234567890abcdef1234567890',
          paymentRail: 'EVM_WALLET',
          token: 'USDC',
        } as never,
      });
      expect(ref.length).toBeLessThanOrEqual(255);
    });
  });
});
