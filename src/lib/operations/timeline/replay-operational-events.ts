import type { OperationalEvent } from '@/lib/operations/contracts/operational-events';
import type { CanonicalOperationalEvent } from '@/lib/operations/timeline/types';
import {
  operationalEventDedupeKey,
  toCanonicalOperationalEvent,
} from '@/lib/operations/timeline/canonical-operational-event';
import { assertEventReplayInvariants } from '@/lib/operations/dev/operational-invariants';

function compareEvents(a: OperationalEvent, b: OperationalEvent): number {
  const ta = Date.parse(a.timestamp);
  const tb = Date.parse(b.timestamp);
  if (ta !== tb) return ta - tb;
  if (a.type !== b.type) return a.type.localeCompare(b.type);
  const pa = a.participantId ?? '';
  const pb = b.participantId ?? '';
  if (pa !== pb) return pa.localeCompare(pb);
  return (a.projectId ?? '').localeCompare(b.projectId ?? '');
}

/**
 * Replay-safe normalization — sort, dedupe, assign monotonic sequence numbers.
 * Identical input streams always produce identical canonical output.
 */
export function replayOperationalEvents(events: OperationalEvent[]): CanonicalOperationalEvent[] {
  const sorted = [...events].sort(compareEvents);
  const byKey = new Map<string, OperationalEvent>();

  for (const event of sorted) {
    byKey.set(operationalEventDedupeKey(event), event);
  }

  const deduped = [...byKey.values()].sort(compareEvents);
  const canonical = deduped.map((event, index) => toCanonicalOperationalEvent(event, index + 1));

  assertEventReplayInvariants({
    inputCount: events.length,
    outputCount: canonical.length,
    sequencesMonotonic: canonical.every(
      (e, i) => i === 0 || e.sequence > canonical[i - 1]!.sequence
    ),
  });

  return canonical;
}
