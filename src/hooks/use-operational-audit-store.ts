'use client';

import * as React from 'react';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import { mergeAuditTimeline } from '@/lib/operations/audit/operational-audit';

type AuditListener = (entries: OperationalAuditEntry[]) => void;

let globalEntries: OperationalAuditEntry[] = [];
const listeners = new Set<AuditListener>();

export function getOperationalAuditEntries(): OperationalAuditEntry[] {
  return globalEntries;
}

export function appendOperationalAuditEntry(entry: OperationalAuditEntry): void {
  globalEntries = mergeAuditTimeline(globalEntries, [entry]);
  for (const listener of listeners) listener(globalEntries);
}

export function setOperationalAuditEntries(entries: OperationalAuditEntry[]): void {
  globalEntries = mergeAuditTimeline([], entries);
  for (const listener of listeners) listener(globalEntries);
}

export function subscribeOperationalAuditStore(listener: AuditListener): () => void {
  listeners.add(listener);
  listener(globalEntries);
  return () => listeners.delete(listener);
}

/** Shared audit store — all operational surfaces subscribe to the same timeline. */
export function useOperationalAuditStore(filter?: {
  projectId?: string;
  participantId?: string;
}): OperationalAuditEntry[] {
  const [entries, setEntries] = React.useState<OperationalAuditEntry[]>(globalEntries);

  React.useEffect(() => subscribeOperationalAuditStore(setEntries), []);

  return React.useMemo(() => {
    if (!filter?.projectId && !filter?.participantId) return entries;
    return entries.filter((e) => {
      if (filter.projectId && e.projectId && e.projectId !== filter.projectId) return false;
      if (filter.participantId && e.participantId && e.participantId !== filter.participantId)
        return false;
      return true;
    });
  }, [entries, filter?.projectId, filter?.participantId]);
}

export function resetOperationalAuditStoreForTests(): void {
  globalEntries = [];
  for (const listener of listeners) listener(globalEntries);
}
