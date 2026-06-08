import type { AgreementIntelligenceEvent } from '@/lib/agreements/validation/agreement-intelligence-analytics';

export type StoredAgreementIntelligenceEvent = {
  id: string;
  userId: string;
  event: AgreementIntelligenceEvent;
  properties: Record<string, unknown>;
  timestamp: string;
  path?: string;
};

const MAX_EVENTS = 10_000;
const eventBuffer: StoredAgreementIntelligenceEvent[] = [];
let eventCounter = 0;

export function ingestAgreementIntelligenceEvent(input: {
  userId: string;
  event: AgreementIntelligenceEvent;
  properties?: Record<string, unknown>;
  timestamp?: string;
  path?: string;
}): StoredAgreementIntelligenceEvent {
  const stored: StoredAgreementIntelligenceEvent = {
    id: `ai-val-${++eventCounter}-${Date.now()}`,
    userId: input.userId,
    event: input.event,
    properties: input.properties ?? {},
    timestamp: input.timestamp ?? new Date().toISOString(),
    path: input.path,
  };
  eventBuffer.push(stored);
  if (eventBuffer.length > MAX_EVENTS) {
    eventBuffer.splice(0, eventBuffer.length - MAX_EVENTS);
  }
  return stored;
}

export function listAgreementIntelligenceEvents(options?: {
  since?: string;
  limit?: number;
}): StoredAgreementIntelligenceEvent[] {
  const sinceMs = options?.since ? Date.parse(options.since) : 0;
  const limit = options?.limit ?? MAX_EVENTS;
  return eventBuffer
    .filter((event) => !sinceMs || Date.parse(event.timestamp) >= sinceMs)
    .slice(-limit);
}

export function resetAgreementIntelligenceValidationStoreForTests(): void {
  eventBuffer.length = 0;
  eventCounter = 0;
}
