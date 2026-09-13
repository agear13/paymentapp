import {
  emitWorkspaceCreatedEvent,
  WORKSPACE_CREATED_EVENT_NAME,
} from '@/lib/email/lifecycle/resend-events';

describe('emitWorkspaceCreatedEvent', () => {
  const input = {
    email: 'alex@example.com',
    userId: 'user-1',
    organizationId: 'org-new',
    workspaceName: 'Studio North',
  };

  it('emits workspace.created with email and workspace identifiers', async () => {
    const sendEventFn = jest.fn().mockResolvedValue({ success: true });
    const recordEventFn = jest.fn().mockResolvedValue(undefined);

    const result = await emitWorkspaceCreatedEvent(input, {
      findEventRecordFn: async () => false,
      sendEventFn,
      recordEventFn,
    });

    expect(result).toEqual({ emitted: true });
    expect(sendEventFn).toHaveBeenCalledWith(input);
    expect(recordEventFn).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        organizationId: 'org-new',
        email: 'alex@example.com',
        status: 'sent',
        metadata: {
          event: WORKSPACE_CREATED_EVENT_NAME,
          workspaceName: 'Studio North',
        },
      })
    );
  });

  it('does not emit again when the event was already recorded', async () => {
    const sendEventFn = jest.fn().mockResolvedValue({ success: true });

    const result = await emitWorkspaceCreatedEvent(input, {
      findEventRecordFn: async () => true,
      sendEventFn,
    });

    expect(result).toEqual({ emitted: false, reason: 'already_emitted' });
    expect(sendEventFn).not.toHaveBeenCalled();
  });

  it('fails open when Resend event emission fails', async () => {
    const result = await emitWorkspaceCreatedEvent(input, {
      findEventRecordFn: async () => false,
      sendEventFn: async () => ({ success: false, error: 'resend unavailable' }),
      recordEventFn: async () => {
        throw new Error('should not record a failed emission as sent');
      },
    });

    expect(result.emitted).toBe(false);
    expect(result.reason).toBe('provider_error');
    expect(result.error).toBe('resend unavailable');
  });

  it('fails open when the helper throws', async () => {
    const result = await emitWorkspaceCreatedEvent(input, {
      findEventRecordFn: async () => {
        throw new Error('db down');
      },
    });

    expect(result.emitted).toBe(false);
    expect(result.reason).toBe('unexpected_error');
    expect(result.error).toBe('db down');
  });
});
