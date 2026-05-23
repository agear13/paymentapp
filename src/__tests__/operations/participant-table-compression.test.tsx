/** @jest-environment jsdom */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { OperatorPayoutVerificationInfo } from '@/components/projects/operator-payout-verification-info';
import { ProjectParticipantTableRow } from '@/components/projects/project-participant-table-row';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { OPERATOR_PAYOUT_DISCLAIMER } from '@/lib/operations/merchant-operational-copy';

const baseParticipant: DemoParticipant = {
  id: 'p-1',
  name: 'Alex Rivera',
  email: 'alex@example.com',
  role: 'Contributor',
  commissionKind: 'fixed_amount',
  commissionValue: 500,
  status: 'Pending',
  approvalStatus: 'Pending approval',
  inviteToken: 'tok-1',
  workspaceSource: 'project',
  compensationProfile: {
    compensationType: 'FIXED_FEE',
    configured: true,
    fixedAmount: 500,
    customerAttributionEnabled: false,
    commissionSourceMode: 'all_active',
    commissionServiceIds: [],
  },
};

function renderRow(participant: DemoParticipant = baseParticipant) {
  return render(
    <table>
      <tbody>
        <ProjectParticipantTableRow
          participant={participant}
          onCopyAgreement={() => {}}
          onPayoutVerificationChange={() => {}}
          onEdit={() => {}}
          onConfigureCompensation={() => {}}
        />
      </tbody>
    </table>
  );
}

describe('compressed participant table UX', () => {
  it('renders shared payout verification info without per-row disclaimer', () => {
    const { container } = render(<OperatorPayoutVerificationInfo collapsible={false} />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/Operator payout verification/i);
    expect(text).toMatch(/Provvypay does not currently facilitate/i);
  });

  it('participant row does not repeat full compliance disclaimer', () => {
    const { container } = renderRow();
    const text = container.textContent ?? '';
    expect(text).toContain('Alex Rivera');
    expect(text).toContain('Verified externally');
    expect(text).not.toContain(OPERATOR_PAYOUT_DISCLAIMER);
  });

  it('renders stacked attribution explanation without crushing copy', () => {
    const { container } = renderRow();
    expect(container.textContent).toContain('Inactive');
    expect(container.textContent).toContain('Attribution not enabled');
  });

  it('renders stacked agreement and payout cells', () => {
    const { container } = renderRow({
      ...baseParticipant,
      payoutVerificationConfirmed: false,
    });
    expect(container.textContent).toContain('Not confirmed');
    expect(container.textContent).toContain('Ready to send to participant');
  });

  it('uses dropdown actions instead of stacked buttons', () => {
    renderRow();
    expect(screen.getByLabelText('Participant actions')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Earnings$/i })).toBeNull();
  });
});
