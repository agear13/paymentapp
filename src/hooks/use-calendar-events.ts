'use client';

import * as React from 'react';
import { deriveCalendarEvents } from '@/lib/calendar/derive-calendar-events';
import { filterCalendarEvents } from '@/lib/calendar/calendar-utils';
import type {
  CalendarDerivationInput,
  CalendarEvent,
  CalendarFilters,
  CalendarPaymentLinkInput,
  CalendarObligationInput,
} from '@/lib/calendar/types';
import { DEFAULT_CALENDAR_FILTERS as DEFAULT_FILTERS } from '@/lib/calendar/types';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { ProjectFundingSourceDto } from '@/lib/projects/funding-sources/types';

function normalizePaymentLink(raw: Record<string, unknown>): CalendarPaymentLinkInput {
  return {
    id: String(raw.id),
    shortCode: String(raw.shortCode ?? ''),
    status: String(raw.status ?? 'OPEN'),
    amount: Number(raw.amount ?? 0),
    currency: String(raw.currency ?? 'AUD'),
    invoiceCurrency: raw.invoiceCurrency ? String(raw.invoiceCurrency) : null,
    commercialCurrency: raw.commercialCurrency ? String(raw.commercialCurrency) : null,
    commercialAmount: raw.commercialAmount != null ? Number(raw.commercialAmount) : null,
    accountingCurrency: raw.accountingCurrency ? String(raw.accountingCurrency) : null,
    accountingAmount: raw.accountingAmount != null ? Number(raw.accountingAmount) : null,
    settlementCurrency: raw.settlementCurrency ? String(raw.settlementCurrency) : null,
    settlementAmount: raw.settlementAmount != null ? Number(raw.settlementAmount) : null,
    description: String(raw.description ?? ''),
    invoiceReference: raw.invoiceReference ? String(raw.invoiceReference) : null,
    customerName: raw.customerName ? String(raw.customerName) : null,
    dueDate: raw.dueDate ? String(raw.dueDate) : null,
    invoiceDate: raw.invoiceDate ? String(raw.invoiceDate) : null,
    expiresAt: raw.expiresAt ? String(raw.expiresAt) : null,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    pilotDealId: raw.pilotDealId ? String(raw.pilotDealId) : null,
    xeroInvoiceNumber: raw.xeroInvoiceNumber ? String(raw.xeroInvoiceNumber) : null,
  };
}

function normalizeObligation(raw: Record<string, unknown>): CalendarObligationInput {
  const participant = raw.participant as Record<string, unknown> | undefined;
  return {
    id: String(raw.id),
    deal_id: String(raw.deal_id),
    obligation_type: String(raw.obligation_type ?? 'fixed_fee'),
    status: String(raw.status ?? 'PENDING'),
    amount_owed: Number(raw.amount_owed ?? 0),
    currency: String(raw.currency ?? 'AUD'),
    due_date: raw.due_date ? String(raw.due_date) : null,
    participant: participant
      ? {
          id: participant.id ? String(participant.id) : undefined,
          name: participant.name ? String(participant.name) : undefined,
          role: participant.role ? String(participant.role) : undefined,
        }
      : undefined,
  };
}

export type UseCalendarEventsResult = {
  loading: boolean;
  error: string | null;
  events: CalendarEvent[];
  filteredEvents: CalendarEvent[];
  filters: CalendarFilters;
  setFilters: React.Dispatch<React.SetStateAction<CalendarFilters>>;
  deals: RecentDeal[];
  participants: DemoParticipant[];
  refresh: () => Promise<void>;
};

export function useCalendarEvents(): UseCalendarEventsResult {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deals, setDeals] = React.useState<RecentDeal[]>([]);
  const [participants, setParticipants] = React.useState<DemoParticipant[]>([]);
  const [paymentLinks, setPaymentLinks] = React.useState<CalendarPaymentLinkInput[]>([]);
  const [obligations, setObligations] = React.useState<CalendarObligationInput[]>([]);
  const [fundingSources, setFundingSources] = React.useState<ProjectFundingSourceDto[]>([]);
  const [filters, setFilters] = React.useState<CalendarFilters>(DEFAULT_FILTERS);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [snapshotRes, linksRes, oblRes] = await Promise.all([
        fetch('/api/deal-network-pilot/snapshot', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/payment-links?limit=200&page=1', {
          credentials: 'include',
          cache: 'no-store',
        }),
        fetch('/api/deal-network-pilot/obligations', {
          credentials: 'include',
          cache: 'no-store',
        }),
      ]);

      let loadedDeals: RecentDeal[] = [];
      let loadedParticipants: DemoParticipant[] = [];

      if (snapshotRes.ok) {
        const snapshot = (await snapshotRes.json()) as {
          deals?: RecentDeal[];
          participants?: DemoParticipant[];
        };
        loadedDeals = Array.isArray(snapshot.deals)
          ? snapshot.deals.filter((d) => !d.archived)
          : [];
        loadedParticipants = Array.isArray(snapshot.participants) ? snapshot.participants : [];
        setDeals(loadedDeals);
        setParticipants(loadedParticipants);
      }

      if (linksRes.ok) {
        const json = (await linksRes.json()) as { data?: Record<string, unknown>[] };
        setPaymentLinks(
          Array.isArray(json.data) ? json.data.map(normalizePaymentLink) : []
        );
      } else {
        setPaymentLinks([]);
      }

      if (oblRes.ok) {
        const json = (await oblRes.json()) as { data?: Record<string, unknown>[] };
        setObligations(
          Array.isArray(json.data) ? json.data.map(normalizeObligation) : []
        );
      } else {
        setObligations([]);
      }

      const fsResults = await Promise.all(
        loadedDeals.slice(0, 12).map(async (deal) => {
          const res = await fetch(
            `/api/projects/${encodeURIComponent(deal.id)}/funding-sources`,
            { credentials: 'include', cache: 'no-store' }
          );
          if (!res.ok) return [] as ProjectFundingSourceDto[];
          const json = (await res.json()) as { data?: ProjectFundingSourceDto[] };
          return Array.isArray(json.data) ? json.data : [];
        })
      );
      setFundingSources(fsResults.flat());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const events = React.useMemo(() => {
    const input: CalendarDerivationInput = {
      deals,
      participants: participants.map((p) => ({
        id: p.id,
        name: p.name,
        dealId: p.dealId,
        payoutDueDate: p.payoutDueDate,
        approvedAt: p.approvedAt,
        role: p.role,
      })),
      paymentLinks,
      obligations,
      fundingSources,
      tasks: [],
    };
    return deriveCalendarEvents(input);
  }, [deals, participants, paymentLinks, obligations, fundingSources]);

  const filteredEvents = React.useMemo(
    () => filterCalendarEvents(events, filters),
    [events, filters]
  );

  return {
    loading,
    error,
    events,
    filteredEvents,
    filters,
    setFilters,
    deals,
    participants,
    refresh: load,
  };
}
