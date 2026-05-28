import type { OperationalEvent } from '@/lib/operations/contracts/operational-events';
import { emitOperationalTelemetry } from '@/lib/operations/telemetry/operational-telemetry';

type OperationalEventListener = (event: OperationalEvent) => void;

const listeners = new Set<OperationalEventListener>();
const recentEventKeys = new Map<string, number>();
const DEDUPE_MS = 500;

const TAB_CHANNEL_NAME = 'provvypay-operational-events';
let tabChannel: BroadcastChannel | null = null;

function eventKey(event: OperationalEvent): string {
  return `${event.type}:${event.projectId ?? ''}:${event.participantId ?? ''}:${event.timestamp}`;
}

function getTabChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!tabChannel) {
    tabChannel = new BroadcastChannel(TAB_CHANNEL_NAME);
    tabChannel.onmessage = (message) => {
      const event = message.data as OperationalEvent;
      if (!event?.type) return;
      deliverOperationalEvent(event, { fromTab: true });
    };
  }
  return tabChannel;
}

function deliverOperationalEvent(
  event: OperationalEvent,
  meta?: { fromTab?: boolean; skipBroadcast?: boolean }
): void {
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
  if (!meta?.skipBroadcast && !meta?.fromTab) {
    getTabChannel()?.postMessage(event);
  }
}

export function subscribeOperationalEvents(listener: OperationalEventListener): () => void {
  listeners.add(listener);
  getTabChannel();
  return () => listeners.delete(listener);
}

export function dispatchOperationalEvent(event: OperationalEvent): void {
  const key = eventKey(event);
  const now = Date.now();
  const last = recentEventKeys.get(key);
  if (last != null && now - last < DEDUPE_MS) {
    emitOperationalTelemetry({
      type: 'operational_event_ordering_anomaly',
      anomaly: 'duplicate_suppressed',
      mutation: undefined,
      projectId: event.projectId ?? null,
      detail: { eventType: event.type, key },
    });
    return;
  }
  recentEventKeys.set(key, now);
  if (recentEventKeys.size > 200) {
    for (const [k, t] of recentEventKeys) {
      if (now - t > DEDUPE_MS * 4) recentEventKeys.delete(k);
    }
  }

  deliverOperationalEvent(event);
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
  getTabChannel();
  return () => window.removeEventListener('operational-event', handler);
}

export function resetOperationalEventBusForTests(): void {
  recentEventKeys.clear();
  if (tabChannel) {
    tabChannel.close();
    tabChannel = null;
  }
}
