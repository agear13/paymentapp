/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { CreateInvoicePreviewSidebar } from '@/components/journey/lovable/create-invoice-preview-sidebar';
import { AccountingIntegrationNotice } from '@/components/journey/lovable/accounting-integration-notice';
import { defaultCommercialDealDraft } from '@/lib/commercial-os/commercial-deal-draft';
import { ACCOUNTING_INTEGRATION_COPY } from '@/lib/accounting/accounting-integration-copy';

const mockReadiness = {
  connection: { connected: true, tenantSelected: true },
  canSyncToAccounting: true,
  canCreateInvoice: true,
  loading: false,
  paymentAccountingStatus: 'partial' as const,
  paymentAccountingLabel: 'Partially configured',
};

jest.mock('@/hooks/use-commercial-readiness', () => ({
  useCommercialReadinessOptional: () => mockReadiness,
}));

describe('F. Create Invoice treats invoice-ready Xero as accounting connected', () => {
  it('does not show Accounting not connected / Setup incomplete when invoice accounts are ready', () => {
    render(
      <CreateInvoicePreviewSidebar
        draft={defaultCommercialDealDraft()}
        previewAmount="A$100.00"
        hasPreviewAmount
      />
    );

    expect(screen.queryByText(ACCOUNTING_INTEGRATION_COPY.notConnectedStatus)).not.toBeInTheDocument();
    expect(screen.queryByText(ACCOUNTING_INTEGRATION_COPY.setupIncompleteStatus)).not.toBeInTheDocument();
    expect(screen.getByText(ACCOUNTING_INTEGRATION_COPY.connectedStatus)).toBeInTheDocument();
    expect(
      screen.getByText(ACCOUNTING_INTEGRATION_COPY.paymentAccountingPartialNote)
    ).toBeInTheDocument();
  });

  it('shows Connected on the accounting notice while payment holdings are only partial', () => {
    render(<AccountingIntegrationNotice />);

    expect(screen.getByText(ACCOUNTING_INTEGRATION_COPY.connectedStatus)).toBeInTheDocument();
    expect(screen.queryByText(ACCOUNTING_INTEGRATION_COPY.setupIncompleteStatus)).not.toBeInTheDocument();
    expect(
      screen.getByText(ACCOUNTING_INTEGRATION_COPY.paymentAccountingPartialNote)
    ).toBeInTheDocument();
  });
});
