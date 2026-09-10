/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ReferralImportReview } from '@/components/journey/lovable/referral-import-review';
import type { ReferralImportPreview } from '@/lib/workflows/referral-management/import-from-extraction';

const SERVICE = '11111111-1111-1111-1111-111111111111';

function preview(overrides?: Partial<ReferralImportPreview['candidates'][number]>): ReferralImportPreview {
  return {
    sourceLabel: 'Pasted agreement or conversation',
    projectName: 'Weso affiliate',
    candidates: [
      {
        partyId: 'jane',
        selected: true,
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '',
        role: 'Affiliate',
        extractedRole: 'Affiliate / Content Creator',
        compensationKind: 'revenue_share',
        percentage: 2,
        amount: null,
        currency: 'AUD',
        extractedServiceLabel: 'Promote Weso app using a unique discount code',
        serviceId: null,
        serviceMatch: 'none',
        serviceSuggestions: [],
        commissionLabel: '2% revenue share',
        earningSourceType: 'external',
        externalProvider: 'Weso',
        externalService: 'Weso app',
        attributionMethod: 'discount_code',
        integration: '',
        audienceDiscountPct: 10,
        ...overrides,
      },
    ],
    excludedParties: [],
  };
}

describe('ReferralImportReview earning source', () => {
  it('reviews an external relationship without requiring a catalogue service', () => {
    const onConfirm = jest.fn();
    render(
      <ReferralImportReview
        preview={preview()}
        catalog={[{ id: SERVICE, name: 'Summer Launch Package', description: '', price: 0, currency: 'AUD' }]}
        busy={false}
        error={null}
        onChange={jest.fn()}
        onConfirm={onConfirm}
        onBack={jest.fn()}
      />
    );

    expect(screen.getByText('What does this affiliate earn on?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'External platform / service' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByLabelText('External platform')).toHaveValue('Weso');
    expect(screen.getByLabelText('External earning source')).toHaveValue('Weso app');
    expect(screen.getByLabelText('Attribution method')).toHaveValue('discount_code');
    expect(screen.getByLabelText('Commission percentage')).toHaveValue(2);
    expect(screen.getByLabelText('Extracted role')).toHaveValue('Affiliate / Content Creator');
    expect(screen.getByLabelText('Audience discount')).toHaveValue(10);
    expect(screen.queryByLabelText('Catalogue service')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Confirm 1 relationship/ }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('keeps the catalogue selector when Provvy service is selected', () => {
    render(
      <ReferralImportReview
        preview={preview({
          earningSourceType: 'internal_service',
          serviceId: SERVICE,
          serviceMatch: 'exact',
          externalProvider: '',
          externalService: '',
          attributionMethod: null,
        })}
        catalog={[{ id: SERVICE, name: 'Summer Launch Package', description: '', price: 0, currency: 'AUD' }]}
        busy={false}
        error={null}
        onChange={jest.fn()}
        onConfirm={jest.fn()}
        onBack={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Provvy service' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Catalogue service')).toHaveValue(SERVICE);
    expect(screen.queryByLabelText('External platform')).not.toBeInTheDocument();
  });
});
