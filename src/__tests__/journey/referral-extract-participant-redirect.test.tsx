/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AddPromoterForm } from '@/components/journey/lovable/referral-management-hub-screen';
import type { ReferralImportPreview } from '@/lib/workflows/referral-management/import-from-extraction';

const SERVICE = '11111111-1111-1111-1111-111111111111';

const catalog = [{ id: SERVICE, name: 'Summer Launch Package' }];

function completePreview(overrides?: Partial<ReferralImportPreview['candidates'][number]>): ReferralImportPreview {
  return {
    sourceLabel: 'Pasted agreement or conversation',
    projectName: 'Summer Launch',
    candidates: [
      {
        partyId: 'apex',
        selected: true,
        name: 'Apex Promotions',
        email: 'apex@example.com',
        phone: '',
        role: 'Promoter',
        extractedRole: 'Promoter',
        compensationKind: 'revenue_share',
        percentage: 20,
        amount: null,
        currency: 'AUD',
        extractedServiceLabel: 'Summer Launch Package',
        serviceId: SERVICE,
        serviceMatch: 'exact',
        serviceSuggestions: catalog,
        commissionLabel: '20% revenue share',
        ...overrides,
      },
    ],
    excludedParties: [],
  };
}

function renderForm(overrides?: Partial<React.ComponentProps<typeof AddPromoterForm>>) {
  const props: React.ComponentProps<typeof AddPromoterForm> = {
    catalog,
    busy: false,
    error: null,
    onSubmit: jest.fn(),
    onLookupEmail: jest.fn().mockResolvedValue(null),
    onExtract: jest.fn(),
    onImported: jest.fn(),
    onReturnedToList: jest.fn(),
    promoters: [],
    onManageServices: jest.fn(),
    onOpenExisting: jest.fn(),
    onSearchPromoters: jest.fn(),
    ...overrides,
  };
  render(<AddPromoterForm {...props} />);
  return props;
}

describe('Referral Management extraction-to-participant', () => {
  it('creates the extracted participant and navigates to that returned id', async () => {
    const preview = completePreview();
    const props = renderForm({
      onExtract: jest.fn().mockResolvedValue(preview),
      onSubmit: jest.fn().mockResolvedValue({ ok: true, participantId: 'created-from-api-9ab' }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add promoter' }));
    fireEvent.click(screen.getByRole('button', { name: 'From agreement or conversation' }));
    fireEvent.change(screen.getByLabelText('Agreement or conversation'), {
      target: { value: 'Apex Promotions receives 20% on Summer Launch Package.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Extract from text' }));

    await waitFor(() => {
      expect(props.onImported).toHaveBeenCalledWith('created-from-api-9ab');
    });
    expect(props.onReturnedToList).not.toHaveBeenCalled();
    expect(props.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'apex@example.com',
        reuseExisting: true,
      })
    );
    expect(screen.getByText('Promoter created')).toBeInTheDocument();
  });

  it('does not navigate to a generic profile when creation fails', async () => {
    const props = renderForm({
      onExtract: jest.fn().mockResolvedValue(completePreview()),
      onSubmit: jest.fn().mockResolvedValue({
        ok: false,
        error: 'Could not save the extracted participant.',
      }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add promoter' }));
    fireEvent.click(screen.getByRole('button', { name: 'From agreement or conversation' }));
    fireEvent.change(screen.getByLabelText('Agreement or conversation'), {
      target: { value: 'Apex Promotions receives 20%.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Extract from text' }));

    await waitFor(() => {
      expect(screen.getByText('Could not save the extracted participant.')).toBeInTheDocument();
    });
    expect(props.onImported).not.toHaveBeenCalled();
    expect(props.onReturnedToList).not.toHaveBeenCalled();
    expect(screen.queryByText('Promoter created')).not.toBeInTheDocument();
  });

  it('keeps a review state when extracted email is missing', async () => {
    const props = renderForm({
      onExtract: jest.fn().mockResolvedValue(completePreview({ email: '' })),
      onSubmit: jest.fn(),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add promoter' }));
    fireEvent.click(screen.getByRole('button', { name: 'From agreement or conversation' }));
    fireEvent.change(screen.getByLabelText('Agreement or conversation'), {
      target: { value: 'Apex Promotions receives 20%.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Extract from text' }));

    await waitFor(() => {
      expect(
        screen.getByText('Email is required before this referral relationship can be created.')
      ).toBeInTheDocument();
    });
    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(props.onImported).not.toHaveBeenCalled();
    expect(screen.getByText('Review extracted relationship')).toBeInTheDocument();
  });
});
