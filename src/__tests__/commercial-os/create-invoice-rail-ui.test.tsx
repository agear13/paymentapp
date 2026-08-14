/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';

import { CreateInvoicePaymentMethodOption, merchantCreateInvoicePaymentLabel } from '@/components/journey/lovable/create-invoice-ui';

describe('CreateInvoicePaymentMethodOption rail badge', () => {
  it('shows Connected when configured even if available comes from invoiceAlwaysSelectable', () => {
    render(
      <CreateInvoicePaymentMethodOption
        value="STRIPE"
        label="Credit / Debit card (Stripe)"
        selected
        available
        configured
        onSelect={() => {}}
      />
    );

    expect(screen.getByText('Connected')).toBeTruthy();
    expect(screen.getByText('Credit / debit card')).toBeTruthy();
  });

  it('shows Requires setup when Stripe is selectable but not configured', () => {
    render(
      <CreateInvoicePaymentMethodOption
        value="STRIPE"
        label="Credit / Debit card (Stripe)"
        selected
        available
        configured={false}
        onSelect={() => {}}
      />
    );

    expect(screen.getByText('Requires setup')).toBeTruthy();
    expect(screen.queryByText('Connected')).toBeNull();
  });

  it('shows Requires setup when the option is unavailable and unconfigured', () => {
    render(
      <CreateInvoicePaymentMethodOption
        value="WISE"
        label="Bank transfer (Wise)"
        selected={false}
        available={false}
        configured={false}
        unavailableReason="Wise not configured"
        onSelect={() => {}}
      />
    );

    expect(screen.getByText('Requires setup')).toBeTruthy();
    expect(screen.getByText('Complete setup in Payment settings')).toBeTruthy();
    expect(screen.queryByText('Wise not configured')).toBeNull();
  });
});

describe('merchantCreateInvoicePaymentLabel', () => {
  it('uses merchant-friendly payment method titles', () => {
    expect(merchantCreateInvoicePaymentLabel('STRIPE')).toEqual({ title: 'Credit / debit card' });
    expect(merchantCreateInvoicePaymentLabel('WISE')).toEqual({
      title: 'Wise checkout',
      detail: 'Automated · pilot only',
    });
    expect(merchantCreateInvoicePaymentLabel('MANUAL_BANK')).toEqual({
      title: 'Bank transfer',
      detail: 'Manual verification · working option',
    });
    expect(merchantCreateInvoicePaymentLabel('HEDERA')).toEqual({
      title: 'Crypto',
      detail: 'HashPack · Hedera',
    });
  });
});
