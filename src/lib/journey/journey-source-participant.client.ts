'use client';

import { parseSourceParticipantHint } from '@/lib/participants/source-participant-hint';

const HINT_KEY = 'provvy.journey.sourceParticipantId';
const DISMISS_PREFIX = 'provvy.participant.workspaceCtaDismissed.';

function readStorageItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue) return sessionValue;
    const localValue = localStorage.getItem(key);
    if (localValue) {
      sessionStorage.setItem(key, localValue);
      return localValue;
    }
  } catch {
    /* ignore storage errors */
  }
  return null;
}

function writeStorageItem(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, value);
    localStorage.setItem(key, value);
  } catch {
    /* ignore storage errors */
  }
}

function removeStorageItem(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  } catch {
    /* ignore storage errors */
  }
}

export function persistSourceParticipantHint(participantId: string): void {
  const parsed = parseSourceParticipantHint(participantId);
  if (parsed.kind !== 'hint') return;
  writeStorageItem(HINT_KEY, parsed.value);
}

export function readStoredSourceParticipantHint(): string | null {
  const parsed = parseSourceParticipantHint(readStorageItem(HINT_KEY));
  return parsed.kind === 'hint' ? parsed.value : null;
}

export function clearStoredSourceParticipantHint(): void {
  removeStorageItem(HINT_KEY);
}

/**
 * Capture journey context from the provisioning URL.
 * A valid query hint overwrites storage. Missing/invalid query keeps any stored hint
 * so OAuth/email-verification returns to `?build=1` still have context.
 */
export function captureSourceParticipantHintFromSearchParams(
  searchParams: { get(name: string): string | null } | null | undefined
): string | null {
  const fromQuery = parseSourceParticipantHint(
    searchParams?.get('sourceParticipantId') ?? searchParams?.get('participantId')
  );
  if (fromQuery.kind === 'hint') {
    persistSourceParticipantHint(fromQuery.value);
    return fromQuery.value;
  }
  return readStoredSourceParticipantHint();
}

function dismissKey(participantId: string): string {
  return `${DISMISS_PREFIX}${participantId}`;
}

export function isParticipantWorkspaceCtaDismissed(participantId: string): boolean {
  const parsed = parseSourceParticipantHint(participantId);
  if (parsed.kind !== 'hint') return false;
  return readStorageItem(dismissKey(parsed.value)) === '1';
}

export function dismissParticipantWorkspaceCta(participantId: string): void {
  const parsed = parseSourceParticipantHint(participantId);
  if (parsed.kind !== 'hint') return;
  writeStorageItem(dismissKey(parsed.value), '1');
}
