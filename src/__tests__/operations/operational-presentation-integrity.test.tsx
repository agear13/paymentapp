/** @jest-environment jsdom */

import * as React from 'react';
import { render } from '@testing-library/react';
import { applyCompensationProfileToParticipant } from '@/lib/participants/participant-compensation';
import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { ProjectParticipantTableRow } from '@/components/projects/project-participant-table-row';
import { ParticipantAttributionAgreementSummary } from '@/components/projects/participant-attribution-agreement-summary';
import {
  deriveCommissionScope,
  formatCompactOperationalEarnings,
  isCompensationSummaryOverflowingOperationalTable,
  resolveAgreementCatalogItems,
} from '@/lib/operations/derivations/commission-scope';
import {
  assertOperationalPresentationInvariants,
  OperationalInvariantViolation,
} from '@/lib/operations/dev/operational-invariants';

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
    projectValueCurrency: 'AUD',
  } as RecentDeal;
}

function hybridAttributionParticipant(): DemoParticipant {
  const base = buildProjectParticipant({
    name: 'Promoter',
    role: 'Partner',
    project: baseDeal(),
    participationModel: 'revenue_share',
    commissionKind: 'fixed_amount',
    commissionValue: 2000,
    enableCustomerAttribution: false,
  });
  return applyCompensationProfileToParticipant(base, {
    compensationType: 'HYBRID',
    configured: true,
    percentage: 8,
    fixedAmount: 2000,
    revenueSources: [],
    customerAttributionEnabled: true,
    commissionSourceMode: 'selected',
    commissionServiceIds: ['svc-vip'],
  });
}

function renderRow(participant: DemoParticipant, catalogItems?: Array<{ id: string; name: string }>) {
  return render(
    <table>
      <tbody>
        <ProjectParticipantTableRow
          participant={participant}
          catalogContext={{ catalogItems, workspaceCurrency: 'AUD' }}
          onCopyAgreement={() => {}}
          onPayoutVerificationChange={() => {}}
          onEdit={() => {}}
          onConfigureCompensation={() => {}}
        />
      </tbody>
    </table>
  );
}

describe('operational presentation integrity', () => {
  it('formats hybrid attribution earnings compactly for table surfaces', () => {
    const participant = hybridAttributionParticipant();
    const scope = deriveCommissionScope(participant, {
      catalogItems: [{ id: 'svc-vip', name: 'VIP Package' }],
      workspaceCurrency: 'AUD',
    });
    const compact = formatCompactOperationalEarnings(scope, participant, { workspaceCurrency: 'AUD' });
    expect(compact).toBe('8% commission + A$2,000 fixed');
    expect(compact).not.toContain('Fixed payout:');
    expect(isCompensationSummaryOverflowingOperationalTable(compact)).toBe(false);
    expect(isCompensationSummaryOverflowingOperationalTable(scope.earningsPrimary)).toBe(true);
  });

  it('renders compact hybrid earnings in participant table without verbose overflow phrasing', () => {
    const { container } = renderRow(hybridAttributionParticipant(), [
      { id: 'svc-vip', name: 'VIP Package' },
    ]);
    const text = container.textContent ?? '';
    expect(text).toContain('8% commission + A$2,000 fixed');
    expect(text).not.toContain('Fixed payout:');
    expect(text).not.toContain('revenue share + Fixed payout');
  });

  it('shows attribution scope in draft agreement before approval', () => {
    const participant = hybridAttributionParticipant();
    const { container } = render(
      <ParticipantAttributionAgreementSummary
        participant={participant}
        approved={false}
        catalogItems={[{ id: 'svc-vip', name: 'VIP Booth' }]}
        serviceRows={[
          {
            id: 'svc-vip',
            name: 'VIP Booth',
            customerPrice: 500,
            currency: 'AUD',
            revenueSharePct: 8,
            estimatedEarnings: 40,
            earningsLabel: 'A$40.00',
          },
        ]}
      />
    );
    const text = container.textContent ?? '';
    expect(text).toContain('VIP Booth');
    expect(text).toContain('Eligible services');
    expect(text).toContain('activate after you approve');
    expect(text).not.toContain('Active tracking is enabled');
  });

  it('shows all-active attribution scope copy in draft agreement', () => {
    const participant = applyCompensationProfileToParticipant(hybridAttributionParticipant(), {
      compensationType: 'HYBRID',
      configured: true,
      percentage: 8,
      fixedAmount: 2000,
      revenueSources: [],
      customerAttributionEnabled: true,
      commissionSourceMode: 'all_active',
      commissionServiceIds: [],
    });
    const { container } = render(
      <ParticipantAttributionAgreementSummary participant={participant} approved={false} />
    );
    expect(container.textContent).toContain('All active catalog items available to customers');
  });

  it('resolves agreement catalog items before approval from scoped rows', () => {
    const participant = hybridAttributionParticipant();
    const items = resolveAgreementCatalogItems(participant, [
      { id: 'svc-vip', name: 'Daybed Tickets' },
    ]);
    expect(items.map((item) => item.name)).toEqual(['Daybed Tickets']);
  });

  it('throws presentation invariants in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertOperationalPresentationInvariants({
        compensationSummaryOverflowingOperationalTable: true,
      })
    ).toThrow(OperationalInvariantViolation);
    expect(() =>
      assertOperationalPresentationInvariants({
        attributionScopeMissingFromDraftAgreement: true,
      })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });
});
