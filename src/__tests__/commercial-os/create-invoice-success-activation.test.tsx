/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { CreateInvoiceSuccess } from '@/components/journey/lovable/create-invoice-success';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { ordinaryWorkspaceCreateInvoiceHref } from '@/lib/invoices/participant-activation-analytics';

jest.mock('@/hooks/use-commercial-readiness', () => ({
  useCommercialReadinessOptional: () => null,
}));

jest.mock('@/lib/invoices/participant-activation-analytics', () => {
  const actual = jest.requireActual('@/lib/invoices/participant-activation-analytics') as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    trackParticipantInvoiceActivation: jest.fn(),
  };
});

const CREATED = {
  id: 'pl-sarah-1',
  invoiceReference: 'INV-1042',
  shortCode: 'abcd1234',
  amount: 6000,
  currency: 'AUD',
};

describe('CreateInvoiceSuccess', () => {
  it('shows the workspace-ready beat when the server stamped participant_portal origin', () => {
    render(
      <CreateInvoiceSuccess
        created={{ ...CREATED, invoiceOrigin: 'participant_portal' }}
        onCopyLink={() => undefined}
        copied={false}
        organizationId="org-sarah-converted"
      />
    );

    expect(screen.getByTestId('participant-invoice-activation-success')).toBeInTheDocument();
    expect(screen.getByText('Your workspace is ready')).toBeInTheDocument();
    expect(
      screen.getByText(/create and manage invoices for your other work/i)
    ).toBeInTheDocument();
    const another = screen.getByTestId('create-another-invoice');
    expect(another).toHaveAttribute('href', ordinaryWorkspaceCreateInvoiceHref());
    expect(another.getAttribute('href')).toBe(COMMERCIAL_OS_ROUTES.createInvoice);
    expect(another.getAttribute('href')).not.toContain('origin=');
    expect(another.getAttribute('href')).not.toContain('sourceParticipantId');
    expect(screen.getByText('Send invoice')).toBeInTheDocument();
    expect(screen.getByText('Open invoice')).toBeInTheDocument();
    expect(screen.getByText('Return to workspace')).toBeInTheDocument();
    expect(screen.queryByText(/new workspace/i)).not.toBeInTheDocument();
  });

  it('keeps ordinary workspace invoice success unchanged', () => {
    render(
      <CreateInvoiceSuccess
        created={CREATED}
        onCopyLink={() => undefined}
        copied={false}
      />
    );

    expect(screen.getByTestId('create-invoice-success')).toBeInTheDocument();
    expect(screen.queryByTestId('participant-invoice-activation-success')).not.toBeInTheDocument();
    expect(screen.queryByTestId('create-another-invoice')).not.toBeInTheDocument();
    expect(screen.queryByText('Your workspace is ready')).not.toBeInTheDocument();
    expect(screen.getByText('Next recommended action')).toBeInTheDocument();
    expect(screen.getByText(/Send this invoice to your customer/i)).toBeInTheDocument();
  });

  it('does not treat a conversation or missing origin as activation', () => {
    render(
      <CreateInvoiceSuccess
        created={{ ...CREATED, invoiceOrigin: null }}
        onCopyLink={() => undefined}
        copied={false}
      />
    );

    expect(screen.getByTestId('create-invoice-success')).toBeInTheDocument();
    expect(screen.queryByTestId('create-another-invoice')).not.toBeInTheDocument();
  });

  it('does not activate from a client-only origin query — only the create response origin', () => {
    render(
      <CreateInvoiceSuccess
        created={CREATED}
        onCopyLink={() => undefined}
        copied={false}
      />
    );
    expect(screen.queryByText('Your workspace is ready')).not.toBeInTheDocument();
  });
});
