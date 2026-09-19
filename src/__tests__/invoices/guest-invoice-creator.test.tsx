/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { GuestInvoiceCreator } from '@/components/journey/lovable/guest-invoice-creator';

const mockDownload = jest.fn();

jest.mock('@/lib/invoices/guest-invoice-pdf', () => ({
  downloadGuestInvoicePdf: (...args: unknown[]) => mockDownload(...args),
}));

describe('GuestInvoiceCreator', () => {
  beforeEach(() => {
    mockDownload.mockReset();
  });

  it('downloads a completed invoice without asking for an account', () => {
    render(<GuestInvoiceCreator />);

    fireEvent.change(screen.getByPlaceholderText('Sarah Chen'), {
      target: { value: 'Sarah Chen' },
    });
    fireEvent.change(screen.getByPlaceholderText('Campaign delivery'), {
      target: { value: 'Campaign delivery' },
    });
    fireEvent.change(screen.getByPlaceholderText('0.00'), {
      target: { value: '12000' },
    });
    fireEvent.click(screen.getByTestId('guest-invoice-download'));

    expect(mockDownload).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/create an account/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('guest-invoice-payment-link')).toHaveAttribute(
      'href',
      '/journey/assessment'
    );
  });

  it('does not download an incomplete invoice', () => {
    render(<GuestInvoiceCreator />);
    fireEvent.click(screen.getByTestId('guest-invoice-download'));
    expect(mockDownload).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Add a customer, description and amount before downloading.'
    );
  });
});
