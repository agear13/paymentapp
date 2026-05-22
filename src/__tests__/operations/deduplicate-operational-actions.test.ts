import {
  compressOperationalBlockers,
  deduplicateAttentionItems,
  deduplicateOperationalActions,
} from '@/lib/operations/explainability/deduplicate-operational-actions';
import type { OperationalAction } from '@/lib/operations/explainability/types';
import type { AttentionItem } from '@/lib/operations/severity/types';

describe('deduplicate operational actions', () => {
  it('removes duplicate earnings actions', () => {
    const actions: OperationalAction[] = [
      {
        id: 'a',
        action: 'Configure participant earnings',
        reason: 'x',
        impact: 'y',
        urgency: 'critical',
        destination: '/p',
      },
      {
        id: 'b',
        action: 'Configure earnings',
        reason: 'z',
        impact: 'w',
        urgency: 'critical',
        destination: '/p',
      },
    ];
    expect(deduplicateOperationalActions(actions)).toHaveLength(1);
  });

  it('hides attention items matching primary CTA', () => {
    const items: AttentionItem[] = [
      {
        id: 'participants-incomplete',
        severity: 'ACTION_REQUIRED',
        title: '2 participants need payout setup',
        explanation: 'Configure earnings',
        ctaLabel: 'Configure participant earnings',
        ctaHref: '/dashboard/projects/x/participants',
      },
    ];
    const out = deduplicateAttentionItems(items, {
      primaryActionLabel: 'Configure participant earnings',
      primaryActionHref: '/dashboard/projects/x/participants',
    });
    expect(out).toHaveLength(0);
  });

  it('compresses blockers deduped against primary action', () => {
    const blockers = [
      'Configure participant earnings before obligations',
      'No provider connected',
      'Configure participant earnings',
    ];
    const out = compressOperationalBlockers(
      blockers,
      'Configure participant earnings'
    );
    expect(out.some((b) => /Configure participant earnings/i.test(b))).toBe(false);
    expect(out).toHaveLength(1);
  });
});
