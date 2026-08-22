import {
  referralPromoterLifecycleLabel,
  referralPromoterLifecycleStage,
  referralPromoterNextActionCopy,
} from '@/lib/workflows/referral-management/lifecycle';

describe('referral promoter lifecycle stage', () => {
  it('maps existing coordination fields onto the operator-facing stages', () => {
    expect(
      referralPromoterLifecycleLabel(
        referralPromoterLifecycleStage({
          agreementStatus: 'not_requested',
          payoutSetupStatus: 'required',
          referralStatus: 'ready',
        })
      )
    ).toBe('Awaiting approval');
    expect(
      referralPromoterLifecycleLabel(
        referralPromoterLifecycleStage({
          agreementStatus: 'requested',
          payoutSetupStatus: 'required',
          referralStatus: 'ready',
        })
      )
    ).toBe('Invitation sent');
    expect(
      referralPromoterLifecycleLabel(
        referralPromoterLifecycleStage({
          agreementStatus: 'approved',
          payoutSetupStatus: 'required',
          referralStatus: 'ready',
        })
      )
    ).toBe('Payout details required');
    expect(
      referralPromoterLifecycleLabel(
        referralPromoterLifecycleStage({
          agreementStatus: 'approved',
          payoutSetupStatus: 'complete',
          referralStatus: 'ready',
        })
      )
    ).toBe('Ready to activate');
    expect(
      referralPromoterLifecycleLabel(
        referralPromoterLifecycleStage({
          agreementStatus: 'approved',
          payoutSetupStatus: 'complete',
          referralStatus: 'active',
        })
      )
    ).toBe('Active');
  });

  it('uses invitation wording for the first operator action', () => {
    expect(
      referralPromoterNextActionCopy({
        nextActionKind: 'request_approval',
        nextActionLabel: 'Send approval request',
        agreementStatus: 'not_requested',
      })
    ).toBe('Send invitation');
    expect(
      referralPromoterNextActionCopy({
        nextActionKind: 'request_approval',
        nextActionLabel: 'Awaiting participant approval',
        agreementStatus: 'requested',
      })
    ).toBe('Awaiting approval');
  });
});
