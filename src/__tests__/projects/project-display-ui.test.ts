import {
  getProjectDisplayName,
  looksLikeInternalSystemId,
  UNTITLED_PROJECT_LABEL,
} from '@/lib/projects/get-project-display-name';
import { formatOperationalStage } from '@/lib/projects/format-operational-stage';
import {
  formatParticipantPayoutReadiness,
  formatParticipantPayoutSummary,
} from '@/lib/projects/format-participant-payout-readiness';

describe('getProjectDisplayName', () => {
  it('returns project name when present', () => {
    expect(getProjectDisplayName({ name: 'Beach Club Retainer' })).toBe('Beach Club Retainer');
  });

  it('falls back to dealName', () => {
    expect(getProjectDisplayName({ dealName: 'Winter Campaign' })).toBe('Winter Campaign');
  });

  it('never exposes internal onboarding ids', () => {
    expect(getProjectDisplayName({ dealName: 'Onb-deal-1779076794753' })).toBe(
      UNTITLED_PROJECT_LABEL
    );
  });

  it('returns untitled when missing', () => {
    expect(getProjectDisplayName(null)).toBe(UNTITLED_PROJECT_LABEL);
  });
});

describe('looksLikeInternalSystemId', () => {
  it('detects onboarding deal ids', () => {
    expect(looksLikeInternalSystemId('Onb-deal-1779076794753')).toBe(true);
  });
});

describe('formatOperationalStage', () => {
  it('maps Introduced to operator-friendly label', () => {
    expect(formatOperationalStage('Introduced')).toBe('Setup in progress');
  });
});

describe('formatParticipantPayoutReadiness', () => {
  it('avoids 0/0 display', () => {
    expect(formatParticipantPayoutReadiness(0, 0)).toBe('No participants added');
  });

  it('shows ratio when participants exist', () => {
    expect(formatParticipantPayoutReadiness(2, 3)).toBe('2 of 3 payout-ready');
  });

  it('summarizes empty state', () => {
    expect(formatParticipantPayoutSummary(0, 0)).toBe(
      'Add participants to begin payout coordination'
    );
  });
});
