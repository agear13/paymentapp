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

jest.mock('@/hooks/use-commercial-readiness', () => ({
  useCommercialReadinessOptional: () => ({
    connection: { connected: false },
    canSyncToAccounting: false,
    canCreateInvoice: false,
    loading: false,
  }),
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
  it('renders unsent invoice state without contradictory sent/sync labels', () => {
    render(
      <WorkspaceInvoiceDetailScreen
        invoiceNumber="INV-2026-001"
        paymentLinkId={mockDetail.id}
      />
    );

    expect(screen.getByText('Unsent')).toBeInTheDocument();
    expect(screen.getByText('Ready to send')).toBeInTheDocument();
    expect(screen.getByText('Send this invoice to your customer so they can view details and pay online.')).toBeInTheDocument();
    expect(screen.getAllByText('Accounting not connected').length).toBeGreaterThan(0);
    expect(screen.queryByText('Sync in progress')).not.toBeInTheDocument();
    expect(screen.queryByText('Last synced')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Acme Pty Ltd' })).toBeInTheDocument();
  });
});
