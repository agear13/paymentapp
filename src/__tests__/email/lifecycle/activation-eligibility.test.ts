import { checkLifecycleEligibility, sendLifecycleEmail } from '@/lib/email/lifecycle/lifecycle-service';
import type { LifecycleTriggerInput } from '@/lib/email/lifecycle/types';

const mockFindWorkspaceMembership = jest.fn();

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    user_organizations: {
      findFirst: (...args: unknown[]) => mockFindWorkspaceMembership(...args),
    },
  },
}));

describe('Lifecycle Activation Email Eligibility', () => {
  const baseInput: LifecycleTriggerInput = {
    campaign: 'activation',
    userId: 'user-activation-1',
    email: 'new.user@example.com',
    userName: 'Alex',
  };

  beforeEach(() => {
    mockFindWorkspaceMembership.mockReset();
    mockFindWorkspaceMembership.mockResolvedValue(null);
  });

  it('allows a verified user with no workspace and no organizationId', async () => {
    const result = await checkLifecycleEligibility(baseInput, {
      isUserVerifiedFn: async () => true,
      findSendRecordFn: async () => false,
      checkWorkspaceExistsFn: async () => {
        throw new Error('checkWorkspaceExistsFn must not run for activation');
      },
    });

    expect(result).toEqual({ eligible: true });
    expect(mockFindWorkspaceMembership).toHaveBeenCalledWith({
      where: { user_id: 'user-activation-1' },
      select: { organization_id: true },
    });
  });

  it('excludes an unverified user before the workspace membership check', async () => {
    const result = await checkLifecycleEligibility(baseInput, {
      isUserVerifiedFn: async () => false,
      findSendRecordFn: async () => false,
    });

    expect(result).toEqual({ eligible: false, reason: 'unverified_email' });
    expect(mockFindWorkspaceMembership).not.toHaveBeenCalled();
  });

  it('excludes a user who already belongs to any workspace', async () => {
    mockFindWorkspaceMembership.mockResolvedValue({ organization_id: 'org-existing' });

    const result = await checkLifecycleEligibility(baseInput, {
      isUserVerifiedFn: async () => true,
      findSendRecordFn: async () => false,
    });

    expect(result).toEqual({ eligible: false, reason: 'workspace_already_exists' });
  });

  it('excludes a user when activation was already sent', async () => {
    const result = await checkLifecycleEligibility(baseInput, {
      isUserVerifiedFn: async () => true,
      findSendRecordFn: async (_userId, campaign) => campaign === 'activation',
    });

    expect(result).toEqual({ eligible: false, reason: 'already_sent' });
  });

  it('suppresses sendLifecycleEmail without calling sendEmail when ineligible', async () => {
    let sendCalled = false;
    const sendResult = await sendLifecycleEmail(baseInput, {
      isUserVerifiedFn: async () => true,
      findSendRecordFn: async () => true,
      sendEmailFn: async () => {
        sendCalled = true;
        return { id: 'msg-1', success: true };
      },
    });

    expect(sendCalled).toBe(false);
    expect(sendResult.success).toBe(false);
    expect(sendResult.status).toBe('suppressed');
    expect(sendResult.suppressedReason).toBe('already_sent');
  });
});
