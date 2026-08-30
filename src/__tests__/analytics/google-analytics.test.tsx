/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import * as React from 'react';
import { render } from '@testing-library/react';
import GoogleAnalytics from '@/components/analytics/google-analytics';

jest.mock('next/script', () => {
  return function MockScript({
    id,
    src,
    children,
  }: {
    id?: string;
    src?: string;
    children?: React.ReactNode;
  }) {
    return (
      <script data-testid={id ?? src} src={src}>
        {children}
      </script>
    );
  };
});

describe('GoogleAnalytics', () => {
  const originalMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  afterEach(() => {
    if (originalMeasurementId === undefined) {
      delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    } else {
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = originalMeasurementId;
    }
  });

  it('renders nothing without a valid measurement ID', () => {
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    const { container } = render(<GoogleAnalytics />);
    expect(container).toBeEmptyDOMElement();
  });

  it('loads gtag.js and config without custom events or PII fields', () => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-CW6D3T5BHF';
    const { getByTestId } = render(<GoogleAnalytics />);

    expect(getByTestId('https://www.googletagmanager.com/gtag/js?id=G-CW6D3T5BHF')).toHaveAttribute(
      'src',
      'https://www.googletagmanager.com/gtag/js?id=G-CW6D3T5BHF'
    );

    const config = getByTestId('ga4-gtag').textContent ?? '';
    expect(config).toContain("gtag('config', 'G-CW6D3T5BHF'");
    expect(config).toContain('send_page_view: true');
    expect(config).not.toContain("gtag('event'");
    expect(config).not.toContain('user_id');
    expect(config).not.toContain('user_data');
    expect(config).not.toContain('email');
  });

  it('defaults analytics consent to denied unless cookie_consent already granted', () => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-CW6D3T5BHF';
    const { getByTestId } = render(<GoogleAnalytics />);
    const consent = getByTestId('ga4-consent-default').textContent ?? '';
    expect(consent).toContain("gtag('consent', 'default'");
    expect(consent).toContain("analytics_storage: analyticsGranted ? 'granted' : 'denied'");
    expect(consent).toContain("ad_storage: 'denied'");
  });
});
