/** @jest-environment jsdom */

import * as React from 'react';
import { render } from '@testing-library/react';
import { ProjectParticipantTableRow } from '@/components/projects/project-participant-table-row';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

function catalogParticipant(): DemoParticipant {
  return {
    id: 'p-cat',
    name: 'Alex Rivera',
    email: 'alex@example.com',
    role: 'Contributor',
    commissionKind: 'pct_deal_value',
    commissionValue: 10,
    status: 'Pending',
    approvalStatus: 'Pending approval',
    inviteToken: 'tok-1',
    workspaceSource: 'project',
    participationModel: 'customer_attribution',
    compensationProfile: {
      compensationType: 'COMMISSION',
      configured: true,
      percentage: 10,
      customerAttributionEnabled: true,
      commissionSourceMode: 'selected',
      commissionServiceIds: ['svc-early'],
    },
    referralCommerce: {
      commissionMode: 'referral_commerce',
      commerceCommissionPct: 10,
      enabledServiceIds: ['svc-early'],
    },
  } as DemoParticipant;
}

function renderRow(participant: DemoParticipant, catalogItems?: Array<{ id: string; name: string }>) {
  return render(
    <table>
      <tbody>
        <ProjectParticipantTableRow
          participant={participant}
          catalogContext={{ catalogItems }}
          onCopyAgreement={() => {}}
          onEdit={() => {}}
          onConfigureCompensation={() => {}}
        />
      </tbody>
    </table>
  );
}

describe('participant table earnings semantics', () => {
  it('shows catalog commission primary label instead of revenue share', () => {
    const { container } = renderRow(catalogParticipant(), [
      { id: 'svc-early', name: 'Early Bird Tickets' },
    ]);
    const text = container.textContent ?? '';
    expect(text).toContain('10% catalog');
    expect(text).not.toMatch(/revenue share/i);
    expect(text).not.toMatch(/deal value/i);
  });

  it('truncates long eligible service lists in earnings primary label', () => {
    const participant = catalogParticipant();
    participant.compensationProfile = {
      ...participant.compensationProfile!,
      commissionServiceIds: ['svc-1', 'svc-2', 'svc-3'],
    };
    participant.referralCommerce = {
      commissionMode: 'referral_commerce',
      commerceCommissionPct: 10,
      enabledServiceIds: ['svc-1', 'svc-2', 'svc-3'],
    };
    const { container } = renderRow(participant, [
      { id: 'svc-1', name: 'Early Bird Tickets' },
      { id: 'svc-2', name: 'VIP Package' },
      { id: 'svc-3', name: 'Merch Bundle' },
    ]);
    expect(container.textContent).toContain('10% catalog');
  });

  it('shows project revenue share for true revenue share participants', () => {
    const participant: DemoParticipant = {
      id: 'p-rev',
      name: 'Sam',
      email: 'sam@example.com',
      role: 'Closer',
      commissionKind: 'pct_deal_value',
      commissionValue: 12,
      status: 'Pending',
      approvalStatus: 'Pending approval',
      inviteToken: 'tok-2',
      participationModel: 'revenue_share',
      compensationProfile: {
        compensationType: 'REVENUE_SHARE',
        configured: true,
        percentage: 12,
        customerAttributionEnabled: false,
      },
    };
    const { container } = renderRow(participant);
    expect(container.textContent).toContain('12% revenue share');
  });
});
