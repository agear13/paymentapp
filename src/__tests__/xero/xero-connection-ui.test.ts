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

  it('treats a missing row as disconnected', () => {
    expect(resolveXeroConnectionUiMode({ connected: false })).toBe('disconnected');
    expect(resolveXeroConnectionUiMode(null)).toBe('disconnected');
  });
});

describe('Xero customer copy', () => {
  it('does not send merchants to Integrations', () => {
    const issue = formatXeroConnectionIssue(XERO_REAUTHORIZATION_MESSAGE);
    expect(issue?.message.toLowerCase()).not.toContain('integrations');
    expect(issue?.action.toLowerCase()).toContain('connected systems');

    const mapping = formatMappingIssue(XERO_REAUTHORIZATION_MESSAGE);
    expect(mapping.message.toLowerCase()).not.toContain('integrations');
    expect(mapping.action.toLowerCase()).not.toContain('review your account choices');
  });
});
