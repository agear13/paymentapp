/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AgreementIntelligenceInputModal } from '@/components/journey/lovable/agreement-intelligence-input-modal';

describe('AgreementIntelligenceInputModal extraction UX', () => {
  it('shows an in-progress state without closing', () => {
    render(
      <AgreementIntelligenceInputModal
        open
        onOpenChange={() => undefined}
        submitting
        onUpload={async () => false}
        onPaste={async () => false}
      />
    );

    expect(screen.getByText('Extracting details from conversation…')).toBeInTheDocument();
    expect(
      screen.getByText('Identifying participant, referral terms and eligible services.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Extract from text' })).not.toBeInTheDocument();
  });

  it('shows a success summary with a direct review action', () => {
    const onReview = jest.fn();
    const onInvite = jest.fn();
    const onDone = jest.fn();
    render(
      <AgreementIntelligenceInputModal
        open
        onOpenChange={() => undefined}
        submitting={false}
        closeOnSuccess={false}
        onUpload={async () => true}
        onPaste={async () => true}
        onReviewParticipant={onReview}
        onDone={onDone}
        success={{
          participantId: 'p-1',
          participantName: 'Sarah',
          commission: '15% revenue share',
          eligibleServices: ['Demo booking', 'Ticket Sales – Sun Bath Festival'],
          status: 'Awaiting approval',
          nextStep:
            'Sarah needs to review and approve their agreement before their referral can be activated.',
          inviteActionLabel: 'Send Sarah an invitation →',
        }}
        onInviteParticipant={onInvite}
      />
    );

    expect(screen.getByText('Promoter created')).toBeInTheDocument();
    expect(
      screen.getByText('Sarah has been added to your Referral Management workflow.')
    ).toBeInTheDocument();
    expect(screen.getByText('15% revenue share')).toBeInTheDocument();
    expect(screen.getByText('Demo booking')).toBeInTheDocument();
    expect(screen.getByText('Ticket Sales – Sun Bath Festival')).toBeInTheDocument();
    expect(screen.getByText('Awaiting approval')).toBeInTheDocument();
    expect(screen.getByText('Next step')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Sarah needs to review and approve their agreement before their referral can be activated.'
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Send Sarah an invitation →' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review participant' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onInvite).toHaveBeenCalledTimes(1);
    expect(onReview).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('keeps the modal open and preserves pasted text when extraction fails', async () => {
    const onOpenChange = jest.fn();
    render(
      <AgreementIntelligenceInputModal
        open
        onOpenChange={onOpenChange}
        submitting={false}
        closeOnSuccess={false}
        defaultTab="paste"
        error="The extractor could not identify a referral relationship."
        onUpload={async () => false}
        onPaste={async () => false}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Paste text' }));
    const textarea = screen.getByLabelText('Agreement text');
    fireEvent.change(textarea, { target: { value: 'Sarah gets 15% of ticket sales' } });
    fireEvent.click(screen.getByRole('button', { name: 'Extract from text' }));

    await waitFor(() => {
      expect(screen.getByText('This conversation could not be extracted.')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Agreement text')).toHaveValue('Sarah gets 15% of ticket sales');
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
