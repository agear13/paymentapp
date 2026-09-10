/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AddPromoterForm } from '@/components/journey/lovable/referral-management-hub-screen';

const SERVICE = '11111111-1111-1111-1111-111111111111';
const catalog = [{ id: SERVICE, name: 'Summer Launch Package' }];

function renderForm(overrides?: Partial<React.ComponentProps<typeof AddPromoterForm>>) {
  const props: React.ComponentProps<typeof AddPromoterForm> = {
    catalog,
    busy: false,
    error: null,
    onSubmit: jest.fn().mockResolvedValue({ ok: true, participantId: 'p-1' }),
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

function openManual() {
  fireEvent.click(screen.getByRole('button', { name: 'Add promoter' }));
  fireEvent.click(screen.getByRole('button', { name: 'Manually add' }));
}

describe('Referral Management manual add promoter', () => {
  it('creates an internal Provvy-service promoter with the existing catalogue selector', async () => {
    const props = renderForm();
    openManual();

    expect(screen.getByText('What does this affiliate earn on?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Provvy service' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Eligible services')).toBeInTheDocument();
    expect(screen.queryByLabelText('External platform')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Promoter name'), { target: { value: 'Apex Promotions' } });
    fireEvent.change(screen.getByPlaceholderText(/Email \(optional/), {
      target: { value: 'apex@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Commission percentage'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save promoter' }));

    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledWith({
        name: 'Apex Promotions',
        email: 'apex@example.com',
        phone: undefined,
        role: 'Promoter',
        roleLabel: undefined,
        compensation: {
          kind: 'revenue_share',
          percentage: 20,
          serviceIds: [SERVICE],
          earningSource: { type: 'internal_service' },
        },
      });
    });
    expect(props.onImported).toHaveBeenCalledWith('p-1');
  });

  it('lets Danielle create Rachel as a Weso external affiliate without a catalogue service', async () => {
    const props = renderForm({
      catalog: [],
      onSubmit: jest.fn().mockResolvedValue({ ok: true, participantId: 'p-rachel' }),
    });
    openManual();

    fireEvent.click(screen.getByRole('button', { name: 'External platform / service' }));
    expect(screen.getByRole('button', { name: 'External platform / service' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.queryByText('Eligible services')).not.toBeInTheDocument();
    expect(screen.queryByText(/Add an active service before creating a promoter/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Promoter name'), { target: { value: 'Rachel Smith' } });
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'Affiliate' } });
    fireEvent.change(screen.getByLabelText('Role label'), { target: { value: 'Community Organiser' } });
    fireEvent.change(screen.getByLabelText('External platform'), { target: { value: 'Weso' } });
    fireEvent.change(screen.getByLabelText('External earning source'), {
      target: { value: 'Weso App Store' },
    });
    fireEvent.change(screen.getByLabelText('Attribution method'), { target: { value: 'discount_code' } });
    fireEvent.change(screen.getByLabelText('Audience discount'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Commission percentage'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save promoter' }));

    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledWith({
        name: 'Rachel Smith',
        email: undefined,
        phone: undefined,
        role: 'Affiliate',
        roleLabel: 'Community Organiser',
        compensation: {
          kind: 'revenue_share',
          percentage: 2,
          earningSource: {
            type: 'external',
            externalProvider: 'Weso',
            externalService: 'Weso App Store',
            attributionMethod: 'discount_code',
            audienceDiscountPct: 10,
          },
        },
      });
    });
    expect(props.onSubmit.mock.calls[0][0].compensation.serviceIds).toBeUndefined();
    expect(props.onImported).toHaveBeenCalledWith('p-rachel');
  });

  it('keeps the catalogue-required empty state on the Provvy-service path', () => {
    const props = renderForm({ catalog: [] });
    openManual();

    expect(screen.getByText(/Add an active service before creating a promoter/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save promoter' }));
    expect(props.onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Manage services' }));
    expect(props.onManageServices).toHaveBeenCalled();
  });
});
