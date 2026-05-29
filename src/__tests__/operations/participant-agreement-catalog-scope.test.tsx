/** @jest-environment jsdom */

import * as React from 'react';
import { render } from '@testing-library/react';
import { ParticipantAttributionAgreementSummary } from '@/components/projects/participant-attribution-agreement-summary';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { applyCompensationProfileToParticipant } from '@/lib/participants/participant-compensation';

const participant: DemoParticipant = {
  id: 'p-1',
  name: 'Alex',
  email: 'alex@example.com',
  role: 'Contributor',
  commissionKind: 'pct_deal_value',
  commissionValue: 10,
  status: 'Pending',
  approvalStatus: 'Approved',
  inviteToken: 'tok',
  compensationProfile: {
    compensationType: 'COMMISSION',
    configured: true,
    percentage: 10,
    customerAttributionEnabled: true,
    commissionSourceMode: 'selected',
    commissionServiceIds: ['svc-1', 'svc-2'],
  },
  referralCommerce: {
    commissionMode: 'referral_commerce',
    commerceCommissionPct: 10,
    enabledServiceIds: ['svc-1', 'svc-2'],
  },
};

describe('participant agreement catalog scope', () => {
  it('lists eligible services in agreement summary', () => {
    const { container } = render(
      <ParticipantAttributionAgreementSummary
        participant={participant}
        commerce={participant.referralCommerce}
        approved
        catalogItems={[
          { id: 'svc-1', name: 'Early Bird Tickets' },
          { id: 'svc-2', name: 'VIP Package' },
        ]}
        serviceRows={[
          {
            id: 'svc-1',
            name: 'Early Bird Tickets',
            customerPrice: 100,
            currency: 'AUD',
            revenueSharePct: 10,
            estimatedEarnings: 10,
            earningsLabel: 'A$10.00',
          },
          {
            id: 'svc-2',
            name: 'VIP Package',
            customerPrice: 200,
            currency: 'AUD',
            revenueSharePct: 10,
            estimatedEarnings: 20,
            earningsLabel: 'A$20.00',
          },
        ]}
      />
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Early Bird Tickets');
    expect(text).toContain('VIP Package');
    expect(text).toContain('qualifying catalog purchases');
    expect(text).not.toMatch(/total deal value/i);
  });

  it('shows all active catalog copy when no specific services selected', () => {
    const { container } = render(
      <ParticipantAttributionAgreementSummary
        participant={{
          ...participant,
          compensationProfile: {
            ...participant.compensationProfile!,
            commissionSourceMode: 'all_active',
            commissionServiceIds: [],
          },
        }}
        commerce={{
          commissionMode: 'referral_commerce',
          commerceCommissionPct: 10,
          enabledServiceIds: [],
        }}
        approved
        allServicesNote
      />
    );
    expect(container.textContent).toContain('All active catalog items available to customers');
  });

  it('lists eligible services in agreement summary before approval', () => {
    const { container } = render(
      <ParticipantAttributionAgreementSummary
        participant={participant}
        commerce={participant.referralCommerce}
        approved={false}
        catalogItems={[
          { id: 'svc-1', name: 'Early Bird Tickets' },
          { id: 'svc-2', name: 'VIP Package' },
        ]}
        serviceRows={[
          {
            id: 'svc-1',
            name: 'Early Bird Tickets',
            customerPrice: 100,
            currency: 'AUD',
            revenueSharePct: 10,
            estimatedEarnings: 10,
            earningsLabel: 'A$10.00',
          },
        ]}
      />
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Early Bird Tickets');
    expect(text).toContain('10% commission');
    expect(text).toContain('activate after you approve');
    expect(text).not.toContain('Active tracking is enabled');
  });

  it('shows hybrid attribution in agreement summary without referralCommerce object', () => {
    const hybrid = applyCompensationProfileToParticipant(
      {
        ...participant,
        referralCommerce: undefined,
      } as DemoParticipant,
      {
        compensationType: 'HYBRID',
        configured: true,
        percentage: 8,
        fixedAmount: 500,
        customerAttributionEnabled: true,
        commissionSourceMode: 'selected',
        commissionServiceIds: ['svc-1'],
        revenueSources: [],
      }
    );
    const { container } = render(
      <ParticipantAttributionAgreementSummary
        participant={hybrid}
        approved
        catalogItems={[{ id: 'svc-1', name: 'Early Bird Tickets' }]}
      />
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Customer attribution');
    expect(text).toContain('8% commission');
    expect(text).not.toContain('$8');
    expect(text).not.toContain('does not earn from customer purchases');
  });
});
