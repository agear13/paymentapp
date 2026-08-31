/** @jest-environment jsdom */

import { sanitizeGaEventParams, trackGaEvent } from '@/lib/analytics/track-ga-event';

describe('trackGaEvent', () => {
  it('strips email and other PII keys from event params', () => {
    expect(
      sanitizeGaEventParams({
        source: 'jarvis_campaign',
        email: 'ada@provvy.com',
        name: 'Ada',
        note: 'hello@example.com',
      })
    ).toEqual({ source: 'jarvis_campaign' });
  });

  it('calls gtag without leaking an email', () => {
    const gtag = jest.fn();
    (window as Window & { gtag?: typeof gtag }).gtag = gtag;
    trackGaEvent('jarvis_waitlist_success', { email: 'ada@provvy.com', source: 'jarvis' });
    expect(gtag).toHaveBeenCalledWith('event', 'jarvis_waitlist_success', { source: 'jarvis' });
    delete (window as Window & { gtag?: typeof gtag }).gtag;
  });

  it('records Jarvis campaign events with no params and no PII', () => {
    const gtag = jest.fn();
    (window as Window & { gtag?: typeof gtag }).gtag = gtag;
    trackGaEvent('jarvis_landing_view');
    trackGaEvent('jarvis_waitlist_started');
    trackGaEvent('jarvis_waitlist_submitted');
    trackGaEvent('jarvis_waitlist_success');
    trackGaEvent('jarvis_explore_provvy_clicked');
    expect(gtag.mock.calls).toEqual([
      ['event', 'jarvis_landing_view', undefined],
      ['event', 'jarvis_waitlist_started', undefined],
      ['event', 'jarvis_waitlist_submitted', undefined],
      ['event', 'jarvis_waitlist_success', undefined],
      ['event', 'jarvis_explore_provvy_clicked', undefined],
    ]);
    const serialized = JSON.stringify(gtag.mock.calls);
    expect(serialized).not.toMatch(/@/);
    expect(serialized).not.toContain('email');
    delete (window as Window & { gtag?: typeof gtag }).gtag;
  });
});
