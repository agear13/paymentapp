import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  isDraftProjectId,
  safeCompensationRouteContext,
  safeOperationalRouteState,
  safeParticipantRouteContext,
  safeProjectRouteContext,
  shouldShowParticipantCompensationSetupGuidance,
} from '@/lib/operations/routing/draft-safe-routing';
import {
  assertParticipantSetupGuidanceInvariants,
  OperationalInvariantViolation,
} from '@/lib/operations/dev/operational-invariants';

function baseDeal(overrides: Partial<RecentDeal> = {}): RecentDeal {
  return {
    id: 'onb-deal-abc',
    dealName: 'Pilot deal',
    status: 'Active',
    setupStatus: 'configuring',
    ...overrides,
  } as RecentDeal;
}

function baseParticipant(overrides: Partial<DemoParticipant> = {}): DemoParticipant {
  return {
    id: 'p1',
    name: 'Alex',
    email: 'alex@example.com',
    role: 'Contributor',
    commissionKind: 'fixed_amount',
    commissionValue: 0,
    status: 'Pending',
    ...overrides,
  } as DemoParticipant;
}

describe('draft-safe routing', () => {
  it('detects draft project ids', () => {
    expect(isDraftProjectId('onb-deal-xyz')).toBe(true);
    expect(isDraftProjectId('draft-123')).toBe(true);
    expect(isDraftProjectId('deal-123')).toBe(false);
  });

  it('treats missing draft deal as configuring, not hard not_found', () => {
    const ctx = safeProjectRouteContext({
      projectId: 'onb-deal-abc',
      deal: null,
      notFound: true,
    });
    expect(ctx.phase).toBe('configuring');
    expect(ctx.canRenderParticipants).toBe(true);
    expect(ctx.guidance).toMatch(/syncing/i);
  });

  it('normalizes empty participant lists without throwing', () => {
    const ctx = safeParticipantRouteContext(null);
    expect(ctx.total).toBe(0);
    expect(ctx.needsEarningsConfiguration).toBe(false);
    expect(ctx.guidance).toMatch(/Add participants/i);
  });

  it('flags earnings configuration when compensation is missing', () => {
    const ctx = safeParticipantRouteContext([
      baseParticipant({ id: 'p1' }),
      baseParticipant({
        id: 'p2',
        compensationProfile: {
          compensationType: 'FIXED_FEE',
          configured: true,
          revenueSources: [],
        },
      }),
    ]);
    expect(ctx.total).toBe(2);
    expect(ctx.configuredCount).toBe(1);
    expect(ctx.needsEarningsConfiguration).toBe(true);
    expect(ctx.guidance).toMatch(/earnings configured/i);
  });

  it('safeCompensationRouteContext guides before participants exist', () => {
    const comp = safeCompensationRouteContext([]);
    expect(comp.canConfigure).toBe(false);
    expect(comp.message).toMatch(/Add at least one participant/i);
  });

  it('safeOperationalRouteState survives degraded orchestration', () => {
    const state = safeOperationalRouteState({
      projectId: 'onb-deal-abc',
      deal: baseDeal(),
      participants: [baseParticipant()],
    });
    expect(state.project.phase).toBe('configuring');
    expect(state.participants.total).toBe(1);
    expect(state.compensation.canConfigure).toBe(true);
  });

  it('does not show compensation setup guidance when all participants are payout-ready', () => {
    const payoutReadyParticipant = baseParticipant({
      compensationProfile: {
        compensationType: 'FIXED_FEE',
        fixedAmount: 5000,
        configured: true,
        revenueSources: [],
      },
      approvalStatus: 'Approved',
      payoutVerificationConfirmed: true,
    });
    const ctx = safeParticipantRouteContext([payoutReadyParticipant]);
    expect(ctx.needsEarningsConfiguration).toBe(false);
    expect(ctx.payoutReadyCount).toBe(1);
    expect(ctx.showCompensationSetupGuidance).toBe(false);
    expect(shouldShowParticipantCompensationSetupGuidance(ctx)).toBe(false);
  });

  it('hides compensation guidance on configuring project when earnings are complete', () => {
    const state = safeOperationalRouteState({
      projectId: 'onb-deal-abc',
      deal: baseDeal({ setupStatus: 'configuring' }),
      participants: [
        baseParticipant({
          compensationProfile: {
            compensationType: 'FIXED_FEE',
            fixedAmount: 5000,
            configured: true,
            revenueSources: [],
          },
          approvalStatus: 'Approved',
          payoutVerificationConfirmed: true,
        }),
      ],
    });
    expect(state.project.phase).toBe('configuring');
    expect(state.participants.showCompensationSetupGuidance).toBe(false);
  });

  it('throws GUIDANCE_SHOWS_CONFIGURATION_BLOCKER_FOR_PAYOUT_READY_PARTICIPANT in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(() =>
      assertParticipantSetupGuidanceInvariants({
        showCompensationSetupGuidance: true,
        needsEarningsConfiguration: false,
        payoutReadyCount: 2,
        total: 2,
      })
    ).toThrow(OperationalInvariantViolation);
    process.env.NODE_ENV = prev;
  });
});
