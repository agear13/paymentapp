/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { ApprovalCentreParticipantCard } from '@/components/projects/approval-centre-participant-card';

const acceptedParticipant: DemoParticipant = {
  id: 'participant-accepted',
  name: 'Accepted Supplier',
  email: 'supplier@example.com',
  role: 'Contributor',
  inviteToken: 'invite-token',
  approvalStatus: 'Approved',
  approvedAt: '2026-06-27T10:00:00.000Z',
  commissionKind: 'fixed_amount',
  commissionValue: 500,
  compensationProfile: {
    compensationType: 'FIXED_FEE',
    fixedAmount: 500,
    configured: true,
    configuredAt: '2026-06-27T09:00:00.000Z',
    revenueSources: [],
    customerAttributionEnabled: false,
    commissionSourceMode: 'all_active',
    commissionServiceIds: [],
  },
};

describe('ApprovalCentreParticipantCard payout request action', () => {
  it('shows Request Payout Details for an accepted agreement and invokes the payment request handler', () => {
    const onSendPaymentRequest = jest.fn();

    render(
      <ApprovalCentreParticipantCard
        participant={acceptedParticipant}
        onShareAgreement={jest.fn()}
        onConfigureEarnings={jest.fn()}
        onSendPaymentRequest={onSendPaymentRequest}
      />
    );

    const requestButton = screen.getByRole('button', { name: /Request Payout Details/i });
    expect(requestButton).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /View agreement/i })).not.toBeInTheDocument();

    fireEvent.click(requestButton);
    expect(onSendPaymentRequest).toHaveBeenCalledTimes(1);
    expect(onSendPaymentRequest.mock.calls[0]?.[0]).toMatchObject({
      id: 'participant-accepted',
      approvalStatus: 'Approved',
    });
  });
});
