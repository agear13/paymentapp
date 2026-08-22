'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOrganization } from '@/hooks/use-organization';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import {
  attachEarningSettlementStatus,
  buildSettlementObligationRows,
  collectPayoutReceipts,
  filterSettlementObligations,
  labelReleaseBatches,
  mapAttributionEarning,
  mapPayoutBatch,
  summarizeCommercialMovement,
  summarizeSettlement,
  type AttributionEarningsApiRow,
  type PilotObligationApiRow,
  type PayoutBatchApiRow,
  type SettlementEarningRow,
  type SettlementObligationRow,
  type SettlementPayoutReceipt,
  type SettlementReleaseRow,
  type SettlementSummary,
} from '@/lib/settlement/workspace-settlement';

type Filters = {
  source?: string | null;
  status?: string | null;
  participant?: string | null;
};

async function readJson<T>(res: Response): Promise<T | null> {
  return (await res.json().catch(() => null)) as T | null;
}

export function useWorkspaceSettlement(filters: Filters = {}) {
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const [pilotRows, setPilotRows] = useState<PilotObligationApiRow[]>([]);
  const [attributionRows, setAttributionRows] = useState<AttributionEarningsApiRow[]>([]);
  const [releases, setReleases] = useState<SettlementReleaseRow[]>([]);
  const [payoutReceipts, setPayoutReceipts] = useState<SettlementPayoutReceipt[]>([]);
  const [releasesRestricted, setReleasesRestricted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingRelease, setCreatingRelease] = useState(false);
  const [cancellingRelease, setCancellingRelease] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [obligationsRes, earningsRes, batchesRes] = await Promise.all([
        csrfAwareFetch('/api/deal-network-pilot/obligations', {
          credentials: 'include',
          cache: 'no-store',
        }),
        csrfAwareFetch('/api/commissions/attribution-earnings', {
          credentials: 'include',
          cache: 'no-store',
        }),
        csrfAwareFetch('/api/payout-batches?limit=50', {
          credentials: 'include',
          cache: 'no-store',
        }),
      ]);

      if (obligationsRes.status === 401 || earningsRes.status === 401) {
        setError('Sign in to view settlement.');
        return;
      }

      const obligationsPayload = await readJson<{ data?: PilotObligationApiRow[]; error?: string }>(
        obligationsRes
      );
      const earningsPayload = await readJson<{
        data?: AttributionEarningsApiRow[];
        error?: string;
      }>(earningsRes);
      const batchesPayload = await readJson<{ data?: PayoutBatchApiRow[]; error?: string }>(
        batchesRes
      );

      if (!obligationsRes.ok && obligationsRes.status !== 200) {
        setError(obligationsPayload?.error ?? 'Could not load settlement obligations.');
      } else {
        setError(null);
      }

      setPilotRows(Array.isArray(obligationsPayload?.data) ? obligationsPayload.data : []);
      setAttributionRows(Array.isArray(earningsPayload?.data) ? earningsPayload.data : []);

      if (batchesRes.status === 403) {
        setReleasesRestricted(true);
        setReleases([]);
        setPayoutReceipts([]);
      } else if (batchesRes.ok && Array.isArray(batchesPayload?.data)) {
        setReleasesRestricted(false);
        setReleases(labelReleaseBatches(batchesPayload.data.map(mapPayoutBatch)));
        setPayoutReceipts(collectPayoutReceipts(batchesPayload.data));
      } else {
        setReleases([]);
        setPayoutReceipts([]);
      }
    } catch {
      setError('Could not load settlement.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (orgLoading) return;
    void refresh();
  }, [orgLoading, refresh]);

  const obligations = useMemo(
    () => buildSettlementObligationRows(pilotRows, attributionRows, payoutReceipts),
    [pilotRows, attributionRows, payoutReceipts]
  );
  const filtered = useMemo(
    () => filterSettlementObligations(obligations, filters),
    [obligations, filters.source, filters.status, filters.participant]
  );
  const earnings = useMemo(() => {
    const mapped = attachEarningSettlementStatus(
      attributionRows.map(mapAttributionEarning),
      obligations
    );
    return mapped.filter((row) => {
      if (filters.source && filters.source !== 'all' && row.source !== filters.source) {
        return false;
      }
      if (filters.participant && row.participantId !== filters.participant) return false;
      return true;
    });
  }, [attributionRows, obligations, filters.source, filters.participant]);
  const summary = useMemo(() => summarizeSettlement(filtered), [filtered]);
  const platformSummary = useMemo(() => summarizeSettlement(obligations), [obligations]);
  const movement = useMemo(
    () =>
      summarizeCommercialMovement({
        earnings: attributionRows,
        releases,
        obligations: filtered,
      }),
    [attributionRows, releases, filtered]
  );

  const createRelease = useCallback(
    async (input: { participantIds: string[]; currency: string }) => {
      if (!organizationId) return { ok: false as const, error: 'No organization found.' };
      setCreatingRelease(true);
      try {
        const res = await csrfAwareFetch('/api/payout-batches/create', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId,
            currency: input.currency,
            participantIds: input.participantIds,
          }),
        });
        const payload = await readJson<{ error?: string; data?: { id?: string } }>(res);
        if (res.status === 403) {
          return {
            ok: false as const,
            error: 'Release execution is currently restricted. Ready obligations are still listed here.',
          };
        }
        if (!res.ok) {
          return { ok: false as const, error: payload?.error ?? 'Could not create a release batch.' };
        }
        await refresh();
        return { ok: true as const, id: payload?.data?.id ?? null };
      } catch {
        return { ok: false as const, error: 'Could not create a release batch.' };
      } finally {
        setCreatingRelease(false);
      }
    },
    [organizationId, refresh]
  );

  const cancelRelease = useCallback(
    async (batchId: string) => {
      setCancellingRelease(true);
      try {
        const res = await csrfAwareFetch(`/api/payout-batches/${batchId}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        const payload = await readJson<{ error?: string }>(res);
        if (res.status === 403) {
          return {
            ok: false as const,
            error: 'Release cancellation is currently restricted.',
          };
        }
        if (!res.ok) {
          return {
            ok: false as const,
            error: payload?.error ?? 'Could not cancel this draft release.',
          };
        }
        await refresh();
        return { ok: true as const };
      } catch {
        return { ok: false as const, error: 'Could not cancel this draft release.' };
      } finally {
        setCancellingRelease(false);
      }
    },
    [refresh]
  );

  return {
    organizationId,
    loading: loading || orgLoading,
    error,
    obligations,
    filtered,
    earnings,
    releases,
    releasesRestricted,
    summary,
    platformSummary,
    movement,
    refresh,
    createRelease,
    creatingRelease,
    cancelRelease,
    cancellingRelease,
  };
}

export type WorkspaceSettlementData = {
  obligations: SettlementObligationRow[];
  earnings: SettlementEarningRow[];
  releases: SettlementReleaseRow[];
  summary: SettlementSummary;
};
