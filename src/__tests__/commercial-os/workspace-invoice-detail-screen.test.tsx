/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { PaymentLinkDetails } from '@/components/payment-links/payment-link-detail-dialog';
import { WorkspaceInvoiceDetailScreen } from '@/components/journey/lovable/workspace-invoice-detail-screen';

const mockDetail: PaymentLinkDetails = {
  id: 'plink-001',
  shortCode: 'Ab12Cd34',
  status: 'OPEN',
  amount: 1500,
  currency: 'AUD',
  description: 'Consulting services — March',
  invoiceReference: 'INV-2026-001',
  customerEmail: 'customer@example.com',
  customerName: 'Acme Pty Ltd',
  customerPhone: null,
  invoiceDate: new Date('2026-08-01T00:00:00Z'),
  dueDate: new Date('2026-08-31T00:00:00Z'),
  expiresAt: new Date('2026-09-30T00:00:00Z'),
  paymentMethod: 'STRIPE',
  createdAt: new Date('2026-08-13T00:00:00Z'),
  updatedAt: new Date('2026-08-13T00:00:00Z'),
};

jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useSearchParams: () => new URLSearchParams('send=1'),
}));

jest.mock('@/hooks/use-organization', () => ({
  useOrganization: () => ({ organizationId: 'org-001', isLoading: false }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/components/operational/customer-facing-origin-provider', () => ({
  usePaymentLinkUrl: () => 'https://app.example.com/pay/Ab12Cd34',
}));

jest.mock('@/hooks/use-payment-link-detail', () => ({
  usePaymentLinkDetail: () => ({
    state: {
      status: 'ready',
      paymentLinkId: mockDetail.id,
      detail: mockDetail,
      lifecycle: null,
      qrCodeUrl: null,
      cryptoConfirmation: null,
      manualBankConfirmation: null,
    },
    refresh: jest.fn(),
  }),
}));

jest.mock('@/components/payment-links/payment-links-lazy-modules', () => ({
  CreatePaymentLinkDialog: () => null,
}));

jest.mock('@/components/payment-links/payment-lifecycle-panel', () => ({
  PaymentLifecyclePanel: () => null,
}));

describe('WorkspaceInvoiceDetailScreen', () => {
  it('renders the status hero without throwing when INVOICE_DETAIL_TONE_RING is in scope', () => {
    render(
      <WorkspaceInvoiceDetailScreen
        invoiceNumber="INV-2026-001"
        paymentLinkId={mockDetail.id}
      />
    );

    expect(screen.getByText('Awaiting payment')).toBeInTheDocument();
    expect(screen.getByText('Current status')).toBeInTheDocument();
    expect(screen.getByText('Payment information')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Acme Pty Ltd' })).toBeInTheDocument();
  });
});
