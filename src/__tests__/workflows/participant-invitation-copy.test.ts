import { nextCoordinationAction } from '@/lib/workflows/agreement-intelligence/participant-coordination';

describe('nextCoordinationAction invitation copy', () => {
  it('asks the operator to send an approval request before the invitation exists', () => {
    expect(
      nextCoordinationAction({
        agreementStatus: 'not_requested',
        payoutSetupStatus: 'required',
        referralStatus: 'ready',
        operatorApprovalRequired: true,
      })
    ).toEqual({ kind: 'request_approval', label: 'Send approval request' });
  });

  it('keeps waiting for the participant after the invitation is sent', () => {
    expect(
      nextCoordinationAction({
        agreementStatus: 'requested',
        payoutSetupStatus: 'required',
        referralStatus: 'ready',
        operatorApprovalRequired: true,
      })
    ).toEqual({ kind: 'request_approval', label: 'Awaiting participant approval' });
  });
});
