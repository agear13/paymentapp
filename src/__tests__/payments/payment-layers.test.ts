import {
  buildLayerFieldsForCreate,
  layersRequireFxConversion,
  resolvePaymentTransactionLayers,
} from '@/lib/payments/payment-layers';
import { buildXeroPaymentContextMetadata } from '@/lib/payments/xero-payment-context';

describe('payment-layers', () => {
  it('legacy invoice maps commercial and accounting to invoice currency', () => {
    const layers = resolvePaymentTransactionLayers({
      link: {
        amount: 250,
        currency: 'AUD',
        invoice_currency: 'AUD',
      },
    });

    expect(layers.commercial).toEqual({ currency: 'AUD', amount: '250.00' });
    expect(layers.accounting?.currency).toBe('AUD');
    expect(layers.accounting?.amount).toBe('250.00');
    expect(layers.settlement).toBeNull();
    expect(layers.layersAligned).toBe(true);
  });

  it('USDC commercial invoice with AUD accounting resolves distinct layers', () => {
    const layers = resolvePaymentTransactionLayers({
      link: {
        amount: 500,
        currency: 'USD',
        invoice_currency: 'USD',
        commercial_currency: 'USDC',
        commercial_amount: 500,
        accounting_currency: 'AUD',
        accounting_amount: 770,
        base_currency: 'AUD',
        base_amount: 770,
      },
      fxSnapshots: [
        {
          id: 'fx-1',
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
    });

    expect(layers.commercial).toEqual({ currency: 'USDC', amount: '500.00' });
    expect(layers.accounting).toMatchObject({
      currency: 'AUD',
      amount: '770.00',
      exchangeRate: 1.54,
      valuationMethod: 'INVOICE_CREATION_LOCK',
    });
    expect(layers.fxSnapshot?.immutable).toBe(true);
    expect(layers.layersAligned).toBe(false);
  });

  it('settlement layer derives from payment event when link fields unset', () => {
    const layers = resolvePaymentTransactionLayers({
      link: {
        amount: 250,
        currency: 'AUD',
        invoice_currency: 'AUD',
      },
      paymentEvents: [
        {
          event_type: 'PAYMENT_CONFIRMED',
          payment_method: 'CRYPTO',
          amount_received: 160.34,
          currency_received: 'USDC',
          metadata: {
            network: 'base',
            transaction_hash: '0xabc',
            wallet_address: '0xwallet',
          },
        },
      ],
    });

    expect(layers.settlement).toMatchObject({
      currency: 'USDC',
      amount: '160.34',
      paymentRail: 'CRYPTO',
      network: 'base',
      transactionHash: '0xabc',
      wallet: '0xwallet',
    });
    expect(layers.layersAligned).toBe(false);
  });

  it('layersRequireFxConversion is false when commercial equals settlement', () => {
    expect(layersRequireFxConversion('USDC', 'USDC')).toBe(false);
    expect(layersRequireFxConversion('AUD', 'USDC')).toBe(true);
  });

  it('buildLayerFieldsForCreate preserves commercial as invoice currency', () => {
    const fields = buildLayerFieldsForCreate({
      commercialCurrency: 'USDC',
      commercialAmount: 500,
      accountingCurrency: 'AUD',
      accountingAmount: 770,
    });

    expect(fields.commercial_currency).toBe('USDC');
    expect(fields.invoice_currency).toBe('USD');
    expect(fields.accounting_currency).toBe('AUD');
    expect(fields.base_amount).toBe(770);
  });

  it('buildXeroPaymentContextMetadata prepares accounting-first context', () => {
    const layers = resolvePaymentTransactionLayers({
      link: {
        amount: 500,
        currency: 'USD',
        commercial_currency: 'USDC',
        commercial_amount: 500,
        accounting_currency: 'AUD',
        accounting_amount: 770,
        settlement_currency: 'USDC',
        settlement_amount: 500,
      },
      paymentEvents: [
        {
          event_type: 'PAYMENT_CONFIRMED',
          payment_method: 'CRYPTO',
          amount_received: 500,
          currency_received: 'USDC',
          metadata: { network: 'base', transaction_hash: '0xabc' },
        },
      ],
      fxSnapshots: [
        {
          id: 'fx-1',
          snapshot_type: 'SETTLEMENT',
          base_currency: 'USDC',
          quote_currency: 'AUD',
          rate: 1.54,
          provider: 'coingecko',
          captured_at: new Date('2026-07-08T01:00:00Z'),
          commercial_currency: 'USDC',
          commercial_amount: 500,
          accounting_currency: 'AUD',
          accounting_amount: 770,
        },
      ],
    });

    const context = buildXeroPaymentContextMetadata(layers);
    expect(context.originalInvoiceCurrency).toBe('USDC');
    expect(context.originalInvoiceAmount).toBe('500.00');
    expect(context.accountingCurrency).toBe('AUD');
    expect(context.accountingAmount).toBe('770.00');
    expect(context.settlementCurrency).toBe('USDC');
    expect(context.fxRate).toBe(1.54);
    expect(context.network).toBe('base');
  });
});
