import {
  EMPTY_TIMELINE_COMPLETENESS,
  TIMELINE_SOURCE_LIMIT,
  type CommercialTimelineCompleteness,
} from '@/lib/workspace-timeline/commercial-timeline-types';

export type TimelineSourceFetch = {
  name: string;
  fetched: number;
  limit: number;
};

/**
 * Bounded fetches use take(limit + 1). If more than `limit` rows come back,
 * older rows for that source were not loaded.
 */
export function summarizeTimelineSourceCompleteness(
  sources: TimelineSourceFetch[],
  sourceLimit = TIMELINE_SOURCE_LIMIT
): CommercialTimelineCompleteness {
  const truncatedSources = sources
    .filter((source) => source.fetched > source.limit)
    .map((source) => source.name);

  if (truncatedSources.length === 0) {
    return { ...EMPTY_TIMELINE_COMPLETENESS, sourceLimit };
  }

  return {
    complete: false,
    truncatedSources,
    sourceLimit,
  };
}

export function takeBounded<T>(rows: T[], limit: number): { rows: T[]; truncated: boolean } {
  if (rows.length <= limit) {
    return { rows, truncated: false };
  }
  return { rows: rows.slice(0, limit), truncated: true };
}
