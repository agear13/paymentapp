/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { AgreementExtractionCompletePanel } from '@/components/journey/lovable/agreement-extraction-complete-panel';
import { field, testParty } from '@/lib/ai-extractor/test-helpers/party-fixture';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import type { WorkflowAgreementHubSummary } from '@/lib/workflows/agreement-intelligence/types';

jest.mock('@/lib/ai-extractor/extraction-export', () => {
  const actual = jest.requireActual('@/lib/ai-extractor/extraction-export');
  return {
    ...actual,
    downloadExtractionExport: jest.fn(),
  };
});

import { downloadExtractionExport } from '@/lib/ai-extractor/extraction-export';

function extraction(): ExtractionResult {
  return {
    projectName: field('Festival Revenue Share'),
    projectDescription: field(null, 'absent'),
    projectValue: field(null, 'absent'),
    currency: field('AUD'),
    counterparty: field('Apex'),
    parties: [
      testParty({
        id: 'apex',
        name: field('Apex Promotions'),
        email: field('apex@example.com'),
        role: field('Promoter'),
        participationModel: field('revenue_share'),
        revenueSharePct: field(20),
      }),
    ],
    paymentTerms: [],
    uncertainties: [],
    overallConfidence: 'high',
    sourceHint: null,
    extractedAt: '2026-08-24T00:00:00.000Z',
  };
}

const hub: WorkflowAgreementHubSummary = {
  title: 'Festival Revenue Share',
  lifecycleStatus: 'READY_FOR_REVIEW',
  extractionStatus: 'READY_FOR_REVIEW',
  participantCount: 1,
  obligationCount: 1,
  revenueShareCount: 1,
  settlementSchedule: 'Every Friday',
  approvalRequired: true,
  hasAgreement: true,
  canReview: true,
  canApprove: true,
  canUpload: false,
  canRetryExtraction: false,
  canRetryBootstrap: false,
  isOperational: false,
  showsOperationalHub: false,
  extractionComplete: true,
  oneLiner: 'Apex Promotions receives 20% revenue share.',
};

describe('AgreementExtractionCompletePanel', () => {
  it('exposes download, operator email, review, and next workflow actions', () => {
    const onReview = jest.fn();
    const onShare = jest.fn().mockResolvedValue(undefined);

    render(
      <AgreementExtractionCompletePanel
        extraction={extraction()}
        hub={hub}
        operatorEmail="ops@provvy.test"
        sharing={false}
        shareError={null}
        shareSuccess={null}
        onReview={onReview}
        onShare={onShare}
      />
    );

    expect(screen.getByTestId('extraction-complete-panel')).toBeInTheDocument();
    expect(screen.getByText('Extraction complete')).toBeInTheDocument();
    expect(screen.getByText('Apex Promotions receives 20% revenue share.')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('download-extraction'));
    expect(downloadExtractionExport).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'agreement-intelligence',
        extraction: expect.objectContaining({
          parties: [expect.objectContaining({ id: 'apex' })],
        }),
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Review structured result' }));
    expect(onReview).toHaveBeenCalledTimes(1);

    const email = screen.getByTestId('extraction-share-email') as HTMLInputElement;
    expect(email.value).toBe('ops@provvy.test');
    fireEvent.change(email, { target: { value: 'operator@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send extraction' }));
    expect(onShare).toHaveBeenCalledWith('operator@example.com');

    expect(screen.getByRole('link', { name: 'Continue in Referral Management' })).toHaveAttribute(
      'href',
      '/workspace/workflows/referral-management'
    );
    expect(screen.getByRole('button', { name: 'Approve structure' })).toBeInTheDocument();
  });

  it('shows real send failure copy instead of a fake success state', () => {
    render(
      <AgreementExtractionCompletePanel
        extraction={extraction()}
        hub={hub}
        sharing={false}
        shareError="Email provider not configured (Resend not available)"
        shareSuccess={null}
        onReview={() => undefined}
        onShare={async () => undefined}
      />
    );

    expect(screen.getByTestId('extraction-share-error')).toHaveTextContent(
      'Email provider not configured (Resend not available)'
    );
    expect(screen.queryByTestId('extraction-share-success')).not.toBeInTheDocument();
  });
});
