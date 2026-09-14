import { checkLifecycleEligibility, sendLifecycleEmail } from '@/lib/email/lifecycle/lifecycle-service';
import { buildActivationRecoveryEmail } from '@/lib/email/lifecycle/templates/activation-recovery-template';
import type { LifecycleTriggerInput } from '@/lib/email/lifecycle/types';
import { CANONICAL_LIFECYCLE_APP_URL } from '@/lib/email/lifecycle/contact-config';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    user_organizations: {
      findFirst: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/server/prisma';

const mockFindWorkspaceMembership = prisma.user_organizations.findFirst as jest.Mock;

describe('Lifecycle Activation Recovery Email Eligibility', () => {
  const baseInput: LifecycleTriggerInput = {
    campaign: 'activation_recovery',
    userId: 'user-recovery-1',
    email: 'unverified@example.com',
    userName: 'Alex',
  };

  beforeEach(() => {
    mockFindWorkspaceMembership.mockReset();
  });

  it('allows an unverified user without checking workspace membership', async () => {
    const result = await checkLifecycleEligibility(baseInput, {
      isUserVerifiedFn: async () => false,
      findSendRecordFn: async () => false,
    });

    expect(result).toEqual({ eligible: true });
    expect(mockFindWorkspaceMembership).not.toHaveBeenCalled();
  });

  it('excludes a verified user', async () => {
    const result = await checkLifecycleEligibility(baseInput, {
      isUserVerifiedFn: async () => true,
      findSendRecordFn: async () => false,
    });

    expect(result).toEqual({ eligible: false, reason: 'verified_email' });
  });

  it('excludes when activation_recovery was already sent', async () => {
    const result = await checkLifecycleEligibility(baseInput, {
      isUserVerifiedFn: async () => false,
      findSendRecordFn: async (_userId, campaign) => campaign === 'activation_recovery',
    });

    expect(result).toEqual({ eligible: false, reason: 'already_sent' });
  });

  it('excludes configured lifecycle exclusion emails', async () => {
    const original = process.env.LIFECYCLE_CATCHUP_EXCLUDED_EMAILS;
    process.env.LIFECYCLE_CATCHUP_EXCLUDED_EMAILS = 'unverified@example.com';

    try {
      const result = await checkLifecycleEligibility(baseInput, {
        isUserVerifiedFn: async () => false,
        findSendRecordFn: async () => false,
      });

      expect(result).toEqual({ eligible: false, reason: 'excluded_email' });
    } finally {
      if (original === undefined) {
        delete process.env.LIFECYCLE_CATCHUP_EXCLUDED_EMAILS;
      } else {
        process.env.LIFECYCLE_CATCHUP_EXCLUDED_EMAILS = original;
      }
    }
  });

  it('fails closed when verification checker is missing', async () => {
    const result = await checkLifecycleEligibility(baseInput, {
      findSendRecordFn: async () => false,
    });

    expect(result).toEqual({ eligible: false, reason: 'missing_verification_check' });
  });

  it('renders production login CTA and approved copy', () => {
    const email = buildActivationRecoveryEmail();
    expect(email.html).toContain(`${CANONICAL_LIFECYCLE_APP_URL}/auth/login`);
    expect(email.text).toContain(`${CANONICAL_LIFECYCLE_APP_URL}/auth/login`);
    expect(email.html).toContain('Complete my setup');
    expect(email.html).toContain('hello@provvypay.com');
    expect(email.html).not.toContain('support@provvypay.com');
    expect(email.html).not.toMatch(/localhost|127\.0\.0\.1/);
    expect(email.html).toContain('one quick step left');
  });

  it('suppresses sendLifecycleEmail without calling sendEmail when ineligible', async () => {
    let sendCalled = false;
    const sendResult = await sendLifecycleEmail(baseInput, {
      isUserVerifiedFn: async () => true,
      findSendRecordFn: async () => false,
      sendEmailFn: async () => {
        sendCalled = true;
        return { id: 'msg-1', success: true };
      },
    });

    expect(sendResult.status).toBe('suppressed');
    expect(sendResult.suppressedReason).toBe('verified_email');
    expect(sendCalled).toBe(false);
  });
});
