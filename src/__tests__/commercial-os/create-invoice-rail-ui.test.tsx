/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';

import { CreateInvoicePaymentMethodOption } from '@/components/journey/lovable/create-invoice-ui';

describe('CreateInvoicePaymentMethodOption rail badge', () => {
  it('shows CONNECTED when configured even if available comes from invoiceAlwaysSelectable', () => {
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
  });

  it('shows Setup when Stripe is selectable but not configured', () => {
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

    expect(screen.getByText('Setup')).toBeTruthy();
    expect(screen.queryByText('Connected')).toBeNull();
  });

  it('shows Setup when the option is unavailable and unconfigured', () => {
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

    expect(screen.getByText('Setup')).toBeTruthy();
    expect(screen.getByText('Wise not configured')).toBeTruthy();
  });
});
