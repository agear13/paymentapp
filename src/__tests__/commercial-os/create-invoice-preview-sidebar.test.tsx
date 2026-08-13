/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { CreateInvoicePreviewSidebar } from '@/components/journey/lovable/create-invoice-preview-sidebar';
import { defaultCommercialDealDraft } from '@/lib/commercial-os/commercial-deal-draft';

jest.mock('@/hooks/use-commercial-readiness', () => ({
  useCommercialReadinessOptional: () => ({
    connection: { connected: false },
    canSyncToAccounting: false,
    canCreateInvoice: false,
    loading: false,
  }),
}));

describe('CreateInvoicePreviewSidebar', () => {
  it('shows a neutral amount placeholder before an amount is entered', () => {
    render(
      <CreateInvoicePreviewSidebar
        draft={defaultCommercialDealDraft()}
        previewAmount="Add amount"
        hasPreviewAmount={false}
      />
    );

    expect(screen.getByText('Add amount')).toBeInTheDocument();
    expect(screen.queryByText('A$0.00')).not.toBeInTheDocument();
  });

  it('does not show commercial readiness infrastructure', () => {
    render(
      <CreateInvoicePreviewSidebar
        draft={defaultCommercialDealDraft()}
        previewAmount="Add amount"
        hasPreviewAmount={false}
      />
    );

    expect(screen.queryByText(/Commercial readiness/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Connected systems/i)).not.toBeInTheDocument();
  });
});
