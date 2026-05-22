import {
  ensureProjectHydrated,
  isDraftProjectId,
  recoverDraftProjectRoute,
  resolveSafeOperationalRoute,
  safeOperationalNavigation,
} from '@/lib/operations/routing/operational-route-recovery';

describe('operational route recovery', () => {
  it('never treats draft ids as fatal not_found', () => {
    expect(isDraftProjectId('onb-deal-abc')).toBe(true);
    const route = resolveSafeOperationalRoute('configure_earnings', {
      projectId: 'onb-deal-abc',
      notFound: true,
    });
    expect(route.expectConfiguring).toBe(true);
    expect(route.href).toContain('/participants');
  });

  it('safeOperationalNavigation returns participants path', () => {
    expect(safeOperationalNavigation('configure_earnings', 'onb-deal-1')).toMatch(
      /\/dashboard\/projects\/onb-deal-1\/participants/
    );
  });

  it('ensureProjectHydrated allows configuring render', () => {
    const h = ensureProjectHydrated('onb-deal-x', { notFound: true });
    expect(h.phase).toBe('configuring');
    expect(h.ready).toBe(true);
  });

  it('open_project resolves overview path', () => {
    const route = resolveSafeOperationalRoute('open_project', { projectId: 'deal-99' });
    expect(route.href).toMatch(/\/dashboard\/projects\/deal-99$/);
  });

  it('recoverDraftProjectRoute matches draft-safe context', () => {
    const ctx = recoverDraftProjectRoute('draft-1', { notFound: true });
    expect(ctx.isDraftProject).toBe(true);
    expect(ctx.phase).toBe('configuring');
  });
});
