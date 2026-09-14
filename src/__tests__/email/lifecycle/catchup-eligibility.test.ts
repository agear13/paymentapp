import {
  isCatchupExcludedEmail,
  parseCatchupExcludedEmails,
  runExistingUserCatchupDryRun,
} from '@/lib/email/lifecycle/catchup-dry-run';
import type { UserCandidate } from '@/lib/email/lifecycle/catchup-dry-run';
import { checkLifecycleEligibility, sendLifecycleEmail } from '@/lib/email/lifecycle/lifecycle-service';
import type { LifecycleTriggerInput } from '@/lib/email/lifecycle/types';

describe('Existing User Catch-Up Eligibility & Dry Run', () => {
  const mockUsers: UserCandidate[] = [
    {
      id: 'user-eligible-1',
      email: 'verified.with.org@example.com',
      emailConfirmedAt: '2026-01-15T00:00:00.000Z',
      createdAt: '2026-01-14T00:00:00.000Z',
    },
    {
      id: 'user-unverified-2',
      email: 'unverified@example.com',
      emailConfirmedAt: null,
      createdAt: '2026-01-14T00:00:00.000Z',
    },
    {
      id: 'user-noworkspace-3',
      email: 'no.org@example.com',
      emailConfirmedAt: '2026-01-15T00:00:00.000Z',
      createdAt: '2026-01-14T00:00:00.000Z',
    },
    {
      id: 'user-welcomesent-4',
      email: 'already.welcomed@example.com',
      emailConfirmedAt: '2026-01-15T00:00:00.000Z',
      createdAt: '2026-01-14T00:00:00.000Z',
    },
    {
      id: 'user-catchupsent-5',
      email: 'already.catchup@example.com',
      emailConfirmedAt: '2026-01-15T00:00:00.000Z',
      createdAt: '2026-01-14T00:00:00.000Z',
    },
    {
      id: 'user-invalid-6',
      email: 'not-an-email',
      emailConfirmedAt: '2026-01-15T00:00:00.000Z',
      createdAt: '2026-01-14T00:00:00.000Z',
    },
    {
      id: 'user-internal-7',
      email: 'qa@provvypay.test',
      emailConfirmedAt: '2026-01-15T00:00:00.000Z',
      createdAt: '2026-01-14T00:00:00.000Z',
    },
  ];

  const dryRunDeps = {
    listUsersFn: async () => mockUsers,
    getUserWorkspacesFn: async (userId: string) => {
      if (userId === 'user-noworkspace-3') return [];
      return [{ organizationId: `org-${userId}`, workspaceName: `Workspace ${userId}` }];
    },
    hasPriorSendFn: async (userId: string, campaign: string) => {
      if (userId === 'user-welcomesent-4' && campaign === 'welcome') return true;
      if (userId === 'user-catchupsent-5' && campaign === 'existing_user_catchup') return true;
      return false;
    },
    isExcludedEmailFn: (email: string) =>
      isCatchupExcludedEmail(email, parseCatchupExcludedEmails('qa@provvypay.test,@internal.test')),
  };

  it('correctly classifies users and excludes ineligible accounts in dry run', async () => {
    const report = await runExistingUserCatchupDryRun(dryRunDeps);

    expect(report.dryRun).toBe(true);
    expect(report.totalExamined).toBe(7);
    expect(report.totalEligible).toBe(1);
    expect(report.totalExcluded).toBe(6);

    expect(report.exclusionBreakdown).toEqual({
      invalid_email: 1,
      excluded_email: 1,
      unverified_email: 1,
      no_workspace: 1,
      welcome_already_sent: 1,
      catchup_already_sent: 1,
    });

    const eligible = report.candidates.find((c) => c.userId === 'user-eligible-1');
    expect(eligible?.status).toBe('eligible');
    expect(eligible?.workspaceName).toBe('Workspace user-eligible-1');
    expect(eligible?.email).toContain('***');

    expect(report.candidates.find((c) => c.userId === 'user-unverified-2')?.reason).toBe(
      'unverified_email'
    );
    expect(report.candidates.find((c) => c.userId === 'user-noworkspace-3')?.reason).toBe(
      'no_workspace'
    );
    expect(report.candidates.find((c) => c.userId === 'user-welcomesent-4')?.reason).toBe(
      'welcome_already_sent'
    );
    expect(report.candidates.find((c) => c.userId === 'user-catchupsent-5')?.reason).toBe(
      'catchup_already_sent'
    );
    expect(report.candidates.find((c) => c.userId === 'user-invalid-6')?.reason).toBe('invalid_email');
    expect(report.candidates.find((c) => c.userId === 'user-internal-7')?.reason).toBe(
      'excluded_email'
    );
  });

  it('does not send email during dry run', async () => {
    const report = await runExistingUserCatchupDryRun(dryRunDeps);
    expect(report.dryRun).toBe(true);
    expect(report).not.toHaveProperty('totalSent');
  });
});

describe('Lifecycle catch-up eligibility via sendLifecycleEmail', () => {
  const originalCatchupExclusions = process.env.LIFECYCLE_CATCHUP_EXCLUDED_EMAILS;
  const baseInput: LifecycleTriggerInput = {
    campaign: 'existing_user_catchup',
    userId: 'user-catchup-1',
    organizationId: 'org-catchup-1',
    email: 'existing@example.com',
    userName: 'Alex',
    workspaceName: 'Acme',
  };

  const eligibleDeps = {
    isUserVerifiedFn: async () => true,
    checkWorkspaceExistsFn: async () => ({ exists: true, workspaceName: 'Acme' }),
    findSendRecordFn: async () => false,
  };

  afterEach(() => {
    if (originalCatchupExclusions === undefined) {
      delete process.env.LIFECYCLE_CATCHUP_EXCLUDED_EMAILS;
    } else {
      process.env.LIFECYCLE_CATCHUP_EXCLUDED_EMAILS = originalCatchupExclusions;
    }
  });

  it('allows a verified user with a workspace and no prior Welcome or catch-up', async () => {
    const result = await checkLifecycleEligibility(baseInput, {
      isUserVerifiedFn: async () => true,
      checkWorkspaceExistsFn: async () => ({ exists: true, workspaceName: 'Acme' }),
      findSendRecordFn: async () => false,
    });
    expect(result).toEqual({ eligible: true });
  });

  it('suppresses unverified users', async () => {
    const result = await checkLifecycleEligibility(baseInput, {
      isUserVerifiedFn: async () => false,
      checkWorkspaceExistsFn: async () => ({ exists: true }),
      findSendRecordFn: async () => false,
    });
    expect(result).toEqual({ eligible: false, reason: 'unverified_email' });
  });

  it('suppresses users with no workspace', async () => {
    const result = await checkLifecycleEligibility(baseInput, {
      isUserVerifiedFn: async () => true,
      checkWorkspaceExistsFn: async () => ({ exists: false }),
      findSendRecordFn: async () => false,
    });
    expect(result).toEqual({ eligible: false, reason: 'no_workspace' });
  });

  it('suppresses invalid email', async () => {
    const result = await checkLifecycleEligibility(
      { ...baseInput, email: 'not-an-email' },
      {
        isUserVerifiedFn: async () => true,
        checkWorkspaceExistsFn: async () => ({ exists: true }),
        findSendRecordFn: async () => false,
      }
    );
    expect(result).toEqual({ eligible: false, reason: 'invalid_email' });
  });

  it('does not dispatch an exactly excluded catch-up recipient', async () => {
    process.env.LIFECYCLE_CATCHUP_EXCLUDED_EMAILS = 'blocked@example.test';
    const sendEmailFn = jest.fn();

    const result = await sendLifecycleEmail(
      { ...baseInput, email: 'blocked@example.test' },
      { ...eligibleDeps, sendEmailFn }
    );

    expect(result).toMatchObject({ status: 'suppressed', suppressedReason: 'excluded_email' });
    expect(sendEmailFn).not.toHaveBeenCalled();
  });

  it('does not dispatch a catch-up recipient excluded by domain', async () => {
    process.env.LIFECYCLE_CATCHUP_EXCLUDED_EMAILS = '@provvypay.com';
    const sendEmailFn = jest.fn();

    const result = await sendLifecycleEmail(
      { ...baseInput, email: 'team@provvypay.com' },
      { ...eligibleDeps, sendEmailFn }
    );

    expect(result).toMatchObject({ status: 'suppressed', suppressedReason: 'excluded_email' });
    expect(sendEmailFn).not.toHaveBeenCalled();
  });

  it('suppresses an excluded recipient during the final send recheck after an earlier eligible check', async () => {
    delete process.env.LIFECYCLE_CATCHUP_EXCLUDED_EMAILS;
    await expect(checkLifecycleEligibility(baseInput, eligibleDeps)).resolves.toEqual({ eligible: true });

    process.env.LIFECYCLE_CATCHUP_EXCLUDED_EMAILS = 'existing@example.com';
    const sendEmailFn = jest.fn();
    const result = await sendLifecycleEmail(baseInput, { ...eligibleDeps, sendEmailFn });

    expect(result).toMatchObject({ status: 'suppressed', suppressedReason: 'excluded_email' });
    expect(sendEmailFn).not.toHaveBeenCalled();
  });

  it('continues to dispatch an eligible external catch-up recipient', async () => {
    process.env.LIFECYCLE_CATCHUP_EXCLUDED_EMAILS = 'blocked@example.test,@provvypay.com';
    const sendEmailFn = jest.fn().mockResolvedValue({ id: 'message-1', success: true });

    const result = await sendLifecycleEmail(baseInput, {
      ...eligibleDeps,
      sendEmailFn,
      recordSendFn: async () => undefined,
      logEmailFn: async () => undefined,
    });

    expect(result).toMatchObject({ status: 'sent', providerMessageId: 'message-1' });
    expect(sendEmailFn).toHaveBeenCalledTimes(1);
  });

  it('suppresses catch-up when Welcome was already sent', async () => {
    const result = await checkLifecycleEligibility(baseInput, {
      isUserVerifiedFn: async () => true,
      checkWorkspaceExistsFn: async () => ({ exists: true }),
      findSendRecordFn: async (_userId, campaign) => campaign === 'welcome',
    });
    expect(result).toEqual({ eligible: false, reason: 'welcome_already_sent' });
  });

  it('suppresses catch-up when catch-up was already sent', async () => {
    const result = await checkLifecycleEligibility(baseInput, {
      isUserVerifiedFn: async () => true,
      checkWorkspaceExistsFn: async () => ({ exists: true }),
      findSendRecordFn: async (_userId, campaign) => campaign === 'existing_user_catchup',
    });
    expect(result).toEqual({ eligible: false, reason: 'already_sent' });
  });

  it('does not treat an activation send as catch-up suppression', async () => {
    const result = await checkLifecycleEligibility(baseInput, {
      isUserVerifiedFn: async () => true,
      checkWorkspaceExistsFn: async () => ({ exists: true }),
      findSendRecordFn: async (_userId, campaign) => campaign === 'activation',
    });
    expect(result).toEqual({ eligible: true });
  });

  it('preserves idempotency by not calling sendEmail when already sent', async () => {
    let sendCalled = false;
    const sendResult = await sendLifecycleEmail(baseInput, {
      isUserVerifiedFn: async () => true,
      checkWorkspaceExistsFn: async () => ({ exists: true }),
      findSendRecordFn: async () => true,
      sendEmailFn: async () => {
        sendCalled = true;
        return { id: 'msg-1', success: true };
      },
    });

    expect(sendCalled).toBe(false);
    expect(sendResult.status).toBe('suppressed');
    expect(sendResult.suppressedReason).toBe('already_sent');
  });
});

describe('Catch-up excluded email configuration', () => {
  it('matches exact emails and @domain entries from env-style config', () => {
    const lists = parseCatchupExcludedEmails('qa@provvypay.test, @internal.test');
    expect(isCatchupExcludedEmail('qa@provvypay.test', lists)).toBe(true);
    expect(isCatchupExcludedEmail('dev@internal.test', lists)).toBe(true);
    expect(isCatchupExcludedEmail('verified.with.org@example.com', lists)).toBe(false);
  });
});
