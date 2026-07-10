'use client';

import * as React from 'react';
import { useAgreementHealthPortfolio } from '@/hooks/use-agreement-health-portfolio';
import { useBusinessFinancialSnapshot } from '@/hooks/use-business-financial-snapshot';
import {
  deriveWorkspaceTimeline,
} from '@/lib/workspace-timeline/workspace-timeline-service';
import {
  filterTimelineEvents,
  eventsInMonth,
} from '@/lib/workspace-timeline/timeline-filters';
import type {
  TimelineFilters,
  WorkspaceTimelineEvent,
  TimelineMonthSummary,
  CashFlowForecastPoint,
  WorkspaceTimelineInput,
} from '@/lib/workspace-timeline/types';
import { DEFAULT_TIMELINE_FILTERS } from '@/lib/workspace-timeline/types';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { BusinessFinancialSnapshot } from '@/lib/commercial/business-financial-snapshot';
import type { AgreementHealthPortfolioSummary, AgreementHealthSnapshot } from '@/lib/agreements/health/agreement-health.types';

export type UseWorkspaceTimelineResult = {
  loading: boolean;
  error: string | null;
  business: BusinessFinancialSnapshot | null;
  healthSnapshots: AgreementHealthSnapshot[];
  portfolio: AgreementHealthPortfolioSummary | null;
  events: WorkspaceTimelineEvent[];
  filteredEvents: WorkspaceTimelineEvent[];
  monthEvents: WorkspaceTimelineEvent[];
  monthSummary: TimelineMonthSummary;
  cashForecast: CashFlowForecastPoint[];
  filters: TimelineFilters;
  setFilters: React.Dispatch<React.SetStateAction<TimelineFilters>>;
  deals: RecentDeal[];
  participants: DemoParticipant[];
  month: Date;
  setMonth: React.Dispatch<React.SetStateAction<Date>>;
  refresh: () => Promise<void>;
};

export function useWorkspaceTimeline(): UseWorkspaceTimelineResult {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deals, setDeals] = React.useState<RecentDeal[]>([]);
  const [participants, setParticipants] = React.useState<DemoParticipant[]>([]);
  const [paymentLinks, setPaymentLinks] = React.useState<WorkspaceTimelineInput['paymentLinks']>([]);
  const [obligations, setObligations] = React.useState<WorkspaceTimelineInput['obligations']>([]);
  const [fundingSources, setFundingSources] = React.useState<import('@/lib/projects/funding-sources/types').ProjectFundingSourceDto[]>([]);
  const [filters, setFilters] = React.useState<TimelineFilters>(DEFAULT_TIMELINE_FILTERS);
  const [month, setMonth] = React.useState(() => new Date());

  const { snapshots: healthSnapshots, portfolio } = useAgreementHealthPortfolio({ enabled: true });
  const { business, loading: businessLoading } = useBusinessFinancialSnapshot({
    healthSnapshots,
    portfolio,
    enabled: healthSnapshots.length > 0,
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [snapshotRes, linksRes, oblRes] = await Promise.all([
        fetch('/api/deal-network-pilot/snapshot', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/payment-links?limit=200&page=1', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/deal-network-pilot/obligations', { credentials: 'include', cache: 'no-store' }),
      ]);

      let loadedDeals: RecentDeal[] = [];

      if (snapshotRes.ok) {
        const snapshot = (await snapshotRes.json()) as {
          deals?: RecentDeal[];
          participants?: DemoParticipant[];
        };
        loadedDeals = Array.isArray(snapshot.deals)
          ? snapshot.deals.filter((d) => !d.archived)
          : [];
        setDeals(loadedDeals);
        setParticipants(Array.isArray(snapshot.participants) ? snapshot.participants : []);
      }

      if (linksRes.ok) {
        const json = (await linksRes.json()) as { data?: Record<string, unknown>[] };
        setPaymentLinks(
          Array.isArray(json.data)
            ? json.data.map((raw) => ({
                id: String(raw.id),
                shortCode: String(raw.shortCode ?? ''),
                status: String(raw.status ?? 'OPEN'),
                amount: Number(raw.amount ?? 0),
                currency: String(raw.currency ?? 'AUD'),
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
                paidAt: raw.paidAt ? String(raw.paidAt) : null,
                createdAt: String(raw.createdAt ?? new Date().toISOString()),
                pilotDealId: raw.pilotDealId ? String(raw.pilotDealId) : null,
                xeroInvoiceNumber: raw.xeroInvoiceNumber ? String(raw.xeroInvoiceNumber) : null,
                paymentMethod: raw.paymentMethod ? String(raw.paymentMethod) : null,
              }))
            : []
        );
      }

      if (oblRes.ok) {
        const json = (await oblRes.json()) as { data?: Record<string, unknown>[] };
        setObligations(
          Array.isArray(json.data)
            ? json.data.map((raw) => {
                const p = raw.participant as Record<string, unknown> | undefined;
                return {
                  id: String(raw.id),
                  deal_id: String(raw.deal_id),
                  obligation_type: String(raw.obligation_type ?? 'fixed_fee'),
                  status: String(raw.status ?? 'PENDING'),
                  amount_owed: Number(raw.amount_owed ?? 0),
                  currency: String(raw.currency ?? 'AUD'),
                  due_date: raw.due_date ? String(raw.due_date) : null,
                  participant: p
                    ? {
                        id: p.id ? String(p.id) : undefined,
                        name: p.name ? String(p.name) : undefined,
                        role: p.role ? String(p.role) : undefined,
                      }
                    : undefined,
                };
              })
            : []
        );
      }

      const fsResults = await Promise.all(
        loadedDeals.slice(0, 12).map(async (deal) => {
          const res = await fetch(
            `/api/projects/${encodeURIComponent(deal.id)}/funding-sources`,
            { credentials: 'include', cache: 'no-store' }
          );
          if (!res.ok) return [];
          const json = (await res.json()) as { data?: typeof fundingSources };
          return Array.isArray(json.data) ? json.data : [];
        })
      );
      setFundingSources(fsResults.flat());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const timeline = React.useMemo(() => {
    return deriveWorkspaceTimeline(
      {
        deals,
        participants: participants.map((p) => ({
          id: p.id,
          name: p.name,
          dealId: p.dealId,
          payoutDueDate: p.payoutDueDate,
          approvedAt: p.approvedAt,
          approvalStatus: p.approvalStatus,
          role: p.role,
        })),
        paymentLinks,
        obligations,
        fundingSources,
        business: business ?? null,
      },
      month
    );
  }, [deals, participants, paymentLinks, obligations, fundingSources, business, month]);

  const filteredEvents = React.useMemo(
    () => filterTimelineEvents(timeline.events, filters),
    [timeline.events, filters]
  );

  const monthEvents = React.useMemo(
    () => eventsInMonth(filteredEvents, month),
    [filteredEvents, month]
  );

  return {
    loading: loading || businessLoading,
    error,
    business: business ?? null,
    healthSnapshots,
    portfolio,
    events: timeline.events,
    filteredEvents,
    monthEvents,
    monthSummary: timeline.monthSummary,
    cashForecast: timeline.cashForecast,
    filters,
    setFilters,
    deals,
    participants,
    month,
    setMonth,
    refresh: load,
  };
}
