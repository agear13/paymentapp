/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: string; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ParticipantWorkspaceConversionCta } from '@/components/participant-portal/participant-workspace-conversion-cta';
import { ParticipantCommercialWorkspaceView } from '@/components/participant-portal/participant-portal-view';
import {
  participantWorkspaceConversionHref,
  shouldShowParticipantWorkspaceConversionCta,
} from '@/lib/participants/source-participant-hint';
import type { ParticipantCommercialWorkspaceModel } from '@/lib/participant-portal/participant-portal-data';
import type { ParticipantWorkspaceOnboarding } from '@/lib/participant-portal/participant-workspace-onboarding';

const PARTICIPANT_ID = 'p-apex-1';

function workspaceModel(): ParticipantCommercialWorkspaceModel {
  return {
    participantName: 'Apex',
    participantRole: 'Promoter',
    participantSubtitle: 'Summer Festival',
    projectName: 'Summer Festival',
    agreementStatus: 'approved',
    agreementStatusLabel: 'Approved',
    lifecycleSteps: [],
    commercialSections: [],
    agreement: {
      deliverables: [],
      commercialObligations: [],
      paymentEvents: [],
      settlementRules: [],
      conditionalPayments: [],
    },
    performance: {
      supportedFields: [],
      metrics: [],
      hasRecordedActivity: false,
    },
    settlement: {
      statusLabel: 'Pending',
      blockingReason: null,
      nextStep: 'Wait for organiser verification',
      isBlocked: false,
    },
    paymentTimeline: [],
    intelligence: null,
    currency: 'AUD',
    syncedAt: '2026-08-23T00:00:00.000Z',
    hasEarningsConfiguration: false,
    commercialState: 'ACTIVE',
    workflowStatus: {
      commercial: 'Active',
      settlement: 'Pending',
      accounting: 'Not connected',
    },
  };
}

function onboarding(complete: boolean): ParticipantWorkspaceOnboarding {
  return {
    step: complete ? 'complete' : 'agreement_review',
    agreementStatus: complete ? 'Approved' : 'Pending',
    payoutDetailsStatus: complete ? 'Submitted' : 'Pending',
    nextRequiredAction: complete ? null : 'Review and approve your agreement',
    onboardingComplete: complete,
  };
}

describe('participant workspace conversion CTA visibility', () => {
  it('shows only after required participant work is complete', () => {
    expect(
      shouldShowParticipantWorkspaceConversionCta({
        onboardingComplete: true,
        previewMode: false,
        sourceParticipantId: PARTICIPANT_ID,
      })
    ).toBe(true);
    expect(
      shouldShowParticipantWorkspaceConversionCta({
        onboardingComplete: false,
        previewMode: false,
        sourceParticipantId: PARTICIPANT_ID,
      })
    ).toBe(false);
  });

  it('hides for operator preview and missing participant id', () => {
    expect(
      shouldShowParticipantWorkspaceConversionCta({
        onboardingComplete: true,
        previewMode: true,
        sourceParticipantId: PARTICIPANT_ID,
      })
    ).toBe(false);
    expect(
      shouldShowParticipantWorkspaceConversionCta({
        onboardingComplete: true,
        previewMode: false,
        sourceParticipantId: null,
      })
    ).toBe(false);
  });

  it('links only the participant row id into provisioning', () => {
    expect(participantWorkspaceConversionHref(PARTICIPANT_ID)).toBe(
      `/journey/provisioning?sourceParticipantId=${PARTICIPANT_ID}`
    );
    expect(participantWorkspaceConversionHref(PARTICIPANT_ID)).not.toContain('invite_token');
    expect(participantWorkspaceConversionHref(PARTICIPANT_ID)).not.toContain('inviteToken');
    expect(participantWorkspaceConversionHref(PARTICIPANT_ID)).not.toContain('portalToken');
  });
});

describe('ParticipantWorkspaceConversionCta', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('renders the conversion offer and can be dismissed locally', () => {
    render(<ParticipantWorkspaceConversionCta sourceParticipantId={PARTICIPANT_ID} />);
    const cta = screen.getByRole('link', { name: 'Create Free Workspace' });
    expect(cta).toHaveAttribute(
      'href',
      `/journey/provisioning?sourceParticipantId=${PARTICIPANT_ID}`
    );
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('link', { name: 'Create Free Workspace' })).not.toBeInTheDocument();
  });
});

describe('ParticipantCommercialWorkspaceView CTA placement', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('shows the CTA after onboarding is complete', () => {
    render(
      <ParticipantCommercialWorkspaceView
        workspace={workspaceModel()}
        activeSection="overview"
        onSectionChange={() => undefined}
        onboarding={onboarding(true)}
        sourceParticipantId={PARTICIPANT_ID}
      />
    );
    expect(screen.getByTestId('participant-workspace-conversion-cta')).toBeInTheDocument();
    expect(screen.getByText('Create your own Provvy workspace')).toBeInTheDocument();
  });

  it('does not show the CTA during incomplete onboarding', () => {
    render(
      <ParticipantCommercialWorkspaceView
        workspace={workspaceModel()}
        activeSection="overview"
        onSectionChange={() => undefined}
        onboarding={onboarding(false)}
        sourceParticipantId={PARTICIPANT_ID}
      />
    );
    expect(screen.queryByTestId('participant-workspace-conversion-cta')).not.toBeInTheDocument();
  });
});

describe('conversion CTA isolation', () => {
  const root = process.cwd();

  it('does not mount the CTA on agreement review or payout entry', () => {
    const gate = readFileSync(
      join(root, 'components/participant-portal/participant-workspace-gate.tsx'),
      'utf8'
    );
    const agreementBlock = gate.slice(
      gate.indexOf('if (showAgreementReview)'),
      gate.indexOf("if (onboarding.step === 'payout_details')")
    );
    const payoutBlock = gate.slice(
      gate.indexOf("if (onboarding.step === 'payout_details')"),
      gate.indexOf("if (onboarding.step === 'payout_submitted' && !workspace)")
    );
    expect(agreementBlock).not.toContain('ParticipantWorkspaceConversionCta');
    expect(payoutBlock).not.toContain('ParticipantWorkspaceConversionCta');
  });

  it('does not put invitation secrets on the CTA href', () => {
    const cta = readFileSync(
      join(root, 'components/participant-portal/participant-workspace-conversion-cta.tsx'),
      'utf8'
    );
    expect(cta).toContain('participantWorkspaceConversionHref');
    expect(cta).not.toContain('inviteToken');
    expect(cta).not.toContain('invite_token');
    expect(cta).not.toContain('portalToken');
  });
});
