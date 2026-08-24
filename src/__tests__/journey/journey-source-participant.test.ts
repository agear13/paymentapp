/** @jest-environment jsdom */

import {
  captureSourceParticipantHintFromSearchParams,
  clearStoredSourceParticipantHint,
  persistSourceParticipantHint,
  readStoredSourceParticipantHint,
} from '@/lib/journey/journey-source-participant.client';

describe('journey source participant storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('persists a valid participant id across refresh', () => {
    persistSourceParticipantHint('  p-invite-1  ');
    sessionStorage.clear();
    expect(readStoredSourceParticipantHint()).toBe('p-invite-1');
  });

  it('captures sourceParticipantId from the URL and keeps it when later query is only build=1', () => {
    captureSourceParticipantHintFromSearchParams(
      new URLSearchParams({ sourceParticipantId: 'p-invite-1' })
    );
    expect(readStoredSourceParticipantHint()).toBe('p-invite-1');

    const kept = captureSourceParticipantHintFromSearchParams(
      new URLSearchParams({ build: '1' })
    );
    expect(kept).toBe('p-invite-1');
  });

  it('accepts participantId as a compatible alias', () => {
    captureSourceParticipantHintFromSearchParams(
      new URLSearchParams({ participantId: 'aiwf-p-abc-party1' })
    );
    expect(readStoredSourceParticipantHint()).toBe('aiwf-p-abc-party1');
  });

  it('does not persist invalid or secret-like empty values', () => {
    persistSourceParticipantHint('');
    persistSourceParticipantHint('x'.repeat(256));
    expect(readStoredSourceParticipantHint()).toBeNull();
    captureSourceParticipantHintFromSearchParams(
      new URLSearchParams({ sourceParticipantId: 'x'.repeat(256) })
    );
    expect(readStoredSourceParticipantHint()).toBeNull();
  });

  it('clears stored journey context', () => {
    persistSourceParticipantHint('p-invite-1');
    clearStoredSourceParticipantHint();
    expect(readStoredSourceParticipantHint()).toBeNull();
  });

  it('persists only the participant id, never a prefill payload', () => {
    persistSourceParticipantHint('p-invite-1');
    expect(sessionStorage.getItem('provvy.journey.sourceParticipantId')).toBe('p-invite-1');
    expect(localStorage.getItem('provvy.journey.sourceParticipantId')).toBe('p-invite-1');
    expect(sessionStorage.getItem('provvy.journey.suggestedWorkspaceName')).toBeNull();
    expect(localStorage.getItem('provvy.journey.suggestedDisplayName')).toBeNull();
    expect(sessionStorage.getItem('provvy.journey.participantPrefill')).toBeNull();
  });
});
