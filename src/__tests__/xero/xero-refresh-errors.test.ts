import {
  classifyXeroRefreshFailure,
  XeroRefreshError,
} from '@/lib/xero/xero-refresh-errors';

describe('classifyXeroRefreshFailure', () => {
  it('treats invalid_grant as reauthorization', () => {
    expect(classifyXeroRefreshFailure(new Error('invalid_grant')).category).toBe(
      'invalid_grant'
    );
    expect(
      classifyXeroRefreshFailure({ message: 'unauthorized', response: { status: 401 } })
        .category
    ).toBe('invalid_grant');
  });

  it('treats network and 5xx failures as transient', () => {
    expect(classifyXeroRefreshFailure(new Error('fetch failed')).category).toBe('transient');
    expect(
      classifyXeroRefreshFailure({ message: 'bad gateway', response: { status: 503 } })
        .category
    ).toBe('transient');
    expect(classifyXeroRefreshFailure(new Error('ETIMEDOUT')).category).toBe('transient');
  });

  it('preserves XeroRefreshError categories', () => {
    const error = new XeroRefreshError('db write failed', 'persist_failed');
    expect(classifyXeroRefreshFailure(error).category).toBe('persist_failed');
  });
});
