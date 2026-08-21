/** @jest-environment jsdom */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ExistingPromoterDuplicateCard } from '@/components/journey/lovable/existing-promoter-duplicate-card';
import {
  buildExistingPromoterRelationship,
  findExistingPromoterByEmail,
} from '@/lib/workflows/referral-management/promoter-duplicate';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

describe('existing promoter duplicate card', () => {
  const existing = {
    participantId: 'p-jenny',
    name: 'Jenny',
    email: 'alishajayne13@gmail.com',
    role: 'Promoter',
    statusLabel: 'Needs setup',
    compensationLabel: '20% revenue share',
    serviceSummary: 'Summer Launch Party',
    manageUrl: '/workspace/workflows/referral-management?participant=p-jenny',
  };

  it('shows the existing relationship and makes open-existing the primary action', () => {
    const onOpenExisting = jest.fn();
    const onSearchPromoters = jest.fn();
    render(
      <ExistingPromoterDuplicateCard
        existing={existing}
        onOpenExisting={onOpenExisting}
        onSearchPromoters={onSearchPromoters}
      />
    );

    expect(screen.getByText('Existing relationship found')).toBeTruthy();
    expect(screen.getByText('Jenny')).toBeTruthy();
    expect(screen.getByText('alishajayne13@gmail.com')).toBeTruthy();
    expect(screen.getByText('Promoter')).toBeTruthy();
    expect(screen.getByText('20% revenue share · Summer Launch Party')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Open existing relationship →' }));
    expect(onOpenExisting).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Search promoters' }));
    expect(onSearchPromoters).toHaveBeenCalledTimes(1);
  });

  it('builds a manage URL for the existing promoter instead of asking the operator to search', () => {
    const participant = {
      id: 'p-jenny',
      name: 'Jenny',
      email: 'alishajayne13@gmail.com',
      role: 'Promoter',
      commissionKind: 'pct_deal_value',
      commissionValue: 20,
      approvalStatus: 'Pending approval',
      compensationProfile: {
        compensationType: 'REVENUE_SHARE',
        percentage: 20,
        configured: true,
        configuredAt: '2026-08-21T00:00:00.000Z',
        commissionServiceIds: ['svc-1'],
        commissionSourceMode: 'selected',
        customerAttributionEnabled: true,
        revenueSources: [],
      },
    } as DemoParticipant;

    expect(
      buildExistingPromoterRelationship(participant, [{ id: 'svc-1', name: 'Summer Launch Party' }])
    ).toMatchObject({
      participantId: 'p-jenny',
      name: 'Jenny',
      email: 'alishajayne13@gmail.com',
      role: 'Promoter',
      manageUrl: '/workspace/workflows/referral-management?participant=p-jenny',
    });
    expect(
      findExistingPromoterByEmail([{ email: 'alishajayne13@gmail.com' }], '  ALISHAJAYNE13@gmail.com ')
    ).toEqual({ email: 'alishajayne13@gmail.com' });
  });
});
