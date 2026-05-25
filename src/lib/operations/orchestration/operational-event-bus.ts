import type { OperationalEvent } from '@/lib/operations/contracts/operational-events';

type OperationalEventListener = (event: OperationalEvent) => void;

const listeners = new Set<OperationalEventListener>();
const recentEventKeys = new Map<string, number>();
const DEDUPE_MS = 500;

function eventKey(event: OperationalEvent): string {
  return `${event.type}:${event.projectId ?? ''}:${event.participantId ?? ''}:${event.timestamp}`;
}

/** Client-side operational event bus — propagates mutations without navigation. */
export function subscribeOperationalEvents(listener: OperationalEventListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dispatchOperationalEvent(event: OperationalEvent): void {
  const key = eventKey(event);
  const now = Date.now();
  const last = recentEventKeys.get(key);
  if (last != null && now - last < DEDUPE_MS) return;
  recentEventKeys.set(key, now);
  if (recentEventKeys.size > 200) {
    for (const [k, t] of recentEventKeys) {
      if (now - t > DEDUPE_MS * 4) recentEventKeys.delete(k);
    }
  }

  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Event handlers must not break propagation
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('operational-event', { detail: event }));
  }
}

export function subscribeOperationalWindowEvents(
  listener: OperationalEventListener
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<OperationalEvent>).detail;
    if (detail?.type) listener(detail);
  };
  window.addEventListener('operational-event', handler);
  return () => window.removeEventListener('operational-event', handler);
}
