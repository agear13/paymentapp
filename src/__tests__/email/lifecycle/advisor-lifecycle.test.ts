import { checkLifecycleEligibility, sendLifecycleEmail } from '@/lib/email/lifecycle/lifecycle-service';
import type { LifecycleTriggerInput } from '@/lib/email/lifecycle/types';

describe('AI Advisor Lifecycle Campaign', () => {
  const baseInput: LifecycleTriggerInput = {
    campaign: 'ai_advisor',
    userId: 'user-advisor-1',
    organizationId: 'org-advisor-1',
    email: 'advisor.user@example.com',
    userName: 'Jordan',
  };

  it('allows send when advisor has not been meaningfully used and not previously sent', async () => {
    const result = await checkLifecycleEligibility(baseInput, {
      findSendRecordFn: async () => false,
      checkAdvisorUsageFn: async () => false,
    });

    expect(result).toEqual({ eligible: true });
  });

  it('suppresses email when server-side advisor usage signal is detected', async () => {
    const result = await checkLifecycleEligibility(baseInput, {
      findSendRecordFn: async () => false,
      checkAdvisorUsageFn: async () => true, // Server records meaningful usage
    });

    expect(result).toEqual({ eligible: false, reason: 'advisor_already_used' });
  });

  it('suppresses email when campaign was already sent', async () => {
    const result = await checkLifecycleEligibility(baseInput, {
      findSendRecordFn: async () => true, // Already sent
      checkAdvisorUsageFn: async () => false,
    });

    expect(result).toEqual({ eligible: false, reason: 'already_sent' });
  });

  it('verifies sendLifecycleEmail suppresses dispatch when advisor was used', async () => {
    let emailSent = false;
    const sendResult = await sendLifecycleEmail(baseInput, {
      findSendRecordFn: async () => false,
      checkAdvisorUsageFn: async () => true,
      sendEmailFn: async () => {
        emailSent = true;
        return { id: 'msg-advisor', success: true };
      },
    });

    expect(emailSent).toBe(false);
    expect(sendResult.status).toBe('suppressed');
    expect(sendResult.suppressedReason).toBe('advisor_already_used');
  });
});
