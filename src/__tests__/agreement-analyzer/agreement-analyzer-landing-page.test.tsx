/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

import { AgreementAnalyzerLandingPage } from '@/components/agreement-analyzer/agreement-analyzer-landing-page';
import {
  trackAgreementAnalyzerPageViewed,
  trackAgreementAnalyzerUploadCompleted,
  trackAgreementAnalyzerUploadStarted,
} from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics';

jest.mock('@/components/agreement-analyzer/agreement-analyzer-upload-form', () => ({
  AgreementAnalyzerUploadForm: () => <div data-testid="upload-form">Upload form</div>,
}));

jest.mock('@/lib/agreement-analyzer/attribution/agreement-analyzer-attribution.client', () => ({
  captureAgreementAnalyzerAttribution: jest.fn().mockReturnValue({
    utm_source: 'linkedin',
    utm_medium: 'organic',
    utm_campaign: 'agreement-analyzer-launch',
    utm_content: null,
    utm_term: null,
    referrer: 'https://www.linkedin.com/',
    landing_page: '/agreement-analyzer?utm_source=linkedin',
    first_touch_at: '2026-06-09T10:00:00.000Z',
  }),
}));

jest.mock('@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics', () => ({
  trackAgreementAnalyzerPageViewed: jest.fn(),
  trackAgreementAnalyzerUploadStarted: jest.fn(),
  trackAgreementAnalyzerUploadCompleted: jest.fn(),
}));

describe('AgreementAnalyzerLandingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders hero, trust, upload, preview, and FAQ sections', () => {
    render(<AgreementAnalyzerLandingPage />);

    expect(
      screen.getByRole('heading', {
        name: /upload an agreement\. discover where payment disputes could happen\./i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /receive a free ai-generated obligation report showing revenue splits/i
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Most reports are generated in under 60 seconds.')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('DOCX')).toBeInTheDocument();
    expect(screen.getByText('Screenshots')).toBeInTheDocument();
    expect(screen.getByTestId('upload-form')).toBeInTheDocument();
    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    expect(screen.getByText('Settlement Simulation')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Provvypay Fit Score' })).toBeInTheDocument();
    expect(screen.getByText('Settlement Risk Assessment')).toBeInTheDocument();
    expect(screen.getByText('Settlement Readiness Score')).toBeInTheDocument();
    expect(screen.getByText('What agreements can I upload?')).toBeInTheDocument();
    expect(screen.getByText('Do I need a Provvypay account?')).toBeInTheDocument();
  });

  it('tracks page view with captured attribution on mount', () => {
    render(<AgreementAnalyzerLandingPage />);
    expect(trackAgreementAnalyzerPageViewed).toHaveBeenCalledWith(
      expect.objectContaining({
        utm_source: 'linkedin',
        utm_campaign: 'agreement-analyzer-launch',
      })
    );
  });

  it('scrolls to upload section when hero CTA is clicked', () => {
    const scrollIntoView = jest.fn();
    const uploadSection = document.createElement('section');
    uploadSection.id = 'upload';
    uploadSection.scrollIntoView = scrollIntoView;
    document.body.appendChild(uploadSection);

    render(<AgreementAnalyzerLandingPage />);
    fireEvent.click(screen.getByRole('button', { name: /upload your agreement/i }));

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });
});

describe('agreement analyzer landing analytics exports', () => {
  it('exposes upload funnel tracking helpers', () => {
    expect(trackAgreementAnalyzerUploadStarted).toBeDefined();
    expect(trackAgreementAnalyzerUploadCompleted).toBeDefined();
  });
});
