import { runExistingUserCatchupSend } from '@/lib/email/lifecycle/catchup-dry-run';
import type { UserCandidate } from '@/lib/email/lifecycle/catchup-dry-run';
import type { LifecycleSendResult, LifecycleTriggerInput } from '@/lib/email/lifecycle/types';

describe('Existing User Catch-Up controlled send', () => {
  const users: UserCandidate[] = [
    {
      id: 'user-eligible-1',
      email: 'one@example.com',
      emailConfirmedAt: '2026-01-15T00:00:00.000Z',
      createdAt: '2026-01-14T00:00:00.000Z',
      userName: 'One',
    },
    {
      id: 'user-eligible-2',
      email: 'two@example.com',
      emailConfirmedAt: '2026-01-15T00:00:00.000Z',
      createdAt: '2026-01-14T00:00:00.000Z',
      userName: 'Two',
    },
    {
      id: 'user-unverified',
      email: 'unverified@example.com',
      emailConfirmedAt: null,
      createdAt: '2026-01-14T00:00:00.000Z',
    },
    {
      id: 'user-excluded',
      email: 'qa@provvypay.test',
      emailConfirmedAt: '2026-01-15T00:00:00.000Z',
      createdAt: '2026-01-14T00:00:00.000Z',
    },
  ];

  const audienceDeps = {
    listUsersFn: async () => users,
    getUserWorkspacesFn: async (userId: string) => [
      { organizationId: `org-${userId}`, workspaceName: `Workspace ${userId}` },
    ],
    hasPriorSendFn: async () => false,
    isExcludedEmailFn: (email: string) => email === 'qa@provvypay.test',
  };

  it('calls sendLifecycleEmail only for eligible users and respects the limit', async () => {
    const sent: string[] = [];
    const report = await runExistingUserCatchupSend(
      { limit: 10 },
      {
        ...audienceDeps,
        sendLifecycleEmailFn: async (input: LifecycleTriggerInput) => {
          sent.push(input.userId);
          expect(input.campaign).toBe('existing_user_catchup');
          return {
            success: true,
            campaign: 'existing_user_catchup',
            recipient: input.email,
            userId: input.userId,
            organizationId: input.organizationId,
            status: 'sent',
          } satisfies LifecycleSendResult;
        },
      }
    );

    expect(report.dryRun).toBe(false);
    expect(report.totalEligible).toBe(2);
    expect(report.totalSelected).toBe(2);
    expect(report.totalSent).toBe(2);
    expect(sent).toEqual(['user-eligible-1', 'user-eligible-2']);
    expect(sent).not.toContain('user-unverified');
    expect(sent).not.toContain('user-excluded');
  });

  it('continues when one user send throws', async () => {
    const sent: string[] = [];
    const report = await runExistingUserCatchupSend(
      { limit: 10 },
      {
        ...audienceDeps,
        sendLifecycleEmailFn: async (input: LifecycleTriggerInput) => {
          if (input.userId === 'user-eligible-1') {
            throw new Error('resend unavailable');
          }
          sent.push(input.userId);
          return {
            success: true,
            campaign: 'existing_user_catchup',
            recipient: input.email,
            userId: input.userId,
            organizationId: input.organizationId,
            status: 'sent',
          } satisfies LifecycleSendResult;
        },
      }
    );

    expect(report.totalFailed).toBe(1);
    expect(report.totalSent).toBe(1);
    expect(sent).toEqual(['user-eligible-2']);
    expect(report.results.find((row) => row.userId === 'user-eligible-1')?.status).toBe('failed');
  });

  it('does not send more than the requested limit', async () => {
    const sent: string[] = [];
    const report = await runExistingUserCatchupSend(
      { limit: 1 },
      {
        ...audienceDeps,
        sendLifecycleEmailFn: async (input: LifecycleTriggerInput) => {
          sent.push(input.userId);
          return {
            success: true,
            campaign: 'existing_user_catchup',
            recipient: input.email,
            userId: input.userId,
            organizationId: input.organizationId,
            status: 'sent',
          } satisfies LifecycleSendResult;
        },
      }
    );

    expect(report.totalSelected).toBe(1);
    expect(sent).toEqual(['user-eligible-1']);
  });

  it('refuses to run without a positive limit', async () => {
    await expect(
      runExistingUserCatchupSend({ limit: 0 }, audienceDeps)
    ).rejects.toThrow('positive --limit');
  });
});
