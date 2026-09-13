import { checkLifecycleEligibility, sendLifecycleEmail } from '@/lib/email/lifecycle/lifecycle-service';
import type { LifecycleTriggerInput } from '@/lib/email/lifecycle/types';

describe('Lifecycle Welcome Email Eligibility', () => {
  const baseInput: LifecycleTriggerInput = {
    campaign: 'welcome',
    userId: 'user-123',
    organizationId: 'org-456',
    email: 'test@example.com',
    userName: 'Alex',
    workspaceName: 'Acme Corp',
  };

  it('allows verified user with an existing workspace', async () => {
    const result = await checkLifecycleEligibility(baseInput, {
      isUserVerifiedFn: async () => true,
      checkWorkspaceExistsFn: async () => ({ exists: true, workspaceName: 'Acme Corp' }),
      findSendRecordFn: async () => false,
    });

    expect(result).toEqual({ eligible: true });
  });

  it('excludes unverified user', async () => {
    const result = await checkLifecycleEligibility(baseInput, {
      isUserVerifiedFn: async () => false,
      checkWorkspaceExistsFn: async () => ({ exists: true }),
      findSendRecordFn: async () => false,
    });

    expect(result).toEqual({ eligible: false, reason: 'unverified_email' });
  });

  it('excludes user with no workspace', async () => {
    const result = await checkLifecycleEligibility(baseInput, {
      isUserVerifiedFn: async () => true,
      checkWorkspaceExistsFn: async () => ({ exists: false }),
      findSendRecordFn: async () => false,
    });

    expect(result).toEqual({ eligible: false, reason: 'no_workspace' });
  });

  it('excludes user when welcome was already sent (idempotency)', async () => {
    const result = await checkLifecycleEligibility(baseInput, {
      isUserVerifiedFn: async () => true,
      checkWorkspaceExistsFn: async () => ({ exists: true }),
      findSendRecordFn: async (_userId, campaign) => campaign === 'welcome',
    });

    expect(result).toEqual({ eligible: false, reason: 'already_sent' });
  });

  it('excludes user when existing-user catch-up was already sent', async () => {
    const result = await checkLifecycleEligibility(baseInput, {
      isUserVerifiedFn: async () => true,
      checkWorkspaceExistsFn: async () => ({ exists: true }),
      findSendRecordFn: async (_userId, campaign) => campaign === 'existing_user_catchup',
    });

    expect(result).toEqual({ eligible: false, reason: 'catchup_already_sent' });
  });

  it('suppresses sendLifecycleEmail without calling sendEmail when ineligible', async () => {
    let sendCalled = false;
    const sendResult = await sendLifecycleEmail(baseInput, {
      isUserVerifiedFn: async () => false,
      checkWorkspaceExistsFn: async () => ({ exists: true }),
      findSendRecordFn: async () => false,
      sendEmailFn: async () => {
        sendCalled = true;
        return { id: 'msg-1', success: true };
      },
    });

    expect(sendCalled).toBe(false);
    expect(sendResult.success).toBe(false);
    expect(sendResult.status).toBe('suppressed');
    expect(sendResult.suppressedReason).toBe('unverified_email');
  });
});
