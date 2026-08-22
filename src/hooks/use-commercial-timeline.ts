'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { interpretCommercialTimelineAccount } from '@/lib/workspace-timeline/commercial-timeline-account';
import {
  collectTimelineParticipants,
  collectTimelineRelationshipNames,
  filterCommercialTimeline,
  groupCommercialTimeline,
} from '@/lib/workspace-timeline/commercial-timeline-mapper';
import type { TimelineParticipantOption } from '@/lib/workspace-timeline/commercial-timeline-types';
import type {
  CommercialTimelineAccountStatus,
  CommercialTimelineCompleteness,
  CommercialTimelineEvent,
  CommercialTimelineFilter,
  CommercialTimelineGroup,
} from '@/lib/workspace-timeline/commercial-timeline-types';
import { EMPTY_TIMELINE_COMPLETENESS } from '@/lib/workspace-timeline/commercial-timeline-types';

type TimelineApiResponse = {
  status?: CommercialTimelineAccountStatus;
  organizationId?: string;
  events?: CommercialTimelineEvent[];
  hasCommercialActivity?: boolean;
  completeness?: CommercialTimelineCompleteness;
  error?: string;
};

export function useCommercialTimeline() {
  const [events, setEvents] = useState<CommercialTimelineEvent[]>([]);
  const [hasCommercialActivity, setHasCommercialActivity] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [accountState, setAccountState] = useState<'no_organization' | 'empty' | 'ready'>('empty');
  const [completeness, setCompleteness] = useState<CommercialTimelineCompleteness>(
    EMPTY_TIMELINE_COMPLETENESS
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<CommercialTimelineFilter>('all');
  const [participantId, setParticipantId] = useState('');
  const [relationshipName, setRelationshipName] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/workspace/timeline', {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as TimelineApiResponse | null;

      if (response.status === 401) {
        setError('Sign in to view the timeline.');
        setEvents([]);
        setAccountState('empty');
        return;
      }
      if (!response.ok) {
        setError(payload?.error || 'Failed to load timeline.');
        setEvents([]);
        return;
      }

      const nextEvents = Array.isArray(payload?.events) ? payload.events : [];
      const nextOrgId = payload?.organizationId ?? null;
      const nextHasCommercial = payload?.hasCommercialActivity === true;
      setOrganizationId(nextOrgId);
      setEvents(nextEvents);
      setHasCommercialActivity(nextHasCommercial);
      setCompleteness(payload?.completeness ?? EMPTY_TIMELINE_COMPLETENESS);
      setAccountState(
        interpretCommercialTimelineAccount({
          status: payload?.status,
          organizationId: nextOrgId,
          hasCommercialActivity: nextHasCommercial,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredEvents = useMemo(
    () => filterCommercialTimeline(events, { category, participantId, relationshipName }),
    [events, category, participantId, relationshipName]
  );

  const groups: CommercialTimelineGroup[] = useMemo(
    () => groupCommercialTimeline(filteredEvents),
    [filteredEvents]
  );

  const participants: TimelineParticipantOption[] = useMemo(
    () => collectTimelineParticipants(events),
    [events]
  );
  const relationshipNames = useMemo(() => collectTimelineRelationshipNames(events), [events]);
  const relationshipFilter = participantId
    ? `participant:${participantId}`
    : relationshipName
      ? `relationship:${relationshipName}`
      : '';

  const setRelationshipFilter = useCallback((value: string) => {
    if (value.startsWith('participant:')) {
      setParticipantId(value.slice('participant:'.length));
      setRelationshipName('');
      return;
    }
    if (value.startsWith('relationship:')) {
      setRelationshipName(value.slice('relationship:'.length));
      setParticipantId('');
      return;
    }
    setParticipantId('');
    setRelationshipName('');
  }, []);

  return {
    loading,
    error,
    organizationId,
    accountState,
    events,
    filteredEvents,
    groups,
    participants,
    relationshipNames,
    hasCommercialActivity,
    completeness,
    category,
    setCategory,
    relationshipFilter,
    setRelationshipFilter,
    refresh,
  };
}
