import { buildOperationalGuidance } from '@/lib/operations/explainability';
import {
  deriveOperationalSeverity,
  groupAttentionBySeverity,
} from '@/lib/operations/severity';
import { defaultWorkspaceContext } from '@/lib/operations/types/operational-context';

describe('deriveOperationalSeverity', () => {
  it('maps blocked release to CRITICAL', () => {
    const ctx = {
      ...defaultWorkspaceContext(),
      hasOrganization: true,
      participantCount: 2,
      participantsConfiguredCount: 0,
      stripeConfigured: true,
      primaryProjectId: 'p1',
    };
    const guidance = buildOperationalGuidance({ workspace: ctx });
    const items = deriveOperationalSeverity({ guidance, workspace: ctx });
    const grouped = groupAttentionBySeverity(items);
    expect(
      grouped.CRITICAL.length + grouped.ACTION_REQUIRED.length
    ).toBeGreaterThan(0);
    expect(items.some((i) => i.whyBlocked)).toBe(true);
  });

  it('never returns empty attention list', () => {
    const ctx = defaultWorkspaceContext();
    const guidance = buildOperationalGuidance({ workspace: ctx });
    const items = deriveOperationalSeverity({ guidance, workspace: ctx });
    expect(items.length).toBeGreaterThan(0);
  });
});
