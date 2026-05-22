import {
  classifyMutationError,
  createOperationId,
  recoverableFailure,
  toClientMutationResult,
} from '@/lib/onboarding/mutation-resilience';

describe('mutation-resilience', () => {
  it('creates operation ids', () => {
    expect(createOperationId()).toMatch(/^onb_/);
  });

  it('classifies network errors as recoverable', () => {
    expect(classifyMutationError(new Error('ECONNRESET')).recoverable).toBe(true);
  });

  it('strips internal cause from client payload', () => {
    const r = recoverableFailure(
      'op-1',
      'We could not finish configuring your project yet. Your project details were preserved safely.',
      'secret stack'
    );
    const client = toClientMutationResult(r);
    expect(client).not.toHaveProperty('internalCause');
    expect(client.recoveryMessage).toContain('preserved');
  });
});
