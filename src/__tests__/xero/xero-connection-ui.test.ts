import { resolveXeroConnectionUiMode } from '@/lib/xero/xero-connection-ui';
import { formatMappingIssue, formatXeroConnectionIssue } from '@/lib/xero/xero-customer-messages';
import { XERO_REAUTHORIZATION_MESSAGE } from '@/lib/xero/xero-connection-ui';

describe('resolveXeroConnectionUiMode', () => {
  it('treats a persisted healthy connection as connected', () => {
    expect(resolveXeroConnectionUiMode({ connected: true })).toBe('connected');
  });

  it('does not treat a stale persisted connection as disconnected', () => {
    expect(resolveXeroConnectionUiMode({ connected: true, stale: true })).toBe(
      'needs_reauthorization'
    );
  });

  it('treats a transient refresh failure as refresh_error, not reconnect', () => {
    expect(
      resolveXeroConnectionUiMode({
        connected: true,
        transientRefreshFailure: true,
        connectionState: 'ERROR',
      })
    ).toBe('refresh_error');
  });

  it('treats a missing row as disconnected', () => {
    expect(resolveXeroConnectionUiMode({ connected: false })).toBe('disconnected');
    expect(resolveXeroConnectionUiMode(null)).toBe('disconnected');
  });
});

describe('Xero customer copy', () => {
  it('does not send merchants to Integrations', () => {
    const issue = formatXeroConnectionIssue(XERO_REAUTHORIZATION_MESSAGE);
    expect(issue?.message.toLowerCase()).not.toContain('integrations');
    expect(issue?.action.toLowerCase()).toContain('reconnect');

    const mapping = formatMappingIssue(XERO_REAUTHORIZATION_MESSAGE);
    expect(mapping.message.toLowerCase()).not.toContain('integrations');
    expect(mapping.action.toLowerCase()).not.toContain('review your account choices');
  });

  it('keeps the actual missing mapping codes in save errors', () => {
    const issue = formatMappingIssue(
      'Some mapped Xero account codes are no longer available: 200. Refresh accounts and reselect valid options.'
    );
    expect(issue.message).toContain('200');
    expect(issue.message).not.toBe('Provvy could not save your Xero account choices.');
  });
});
