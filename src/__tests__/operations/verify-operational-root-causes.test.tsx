/** @jest-environment jsdom */

import * as React from 'react';
import { render } from '@testing-library/react';
import { performance } from 'node:perf_hooks';
import { ParticipantAttributionAgreementSummary } from '@/components/projects/participant-attribution-agreement-summary';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { buildParticipantEarningsPersistenceDiagnostic } from '@/lib/operations/dev/participant-earnings-persistence-diagnostic';
import { hasPersistedCompensationTerms } from '@/lib/operations/primitives/participant-earnings-primitives';
import { getOperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import { applyCompensationProfileToParticipant } from '@/lib/participants/participant-compensation';

function attributionParticipant(overrides: Partial<DemoParticipant> = {}): DemoParticipant {
  return {
    id: 'verify-p1',
    name: 'Verify Alex',
    email: 'alex@example.com',
    role: 'Contributor',
    commissionKind: 'pct_deal_value',
    commissionValue: 10,
    status: 'Pending',
    approvalStatus: 'Pending approval',
    inviteToken: 'tok-verify',
    compensationProfile: {
      compensationType: 'COMMISSION',
      configured: true,
      configuredAt: '2026-05-01T00:00:00.000Z',
      percentage: 10,
      customerAttributionEnabled: true,
      commissionSourceMode: 'selected',
      commissionServiceIds: ['svc-1'],
    },
    referralCommerce: {
      commissionMode: 'referral_commerce',
      commerceCommissionPct: 10,
      enabledServiceIds: ['svc-1'],
    },
    ...overrides,
  };
}

const serviceRows = [
  {
    id: 'svc-1',
    name: 'Early Bird Tickets',
    customerPrice: 100,
    currency: 'AUD',
    revenueSharePct: 10,
    estimatedEarnings: 10,
    earningsLabel: 'A$10.00',
  },
];

function commercialVisibility(text: string) {
  return {
    serviceName: text.includes('Early Bird Tickets'),
    price: text.includes('100') || text.includes('A$100'),
    commissionPct: text.includes('10%'),
    estimatedEarnings: text.includes('A$10') || text.includes('10.00'),
  };
}

describe('verify operational root causes', () => {
  describe('3 — agreement preview economics', () => {
    it('shows commercial terms before approval; gates attribution activation copy only', () => {
      const participant = attributionParticipant();
      const { container } = render(
        <ParticipantAttributionAgreementSummary
          participant={participant}
          commerce={participant.referralCommerce}
          approved={false}
          catalogItems={[{ id: 'svc-1', name: 'Early Bird Tickets', price: 100, currency: 'AUD' }]}
          serviceRows={serviceRows}
        />
      );
      const text = container.textContent ?? '';
      const visibility = commercialVisibility(text);

      expect(visibility).toEqual({
        serviceName: true,
        price: true,
        commissionPct: true,
        estimatedEarnings: true,
      });
      expect(text).toContain('activate after you approve');
      expect(text).not.toContain('Active tracking is enabled');

      // eslint-disable-next-line no-console
      console.log('[verify] agreement-preview BEFORE approval excerpt:', text.replace(/\s+/g, ' ').trim());
    });

    it('keeps commercial terms after approval and shows active tracking copy', () => {
      const participant = attributionParticipant({ approvalStatus: 'Approved' });
      const { container } = render(
        <ParticipantAttributionAgreementSummary
          participant={participant}
          commerce={participant.referralCommerce}
          approved
          catalogItems={[{ id: 'svc-1', name: 'Early Bird Tickets', price: 100, currency: 'AUD' }]}
          serviceRows={serviceRows}
        />
      );
      const text = container.textContent ?? '';
      const visibility = commercialVisibility(text);

      expect(visibility).toEqual({
        serviceName: true,
        price: true,
        commissionPct: true,
        estimatedEarnings: true,
      });
      expect(text).toContain('Active tracking is enabled');
      expect(text).not.toContain('activate after you approve');

      // eslint-disable-next-line no-console
      console.log('[verify] agreement-preview AFTER approval excerpt:', text.replace(/\s+/g, ' ').trim());
    });
  });

  describe('2 — DJ Alex persistence verdict model', () => {
    it('proves verdict categories from persisted-shaped payloads (no DB)', () => {
      const coastal = applyCompensationProfileToParticipant(
        {
          id: 'coastal',
          name: 'Coastal Media',
          email: '',
          role: 'Contributor',
          commissionKind: 'pct_deal_value',
          commissionValue: 10,
          status: 'Confirmed',
          approvalStatus: 'Approved',
          inviteToken: 't1',
        } as DemoParticipant,
        {
          compensationType: 'COMMISSION',
          configured: true,
          configuredAt: '2026-05-01T00:00:00.000Z',
          percentage: 10,
          customerAttributionEnabled: true,
          commissionSourceMode: 'selected',
          commissionServiceIds: ['svc-1'],
          revenueSources: [],
        }
      );

      const djAlexNeverSaved = {
        id: 'dj-alex',
        name: 'DJ Alex',
        email: '',
        role: 'Contributor',
        commissionKind: 'fixed_amount' as const,
        commissionValue: 0,
        status: 'Confirmed',
        approvalStatus: 'Approved' as const,
        inviteToken: 't2',
        participationModel: 'fixed_payout' as const,
      } satisfies DemoParticipant;

      const partialProfileNoQualifyingTerms = {
        id: 'partial-save',
        name: 'Partial Save',
        email: '',
        role: 'Contributor',
        commissionKind: 'fixed_amount' as const,
        commissionValue: 0,
        status: 'Confirmed',
        approvalStatus: 'Approved' as const,
        inviteToken: 't3',
        compensationProfile: {
          compensationType: 'FIXED_FEE' as const,
          configured: false,
          customerAttributionEnabled: false,
          commissionSourceMode: 'all_active' as const,
          commissionServiceIds: [],
        },
      } satisfies DemoParticipant;

      function verdict(participant: DemoParticipant) {
        const profile = participant.compensationProfile;
        const configured = hasPersistedCompensationTerms(participant);
        if (configured) return 'configured';
        if (!profile) return 'a_save_never_occurred';
        if (profile.configured === true || profile.configuredAt) return 'c_persisted_selector_false';
        return 'a_save_never_occurred';
      }

      const rows = [coastal, djAlexNeverSaved, partialProfileNoQualifyingTerms].map((p) => ({
        participantId: p.id,
        name: p.name,
        compensationProfileExists: p.compensationProfile != null,
        configuredAt: p.compensationProfile?.configuredAt ?? null,
        earningsStructure: buildParticipantEarningsPersistenceDiagnostic(p).earningsStructure,
        hasPersistedCompensationTerms: hasPersistedCompensationTerms(p),
        selectorResult: buildParticipantEarningsPersistenceDiagnostic(p).selectorResult,
        persistenceVerdict: verdict(p),
      }));

      expect(rows[0].persistenceVerdict).toBe('configured');
      expect(rows[1].persistenceVerdict).toBe('a_save_never_occurred');
      expect(rows[1].hasPersistedCompensationTerms).toBe(false);
      expect(rows[2].persistenceVerdict).toBe('a_save_never_occurred');
      expect(rows[2].compensationProfileExists).toBe(true);

      // eslint-disable-next-line no-console
      console.log('[verify] participant-persistence model:', JSON.stringify(rows, null, 2));
    });
  });

  describe('1 — offline graph build timing (no DB)', () => {
    it('measures coordination graph build duration without initialization duplicate', () => {
      const participants: DemoParticipant[] = [
        applyCompensationProfileToParticipant(
          {
            id: 'p1',
            name: 'Coastal Media',
            email: '',
            role: 'Contributor',
            commissionKind: 'pct_deal_value',
            commissionValue: 10,
            status: 'Confirmed',
            approvalStatus: 'Approved',
            inviteToken: 't1',
          } as DemoParticipant,
          {
            compensationType: 'COMMISSION',
            configured: true,
            configuredAt: '2026-05-01T00:00:00.000Z',
            percentage: 10,
            customerAttributionEnabled: true,
            commissionSourceMode: 'selected',
            commissionServiceIds: ['svc-1'],
            revenueSources: [],
          }
        ),
        {
          id: 'p2',
          name: 'Beach Club Bali',
          email: '',
          role: 'Contributor',
          commissionKind: 'fixed_amount',
          commissionValue: 0,
          status: 'Confirmed',
          approvalStatus: 'Approved',
          inviteToken: 't2',
          compensationProfile: {
            compensationType: 'FIXED_FEE',
            configured: true,
            configuredAt: '2026-05-01T00:00:00.000Z',
            fixedAmount: 500,
            customerAttributionEnabled: false,
            commissionSourceMode: 'all_active',
            commissionServiceIds: [],
          },
        } as DemoParticipant,
        {
          id: 'p3',
          name: 'DJ Alex',
          email: '',
          role: 'Contributor',
          commissionKind: 'fixed_amount',
          commissionValue: 0,
          status: 'Confirmed',
          approvalStatus: 'Approved',
          inviteToken: 't3',
          participationModel: 'fixed_payout',
        } as DemoParticipant,
      ];

      const start = performance.now();
      const snapshot = getOperationalCoordinationSnapshot({ participants, projectId: 'deal-1' });
      const graphBuildMs = Math.round(performance.now() - start);

      expect(snapshot.summary.participantCount).toBe(3);
      expect(snapshot.summary.earningsConfiguredCount).toBe(2);

      const timing = {
        graphBuildMs,
        initializationMs: 0,
        note: 'coordination-snapshot default path skips initialization; activation route still runs init once per page load',
        earningsConfiguredCount: snapshot.summary.earningsConfiguredCount,
        participantCount: snapshot.summary.participantCount,
      };

      // eslint-disable-next-line no-console
      console.log('[verify] offline-graph-timing:', JSON.stringify(timing, null, 2));
    });
  });
});
