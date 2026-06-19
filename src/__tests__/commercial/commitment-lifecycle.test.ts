/**
 * Regression tests — Commercial Commitment Lifecycle
 *
 * Covers:
 *   - Stage ordering is stable and complete
 *   - Stage indices are sequential
 *   - Helpers: isStageAtOrBefore, isStageBeforeStage, nextCommitmentStage
 *   - Progress calculation is monotonically increasing
 *   - parseCommitmentStage handles valid, invalid, and null values
 *   - No duplicate lifecycle definitions
 */

import {
  COMMITMENT_STAGE_ORDER,
  COMMITMENT_STAGE_LABELS,
  COMMITMENT_STAGE_SHORT_LABELS,
  COMMITMENT_STAGE_IMPACT,
  stageIndex,
  isStageAtOrBefore,
  isStageBeforeStage,
  nextCommitmentStage,
  parseCommitmentStage,
  commitmentStageProgress,
} from '../../lib/commercial/commitment-lifecycle';

/* ─── Lifecycle ordering ─────────────────────────────────────────────────── */

describe('COMMITMENT_STAGE_ORDER', () => {
  it('contains exactly 9 stages', () => {
    expect(COMMITMENT_STAGE_ORDER).toHaveLength(9);
  });

  it('starts with negotiated', () => {
    expect(COMMITMENT_STAGE_ORDER[0]).toBe('negotiated');
  });

  it('ends with settlement_complete', () => {
    expect(COMMITMENT_STAGE_ORDER[COMMITMENT_STAGE_ORDER.length - 1]).toBe('settlement_complete');
  });

  it('contains the expected lifecycle sequence', () => {
    expect(COMMITMENT_STAGE_ORDER).toEqual([
      'negotiated',
      'agreement_generated',
      'agreement_approved',
      'obligations_created',
      'invoice_requested',
      'invoice_received',
      'exported_to_xero',
      'payment_released',
      'settlement_complete',
    ]);
  });

  it('has no duplicate stages', () => {
    const unique = new Set(COMMITMENT_STAGE_ORDER);
    expect(unique.size).toBe(COMMITMENT_STAGE_ORDER.length);
  });
});

/* ─── Label completeness ─────────────────────────────────────────────────── */

describe('COMMITMENT_STAGE_LABELS', () => {
  it('has a label for every stage', () => {
    for (const stage of COMMITMENT_STAGE_ORDER) {
      expect(COMMITMENT_STAGE_LABELS[stage]).toBeTruthy();
    }
  });

  it('has no empty labels', () => {
    for (const stage of COMMITMENT_STAGE_ORDER) {
      expect(COMMITMENT_STAGE_LABELS[stage].length).toBeGreaterThan(0);
    }
  });
});

describe('COMMITMENT_STAGE_SHORT_LABELS', () => {
  it('has a short label for every stage', () => {
    for (const stage of COMMITMENT_STAGE_ORDER) {
      expect(COMMITMENT_STAGE_SHORT_LABELS[stage]).toBeTruthy();
    }
  });
});

describe('COMMITMENT_STAGE_IMPACT', () => {
  it('has a commercial impact for every stage', () => {
    for (const stage of COMMITMENT_STAGE_ORDER) {
      expect(COMMITMENT_STAGE_IMPACT[stage]).toBeTruthy();
    }
  });

  it('every impact is a non-empty sentence', () => {
    for (const stage of COMMITMENT_STAGE_ORDER) {
      const impact = COMMITMENT_STAGE_IMPACT[stage];
      expect(impact.length).toBeGreaterThan(10);
      expect(impact).toMatch(/\./);
    }
  });

  it('no impact uses technical language', () => {
    const techTerms = ['audit', 'entity', 'record updated', 'status recalculated', 'system sync', 'webhook'];
    for (const stage of COMMITMENT_STAGE_ORDER) {
      const impact = COMMITMENT_STAGE_IMPACT[stage].toLowerCase();
      for (const term of techTerms) {
        expect(impact).not.toContain(term.toLowerCase());
      }
    }
  });
});

/* ─── stageIndex ─────────────────────────────────────────────────────────── */

describe('stageIndex', () => {
  it('returns 0 for negotiated', () => {
    expect(stageIndex('negotiated')).toBe(0);
  });

  it('returns 8 for settlement_complete', () => {
    expect(stageIndex('settlement_complete')).toBe(8);
  });

  it('returns sequential indices', () => {
    for (let i = 0; i < COMMITMENT_STAGE_ORDER.length; i++) {
      expect(stageIndex(COMMITMENT_STAGE_ORDER[i])).toBe(i);
    }
  });

  it('returns -1 for unknown stage', () => {
    expect(stageIndex('unknown_stage')).toBe(-1);
  });
});

/* ─── isStageAtOrBefore ─────────────────────────────────────────────────── */

describe('isStageAtOrBefore', () => {
  it('returns true for same stage', () => {
    expect(isStageAtOrBefore('negotiated', 'negotiated')).toBe(true);
    expect(isStageAtOrBefore('settlement_complete', 'settlement_complete')).toBe(true);
  });

  it('returns true for earlier stage', () => {
    expect(isStageAtOrBefore('negotiated', 'agreement_approved')).toBe(true);
    expect(isStageAtOrBefore('agreement_generated', 'settlement_complete')).toBe(true);
  });

  it('returns false for later stage', () => {
    expect(isStageAtOrBefore('settlement_complete', 'negotiated')).toBe(false);
    expect(isStageAtOrBefore('payment_released', 'agreement_approved')).toBe(false);
  });
});

/* ─── isStageBeforeStage ────────────────────────────────────────────────── */

describe('isStageBeforeStage', () => {
  it('returns false for same stage', () => {
    expect(isStageBeforeStage('negotiated', 'negotiated')).toBe(false);
  });

  it('returns true when a is strictly before b', () => {
    expect(isStageBeforeStage('negotiated', 'agreement_approved')).toBe(true);
    expect(isStageBeforeStage('invoice_requested', 'settlement_complete')).toBe(true);
  });

  it('returns false when a is after b', () => {
    expect(isStageBeforeStage('payment_released', 'obligations_created')).toBe(false);
  });
});

/* ─── nextCommitmentStage ───────────────────────────────────────────────── */

describe('nextCommitmentStage', () => {
  it('returns next stage in sequence', () => {
    expect(nextCommitmentStage('negotiated')).toBe('agreement_generated');
    expect(nextCommitmentStage('agreement_generated')).toBe('agreement_approved');
    expect(nextCommitmentStage('payment_released')).toBe('settlement_complete');
  });

  it('returns null for the final stage', () => {
    expect(nextCommitmentStage('settlement_complete')).toBeNull();
  });

  it('every stage except settlement_complete has a next', () => {
    const allExceptLast = COMMITMENT_STAGE_ORDER.slice(0, -1);
    for (const stage of allExceptLast) {
      expect(nextCommitmentStage(stage)).not.toBeNull();
    }
  });
});

/* ─── parseCommitmentStage ──────────────────────────────────────────────── */

describe('parseCommitmentStage', () => {
  it('parses all valid stages', () => {
    for (const stage of COMMITMENT_STAGE_ORDER) {
      expect(parseCommitmentStage(stage)).toBe(stage);
    }
  });

  it('returns null for unknown string', () => {
    expect(parseCommitmentStage('unknown')).toBeNull();
    expect(parseCommitmentStage('NEGOTIATED')).toBeNull();
  });

  it('returns null for null / undefined / empty', () => {
    expect(parseCommitmentStage(null)).toBeNull();
    expect(parseCommitmentStage(undefined)).toBeNull();
    expect(parseCommitmentStage('')).toBeNull();
  });
});

/* ─── commitmentStageProgress ───────────────────────────────────────────── */

describe('commitmentStageProgress', () => {
  it('returns values between 1 and 100', () => {
    for (const stage of COMMITMENT_STAGE_ORDER) {
      const progress = commitmentStageProgress(stage);
      expect(progress).toBeGreaterThanOrEqual(1);
      expect(progress).toBeLessThanOrEqual(100);
    }
  });

  it('is monotonically increasing', () => {
    const progressions = COMMITMENT_STAGE_ORDER.map(commitmentStageProgress);
    for (let i = 1; i < progressions.length; i++) {
      expect(progressions[i]).toBeGreaterThan(progressions[i - 1]);
    }
  });

  it('settlement_complete returns 100', () => {
    expect(commitmentStageProgress('settlement_complete')).toBe(100);
  });

  it('negotiated returns > 0', () => {
    expect(commitmentStageProgress('negotiated')).toBeGreaterThan(0);
  });
});
