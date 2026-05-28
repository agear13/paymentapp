/** @jest-environment jsdom */

import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectParticipantTableRow } from '@/components/projects/project-participant-table-row';
import { ParticipantCompensationDialog } from '@/components/projects/participant-compensation-dialog';
import { ProjectSectionErrorBoundary } from '@/components/projects/project-section-error-boundary';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  initializeCompensationDraft,
  prepareParticipantForCompensationEdit,
} from '@/lib/participants/initialize-compensation-draft';
import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import type { RecentDeal } from '@/lib/data/mock-deal-network';

function baseDeal(): RecentDeal {
  return {
    id: 'deal-1',
    dealName: 'Test',
    partner: 'Test',
    value: 1000,
    introducer: '—',
    closer: '—',
    status: 'Pending',
    lastUpdated: new Date().toISOString(),
    paymentStatus: 'Not Paid',
    setupStatus: 'configuring',
  } as RecentDeal;
}

function draftParticipant(): DemoParticipant {
  return buildProjectParticipant({
    name: 'Draft Alex',
    role: 'Contributor',
    project: baseDeal(),
    participationModel: 'fixed_payout',
    commissionKind: 'fixed_amount',
    commissionValue: 100,
    enableCustomerAttribution: false,
  });
}

function unconfiguredDraftParticipant(): DemoParticipant {
  const p = draftParticipant();
  return {
    ...p,
    commissionValue: 0,
    compensationProfile: {
      compensationType: 'FIXED_FEE',
      configured: false,
      customerAttributionEnabled: false,
      commissionSourceMode: 'all_active',
      commissionServiceIds: [],
    },
  };
}

function legacyParticipant(): DemoParticipant {
  return {
    id: 'legacy-1',
    name: 'Legacy Sam',
    email: '',
    role: 'Contributor',
    commissionKind: 'fixed_amount',
    commissionValue: 0,
    status: 'Pending',
    approvalStatus: 'Pending approval',
    inviteToken: 'tok-legacy',
  } as DemoParticipant;
}

function renderRow(
  participant: DemoParticipant,
  onConfigureCompensation: jest.Mock
) {
  return render(
    <table>
      <tbody>
        <ProjectParticipantTableRow
          participant={participant}
          onCopyAgreement={() => {}}
          onPayoutVerificationChange={() => {}}
          onEdit={() => {}}
          onConfigureCompensation={onConfigureCompensation}
        />
      </tbody>
    </table>
  );
}

describe('configure earnings flow', () => {
  describe('initializeCompensationDraft', () => {
    it('returns safe defaults for draft participants without compensation profile', () => {
      const draft = initializeCompensationDraft(draftParticipant());
      expect(draft.compensationType).toBe('FIXED_FEE');
      expect(draft.configured).toBe(false);
      expect(draft.customerAttributionEnabled).toBe(false);
      expect(draft.commissionSourceMode).toBe('all_active');
      expect(draft.commissionServiceIds).toEqual([]);
    });

    it('hydrates legacy participants without throwing', () => {
      const prepared = prepareParticipantForCompensationEdit(legacyParticipant());
      expect(prepared.id).toBe('legacy-1');
      expect(prepared.payoutVerificationConfirmed).toBe(false);
      const draft = initializeCompensationDraft(prepared);
      expect(draft.compensationType).toBeTruthy();
    });
  });

  describe('participant table earnings action', () => {
    it('opens compensation locally for draft participant via earnings cell', () => {
      const onConfigure = jest.fn();
      renderRow(unconfiguredDraftParticipant(), onConfigure);
      fireEvent.click(screen.getByRole('button', { name: /Not configured/i }));
      expect(onConfigure).toHaveBeenCalledTimes(1);
      expect(onConfigure.mock.calls[0][0].name).toBe('Draft Alex');
    });

    it('opens compensation for participant without agreement', () => {
      const onConfigure = jest.fn();
      const p = prepareParticipantForCompensationEdit(unconfiguredDraftParticipant());
      expect(p.agreementLifecycle).toBe('NOT_CREATED');
      renderRow(p, onConfigure);
      fireEvent.click(screen.getByRole('button', { name: /Not configured/i }));
      expect(onConfigure).toHaveBeenCalledTimes(1);
    });

    it('opens compensation for participant without attribution enabled', () => {
      const onConfigure = jest.fn();
      const p = {
        ...prepareParticipantForCompensationEdit(unconfiguredDraftParticipant()),
        compensationProfile: {
          compensationType: 'FIXED_FEE' as const,
          configured: false,
          customerAttributionEnabled: false,
          commissionSourceMode: 'all_active' as const,
          commissionServiceIds: [],
        },
      };
      renderRow(p, onConfigure);
      fireEvent.click(screen.getByRole('button', { name: /Not configured/i }));
      expect(onConfigure).toHaveBeenCalledTimes(1);
      expect(onConfigure.mock.calls[0][0].compensationProfile?.customerAttributionEnabled).toBe(
        false
      );
    });
  });

  describe('ParticipantCompensationDialog', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it('opens for draft participant without agreement', () => {
      render(
        <ParticipantCompensationDialog
          participant={draftParticipant()}
          projectId="deal-1"
          organizationId="org-1"
          open
          onOpenChange={() => {}}
          onSave={async () => {}}
        />
      );
      expect(screen.getByText(/Compensation structure · Draft Alex/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /Save compensation/i })).toBeTruthy();
    });

    it('shows non-fatal catalog warning when service catalog fetch fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('network'));
      render(
        <ParticipantCompensationDialog
          participant={{
            ...draftParticipant(),
            compensationProfile: {
              compensationType: 'COMMISSION',
              configured: false,
              percentage: 10,
              customerAttributionEnabled: false,
              commissionSourceMode: 'all_active',
              commissionServiceIds: [],
            },
          }}
          projectId="deal-1"
          organizationId="org-1"
          open
          onOpenChange={() => {}}
          onSave={async () => {}}
        />
      );
      await waitFor(() => {
        expect(
          screen.getByText(/Service catalog unavailable right now/i)
        ).toBeTruthy();
      });
      expect(screen.getByRole('button', { name: /Save compensation/i })).toBeTruthy();
    });

    it('does not block save when catalog fetch fails but attribution all-active is selected', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('network'));
      const onSave = jest.fn().mockResolvedValue(undefined);
      render(
        <ParticipantCompensationDialog
          participant={{
            ...draftParticipant(),
            compensationProfile: {
              compensationType: 'COMMISSION',
              configured: false,
              percentage: 10,
              customerAttributionEnabled: true,
              commissionSourceMode: 'all_active',
              commissionServiceIds: [],
            },
          }}
          projectId="deal-1"
          organizationId="org-1"
          open
          onOpenChange={() => {}}
          onSave={onSave}
        />
      );
      await waitFor(() => {
        expect(
          screen.getByText(/Service catalog unavailable right now/i)
        ).toBeTruthy();
      });
      const saveBtn = screen.getByRole('button', { name: /Save compensation/i });
      expect((saveBtn as HTMLButtonElement).disabled).toBe(false);
      fireEvent.click(saveBtn);
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      expect(onSave.mock.calls[0][0].configured).toBe(true);
    });

    it('saves compensation after hydration', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      render(
        <ParticipantCompensationDialog
          participant={legacyParticipant()}
          projectId="deal-1"
          open
          onOpenChange={() => {}}
          onSave={onSave}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: /Save compensation/i }));
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      expect(onSave.mock.calls[0][0].configured).toBe(true);
    });
  });

  describe('setup error surface isolation', () => {
    function ThrowOnRender() {
      throw new Error('modal init crash');
    }

    it('does not show setup-step messaging for default participant boundary scope', () => {
      const BoundaryProbe = () => (
        <ProjectSectionErrorBoundary sectionTitle="Participant earnings" boundaryScope="default">
          <ThrowOnRender />
        </ProjectSectionErrorBoundary>
      );
      render(<BoundaryProbe />);
      expect(screen.queryByText('Setup step temporarily unavailable')).toBeNull();
      expect(screen.getByText(/Participant earnings unavailable/i)).toBeTruthy();
    });

    it('keeps table mounted when modal sibling throws outside boundary', () => {
      render(
        <>
          <div data-testid="participants-table">Participants table</div>
          <ProjectSectionErrorBoundary sectionTitle="Compensation modal" boundaryScope="default">
            <ThrowOnRender />
          </ProjectSectionErrorBoundary>
        </>
      );
      expect(screen.getByTestId('participants-table')).toBeTruthy();
      expect(screen.queryByText('Setup step temporarily unavailable')).toBeNull();
    });
  });
});
