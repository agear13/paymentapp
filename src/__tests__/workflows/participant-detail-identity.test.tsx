/** @jest-environment jsdom */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { AgreementIntelligenceParticipantDetail } from '@/components/journey/lovable/agreement-intelligence-participant-detail';
import type { WorkflowOperationalParticipant } from '@/lib/workflows/agreement-intelligence/types';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('@/hooks/use-deployed-workflows', () => ({
  useDeployedWorkflows: () => ({ isInstalled: () => true }),
}));

function participant(
  overrides: Partial<WorkflowOperationalParticipant> = {}
): WorkflowOperationalParticipant {
  return {
    id: 'p-1',
    name: 'Apples',
    commercialRole: 'Connector',
    operationalRole: 'Connector',
    partyKind: 'compensated_participant',
    statusLabel: 'Needs setup',
    approvalStatus: 'Pending approval',
    onboardingStatus: 'INCOMPLETE',
    needsAttention: true,
    attentionReason: null,
    manageUrl: '/workspace/workflows/referral-management?participant=p-1',
    agreementStatus: 'not_requested',
    payoutSetupStatus: 'required',
    taxInformationStatus: 'required',
    referralStatus: 'ready',
    compensationKind: 'revenue_share',
    compensationLabel: '15% revenue share',
    nextActionLabel: 'Send approval request',
    nextActionKind: 'request_approval',
    missingPayoutFields: [],
    referral: null,
    eligibleServiceIds: [],
    workspaceUrl: '/participant/portal-1',
    email: 'apples@example.com',
    identityBound: false,
    lastInvitationEmail: null,
    payoutReview: null,
    ...overrides,
  };
}

describe('Referral Management participant detail identity', () => {
  it('shows the participant email on the detail page', () => {
    const { container } = render(
      <AgreementIntelligenceParticipantDetail
        participant={participant()}
        activity={[]}
        coordinationBlocked={false}
        busy={false}
        onBack={() => undefined}
        onAction={async () => true}
      />
    );

    const text = container.textContent ?? '';
    expect(text).toContain('apples@example.com');
    expect(text).toContain('Edit details');
    expect(text).toContain('Agreement ready to send');
    expect(text).toContain('Will be sent to:');
    expect(screen.getByTestId('participant-identity-email').textContent).toBe('apples@example.com');
    expect(screen.getByTestId('invitation-destination-email').textContent).toBe('apples@example.com');
  });

  it('updates the invitation destination after an email change', () => {
    const { container } = render(
      <AgreementIntelligenceParticipantDetail
        participant={participant({
          email: 'new@example.com',
          lastInvitationEmail: 'old@example.com',
          agreementStatus: 'requested',
        })}
        activity={[]}
        coordinationBlocked={false}
        busy={false}
        onBack={() => undefined}
        onAction={async () => true}
      />
    );

    const text = container.textContent ?? '';
    expect(text).toContain('new@example.com');
    expect(text).toContain('Invitation destination changed');
    expect(text).toContain('Previous invitation was sent to old@example.com');
    expect(text).toContain('Resend invitation');
    expect(screen.getByTestId('invitation-destination-email').textContent).toBe('new@example.com');
  });

  it('does not offer silent identity reassignment after sign-in', () => {
    const { container } = render(
      <AgreementIntelligenceParticipantDetail
        participant={participant({
          email: 'betty@example.com',
          identityBound: true,
          agreementStatus: 'approved',
        })}
        activity={[]}
        coordinationBlocked={false}
        busy={false}
        onBack={() => undefined}
        onAction={async () => true}
        onAddReplacement={() => undefined}
      />
    );

    const text = container.textContent ?? '';
    expect(text).toContain('Verified participant identity');
    expect(text).toContain('Add a new participant instead');
    expect(text).toContain('Edit details');
    expect(text).toContain('betty@example.com');
  });

  it('opens the existing invitation dialog when requested after extraction', () => {
    render(
      <AgreementIntelligenceParticipantDetail
        participant={participant()}
        activity={[]}
        coordinationBlocked={false}
        busy={false}
        autoOpenInvite
        onBack={() => undefined}
        onAction={async () => true}
      />
    );

    expect(screen.getByText('Send agreement to Apples')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send approval request' })).toBeTruthy();
  });
});
