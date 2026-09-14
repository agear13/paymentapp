import { runActivationRecoverySend } from '@/lib/email/lifecycle/activation-recovery-dry-run';
import type { UserCandidate } from '@/lib/email/lifecycle/catchup-dry-run';
import type { LifecycleSendResult, LifecycleTriggerInput } from '@/lib/email/lifecycle/types';

describe('Activation recovery controlled send', () => {
  const users: UserCandidate[] = [
    {
      id: 'user-eligible-1',
      email: 'one@example.com',
      emailConfirmedAt: null,
      createdAt: '2026-01-14T00:00:00.000Z',
      userName: 'One',
    },
    {
      id: 'user-eligible-2',
      email: 'two@example.com',
      emailConfirmedAt: null,
      createdAt: '2026-01-14T00:00:00.000Z',
      userName: 'Two',
    },
    {
      id: 'user-verified',
      email: 'verified@example.com',
      emailConfirmedAt: '2026-01-15T00:00:00.000Z',
      createdAt: '2026-01-14T00:00:00.000Z',
    },
    {
      id: 'user-excluded',
      email: 'qa@provvypay.test',
      emailConfirmedAt: null,
      createdAt: '2026-01-14T00:00:00.000Z',
    },
  ];

  const audienceDeps = {
    listUsersFn: async () => users,
    hasPriorSendFn: async () => false,
    isExcludedEmailFn: (email: string) => email === 'qa@provvypay.test',
  };

  it('calls sendLifecycleEmail only for eligible unverified users and respects the limit', async () => {
    const sent: string[] = [];
    const report = await runActivationRecoverySend(
      { limit: 10 },
      {
        ...audienceDeps,
        sendLifecycleEmailFn: async (input: LifecycleTriggerInput) => {
          sent.push(input.userId);
          expect(input.campaign).toBe('activation_recovery');
          return {
            success: true,
            campaign: 'activation_recovery',
            recipient: input.email,
            userId: input.userId,
            status: 'sent',
          } satisfies LifecycleSendResult;
        },
        lookupUserFn: async (userId) => users.find((u) => u.id === userId) ?? null,
      }
    );

    expect(report.dryRun).toBe(false);
    expect(report.totalEligible).toBe(2);
    expect(report.totalSelected).toBe(2);
    expect(report.totalSent).toBe(2);
    expect(sent).toEqual(['user-eligible-1', 'user-eligible-2']);
  });

  it('suppresses send when fresh lookup shows the user verified before dispatch', async () => {
    const report = await runActivationRecoverySend(
      { limit: 10 },
      {
        ...audienceDeps,
        sendLifecycleEmailFn: async (input: LifecycleTriggerInput) => {
          if (input.userId === 'user-eligible-1') {
            return {
              success: false,
              campaign: 'activation_recovery',
              recipient: input.email,
              userId: input.userId,
              status: 'suppressed',
              suppressedReason: 'verified_email',
            } satisfies LifecycleSendResult;
          }
          return {
            success: true,
            campaign: 'activation_recovery',
            recipient: input.email,
            userId: input.userId,
            status: 'sent',
          } satisfies LifecycleSendResult;
        },
        lookupUserFn: async (userId) => {
          if (userId === 'user-eligible-1') {
            return {
              ...users[0],
              emailConfirmedAt: '2026-01-15T00:00:00.000Z',
            };
          }
          return users.find((u) => u.id === userId) ?? null;
        },
      }
    );

    expect(report.totalSuppressed).toBe(1);
    expect(report.totalSent).toBe(1);
  });

  it('continues when one user send throws', async () => {
    const sent: string[] = [];
    const report = await runActivationRecoverySend(
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
            campaign: 'activation_recovery',
            recipient: input.email,
            userId: input.userId,
            status: 'sent',
          } satisfies LifecycleSendResult;
        },
        lookupUserFn: async (userId) => users.find((u) => u.id === userId) ?? null,
      }
    );

    expect(report.totalFailed).toBe(1);
    expect(report.totalSent).toBe(1);
    expect(sent).toEqual(['user-eligible-2']);
  });
});
