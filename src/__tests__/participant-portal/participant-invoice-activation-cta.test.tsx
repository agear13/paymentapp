/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ParticipantInvoiceActivationCta } from '@/components/participant-portal/participant-invoice-activation-cta';
import { ParticipantCommercialWorkspaceView } from '@/components/participant-portal/participant-portal-view';
import {
  invoiceActivationCompensationKindFromSections,
  participantInvoiceActivationCopy,
  participantInvoiceActivationHref,
  shouldShowParticipantInvoiceActivationCta,
} from '@/lib/invoices/participant-invoice-activation';
import type { ParticipantCommercialWorkspaceModel } from '@/lib/participant-portal/participant-portal-data';
import type { ParticipantWorkspaceOnboarding } from '@/lib/participant-portal/participant-workspace-onboarding';

const PARTICIPANT_ID = 'p-sarah-1';
const CONVERTED_ORG = 'org-sarah-converted';

function workspaceModel(
  sections: ParticipantCommercialWorkspaceModel['commercialSections'] = []
): ParticipantCommercialWorkspaceModel {
  return {
    participantName: 'Sarah Williams',
    participantRole: 'Producer',
    participantSubtitle: 'Saturday Beach Event',
    projectName: 'Saturday Beach Event',
    agreementStatus: 'approved',
    agreementStatusLabel: 'Approved',
    lifecycleSteps: [],
    commercialSections: sections,
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
    syncedAt: '2026-08-26T00:00:00.000Z',
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

describe('participant invoice activation routing', () => {
  it('sends unconverted participants through provisioning with generate-invoice intent', () => {
    expect(
      participantInvoiceActivationHref({ sourceParticipantId: PARTICIPANT_ID })
    ).toBe(
      `/journey/provisioning?sourceParticipantId=${PARTICIPANT_ID}&intent=generate_invoice`
    );
  });

  it('sends converted participants directly to agreement-origin Create Invoice', () => {
    expect(
      participantInvoiceActivationHref({
        sourceParticipantId: PARTICIPANT_ID,
        convertedOrganizationId: CONVERTED_ORG,
      })
    ).toBe(
      `/workspace/receivables/create?origin=participant_portal&sourceParticipantId=${PARTICIPANT_ID}`
    );
  });

  it('does not encode commercial amounts in the activation href', () => {
    const href = participantInvoiceActivationHref({
      sourceParticipantId: PARTICIPANT_ID,
      convertedOrganizationId: CONVERTED_ORG,
    });
    expect(href).not.toContain('6000');
    expect(href).not.toContain('12500');
    expect(href).not.toContain('amount');
  });

  it('keeps the CTA available for variable compensation', () => {
    expect(
      shouldShowParticipantInvoiceActivationCta({
        onboardingComplete: true,
        previewMode: false,
        sourceParticipantId: PARTICIPANT_ID,
      })
    ).toBe(true);
    expect(
      invoiceActivationCompensationKindFromSections([{ kind: 'revenue_share' }])
    ).toBe('variable');
    expect(participantInvoiceActivationCopy('variable').action).toBe('Create invoice');
    expect(participantInvoiceActivationCopy('fixed').action).toBe('Generate my invoice');
  });

  it('hides the CTA in operator preview', () => {
    expect(
      shouldShowParticipantInvoiceActivationCta({
        onboardingComplete: true,
        previewMode: true,
        sourceParticipantId: PARTICIPANT_ID,
      })
    ).toBe(false);
  });
});

describe('ParticipantInvoiceActivationCta', () => {
  it('shows Generate my invoice for a fixed-fee participant without a workspace', () => {
    render(
      <ParticipantInvoiceActivationCta
        sourceParticipantId={PARTICIPANT_ID}
        commercialSections={[{ kind: 'fixed_fee', amount: 'A$6,000', dueDate: null, dueDateLabel: null }]}
      />
    );
    const cta = screen.getByRole('link', { name: 'Generate my invoice' });
    expect(cta).toHaveAttribute(
      'href',
      `/journey/provisioning?sourceParticipantId=${PARTICIPANT_ID}&intent=generate_invoice`
    );
    expect(screen.getByText('Need to get paid for this agreement?')).toBeInTheDocument();
  });

  it('shows Create invoice for revenue-share and still offers the CTA', () => {
    render(
      <ParticipantInvoiceActivationCta
        sourceParticipantId={PARTICIPANT_ID}
        convertedOrganizationId={CONVERTED_ORG}
        commercialSections={[
          {
            kind: 'revenue_share',
            percentage: '10%',
            revenueSource: 'Ticket sales',
            settlement: 'Per agreement',
          },
        ]}
      />
    );
    expect(screen.getByRole('link', { name: 'Create invoice' })).toHaveAttribute(
      'href',
      `/workspace/receivables/create?origin=participant_portal&sourceParticipantId=${PARTICIPANT_ID}`
    );
  });
});

describe('ParticipantCommercialWorkspaceView invoice CTA placement', () => {
  it('shows Generate my invoice after onboarding is complete', () => {
    render(
      <ParticipantCommercialWorkspaceView
        workspace={workspaceModel([
          { kind: 'fixed_fee', amount: 'A$6,000', dueDate: null, dueDateLabel: null },
        ])}
        activeSection="overview"
        onSectionChange={() => undefined}
        onboarding={onboarding(true)}
        sourceParticipantId={PARTICIPANT_ID}
      />
    );
    expect(screen.getByTestId('participant-invoice-activation-cta')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Generate my invoice' })).toBeInTheDocument();
  });

  it('does not show the invoice CTA during incomplete onboarding', () => {
    render(
      <ParticipantCommercialWorkspaceView
        workspace={workspaceModel()}
        activeSection="overview"
        onSectionChange={() => undefined}
        onboarding={onboarding(false)}
        sourceParticipantId={PARTICIPANT_ID}
      />
    );
    expect(screen.queryByTestId('participant-invoice-activation-cta')).not.toBeInTheDocument();
  });
});
