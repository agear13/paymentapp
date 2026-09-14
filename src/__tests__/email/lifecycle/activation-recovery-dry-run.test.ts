import {
  evaluateActivationRecoveryAudience,
  runActivationRecoveryDryRun,
} from '@/lib/email/lifecycle/activation-recovery-dry-run';
import type { UserCandidate } from '@/lib/email/lifecycle/catchup-dry-run';

describe('Activation recovery audience dry-run', () => {
  const users: UserCandidate[] = [
    {
      id: 'user-eligible-1',
      email: 'one@example.com',
      emailConfirmedAt: null,
      createdAt: '2026-01-14T00:00:00.000Z',
    },
    {
      id: 'user-verified',
      email: 'verified@example.com',
      emailConfirmedAt: '2026-01-15T00:00:00.000Z',
      createdAt: '2026-01-14T00:00:00.000Z',
    },
    {
      id: 'user-oauth',
      email: 'oauth@example.com',
      emailConfirmedAt: null,
      createdAt: '2026-01-14T00:00:00.000Z',
      appMetadata: { provider: 'google' },
    },
    {
      id: 'user-already-sent',
      email: 'sent@example.com',
      emailConfirmedAt: null,
      createdAt: '2026-01-14T00:00:00.000Z',
    },
  ];

  it('classifies unverified users as eligible and masks emails in dry-run report', async () => {
    const audience = await evaluateActivationRecoveryAudience({
      listUsersFn: async () => users,
      hasPriorSendFn: async (userId) => userId === 'user-already-sent',
      isExcludedEmailFn: () => false,
    });

    expect(audience.totalExamined).toBe(4);
    expect(audience.totalVerified).toBe(2);
    expect(audience.totalUnverified).toBe(2);
    expect(audience.totalEligible).toBe(1);
    expect(audience.exclusionBreakdown.verified_email).toBe(2);
    expect(audience.exclusionBreakdown.already_sent).toBe(1);

    const report = await runActivationRecoveryDryRun({
      listUsersFn: async () => users,
      hasPriorSendFn: async (userId) => userId === 'user-already-sent',
      isExcludedEmailFn: () => false,
    });

    expect(report.dryRun).toBe(true);
    expect(report.totalEligible).toBe(1);
    expect(report.candidates.find((c) => c.userId === 'user-eligible-1')?.email).toMatch(
      /^on\*.*@example\.com$/
    );
  });
});
