'use client';

import '@/components/journey/lovable/lovable-journey.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, formatDistanceToNow, startOfMonth } from 'date-fns';
import {
  Sparkles,
  Plus,
  ArrowRight,
  Download,
  RefreshCw,
  Repeat,
  PhoneCall,
  Check,
  CreditCard,
  FileText,
  Landmark,
  BarChart3,
  Clock,
  Coins,
} from 'lucide-react';
import type { PaymentLink } from '@/components/payment-links/payment-links-table';
import { useOrganization } from '@/hooks/use-organization';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters/format-currency';
import { exportToCSV, type ExportColumn } from '@/lib/export-csv';
import {
  COMMERCIAL_OS_ROUTES,
} from '@/lib/journey/commercial-os-routes';
import { CommercialOsCreateInvoiceLink } from '@/components/journey/lovable/commercial-os-create-invoice-gate';
import {
  formatInvoiceDueLabel,
  invoicePaymentMethodLabel,
  invoicePublicReference,
  INVOICE_DISPLAY_STATUS_CLS,
  toInvoiceDisplayStatus,
} from '@/lib/payment-links/invoice-display-status';
import { fetchAllPaymentLinks } from '@/lib/payment-links/fetch-payment-links-list.client';
import {
  receivablesInvoiceXeroColumn,
  type XeroSyncRecordLike,
} from '@/lib/xero/xero-sync-display';


const STATUS_CLS = INVOICE_DISPLAY_STATUS_CLS;

const ACT_ICON = {
  paid: { icon: Check, cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  created: { icon: FileText, cls: 'bg-secondary text-ink-soft' },
  sync: { icon: RefreshCw, cls: 'bg-primary/10 text-primary' },
  crypto: { icon: Coins, cls: 'bg-primary/10 text-primary' },
  settle: { icon: Landmark, cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
} as const;

type ActivityKind = keyof typeof ACT_ICON;

type ConnectedSystemCard = {
  name: string;
  detail: string;
};

const QUICK: Array<
  | { label: string; icon: typeof Plus; href: string; comingSoon?: false }
  | { label: string; icon: typeof Plus; comingSoon: true; description: string }
> = [
  {
    label: 'Create Invoice',
    icon: Plus,
    href: COMMERCIAL_OS_ROUTES.createInvoice,
  },
  { label: 'Recurring Invoices', icon: Repeat, href: '/dashboard/recurring-templates' },
  { label: 'Collections', icon: PhoneCall, href: COMMERCIAL_OS_ROUTES.timeline },
  {
    label: 'Reports',
    icon: BarChart3,
    comingSoon: true,
    description: 'Revenue and reconciliation reports are on the way.',
  },
];

function sortedRelevantInvoiceIds(links: PaymentLink[]): string[] {
    const priority = (link: PaymentLink) => {
      const status = toInvoiceDisplayStatus(link);
    if (status === 'Overdue') return 0;
    if (status === 'Sent') return 1;
    if (status === 'Draft') return 2;
    return 3;
  };
  return [...links]
    .sort((a, b) => priority(a) - priority(b))
    .slice(0, 5)
    .map((link) => link.id);
}

export function WorkspaceReceivablesScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const { organizationId, isLoading: isOrgLoading } = useOrganization();
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [liveIndex, setLiveIndex] = useState(0);
  const [xeroSyncById, setXeroSyncById] = useState<Record<string, XeroSyncRecordLike[] | null>>({});
  const [connectedSystems, setConnectedSystems] = useState<ConnectedSystemCard[] | null>(null);

  const fetchPaymentLinks = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      if (!organizationId) {
        if (!silent) setIsLoading(false);
        return;
      }
      if (!silent) setIsLoading(true);
      try {
        const data = await fetchAllPaymentLinks<PaymentLink>({ organizationId });
        setPaymentLinks(data);
      } catch (error: unknown) {
        if (!silent) {
          const message = error instanceof Error ? error.message : 'Failed to load invoices';
          toast({
            title: 'Error',
            description: message,
            variant: 'destructive',
          });
        }
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [organizationId, toast]
  );

  useEffect(() => {
    if (isOrgLoading) return;
    if (!organizationId) {
      setIsLoading(false);
      setPaymentLinks([]);
      return;
    }
    void fetchPaymentLinks();
  }, [fetchPaymentLinks, isOrgLoading, organizationId]);

  const relevantInvoiceIds = useMemo(
    () => sortedRelevantInvoiceIds(paymentLinks),
    [paymentLinks]
  );

  useEffect(() => {
    if (!organizationId || relevantInvoiceIds.length === 0) {
      setXeroSyncById({});
      return;
    }

    let cancelled = false;
    void Promise.all(
      relevantInvoiceIds.map(async (id) => {
        try {
          const response = await fetch(`/api/payment-links/${id}`);
          if (!response.ok) return [id, null] as const;
          const result = await response.json();
          const syncs = (result.data?.xeroSyncs ?? []) as XeroSyncRecordLike[];
          return [id, syncs] as const;
        } catch {
          return [id, null] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setXeroSyncById(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [organizationId, relevantInvoiceIds]);

  useEffect(() => {
    if (!organizationId) {
      setConnectedSystems(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const cards: ConnectedSystemCard[] = [];
      const [xeroRes, merchantRes] = await Promise.all([
        fetch(`/api/xero/status?organization_id=${encodeURIComponent(organizationId)}`, {
          cache: 'no-store',
        }),
        fetch(`/api/merchant-settings?organizationId=${encodeURIComponent(organizationId)}`, {
          cache: 'no-store',
        }),
      ]);

      if (!cancelled && xeroRes.ok) {
        const xeroStatus = (await xeroRes.json()) as { connected?: boolean };
        if (xeroStatus.connected) {
          cards.push({ name: 'Xero', detail: 'Accounting · connected' });
        }
      }

      if (!cancelled && merchantRes.ok) {
        const settingsData = (await merchantRes.json()) as Array<{
          stripe_account_id?: string | null;
          wise_enabled?: boolean | null;
          wise_profile_id?: string | null;
          evm_wallet_enabled?: boolean | null;
          evm_wallet_address?: string | null;
          evm_supported_networks?: string[] | null;
          hedera_account_id?: string | null;
        }>;
        const settings = settingsData?.[0];
        if (settings?.stripe_account_id?.trim()) {
          cards.push({ name: 'Stripe', detail: 'Cards · configured' });
        }
        if (settings?.wise_enabled && settings.wise_profile_id?.trim()) {
          cards.push({
            name: 'Wise profile',
            detail: 'Saved · use Bank transfer (manual verification) for invoices',
          });
        }
        if (settings?.evm_wallet_enabled && settings.evm_wallet_address?.trim()) {
          const networks = settings.evm_supported_networks?.join(', ') || 'EVM';
          cards.push({ name: 'MetaMask', detail: `${networks} · configured` });
        }
        if (settings?.hedera_account_id?.trim()) {
          cards.push({ name: 'Hedera', detail: 'Native crypto · configured' });
        }
      }

      if (!cancelled) {
        setConnectedSystems(cards);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  useEffect(() => {
    const id = window.setInterval(() => setLiveIndex((i) => i + 1), 3400);
    return () => window.clearInterval(id);
  }, []);

  const monthStart = useMemo(() => startOfMonth(new Date()), []);

  const kpis = useMemo(() => {
    const openStatuses = new Set(['DRAFT', 'OPEN', 'PAID_UNVERIFIED', 'REQUIRES_REVIEW']);
    const openLinks = paymentLinks.filter((l) => openStatuses.has(l.status));
    const outstandingLinks = paymentLinks.filter((l) =>
      ['OPEN', 'PAID_UNVERIFIED', 'REQUIRES_REVIEW'].includes(l.status)
    );
    const sentLinks = paymentLinks.filter((l) => l.status === 'OPEN');
    const draftLinks = paymentLinks.filter((l) => l.status === 'DRAFT');
    const paidThisMonth = paymentLinks.filter((l) => {
      if (l.status !== 'PAID' || !l.paidAt) return false;
      const paid = new Date(l.paidAt);
      return !Number.isNaN(paid.getTime()) && paid >= monthStart;
    });

    const sumAmount = (links: PaymentLink[]) =>
      links.reduce((acc, l) => acc + Number(l.amount), 0);

    const outstandingTotal = sumAmount(outstandingLinks);
    const collectedTotal = sumAmount(paidThisMonth);
    const awaitingTotal = sumAmount(sentLinks);
    const outstandingCurrency = outstandingLinks[0]?.currency ?? paymentLinks[0]?.currency ?? 'AUD';

    const paidDurations = paymentLinks
      .filter((l) => l.status === 'PAID' && l.paidAt)
      .map((l) => {
        const created = new Date(l.createdAt).getTime();
        const paid = new Date(l.paidAt!).getTime();
        if (Number.isNaN(created) || Number.isNaN(paid)) return null;
        return Math.max(0, Math.round((paid - created) / (1000 * 60 * 60 * 24)));
      })
      .filter((d): d is number => d != null);

    const avgDays =
      paidDurations.length > 0
        ? Math.round(paidDurations.reduce((a, b) => a + b, 0) / paidDurations.length)
        : null;

    const dueThisWeek = openLinks.filter((l) => {
      if (!l.dueDate) return false;
      const due = new Date(l.dueDate);
      if (Number.isNaN(due.getTime())) return false;
      const days = (due.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 7;
    }).length;

    const customerCount = new Set(
      outstandingLinks.map((l) => l.customerEmail || l.customerName || l.id)
    ).size;

    return [
      {
        label: 'Open invoices',
        value: String(openLinks.length),
        hint: dueThisWeek > 0 ? `${dueThisWeek} due this week` : 'None due this week',
      },
      {
        label: 'Outstanding value',
        value: formatCurrency(outstandingTotal, outstandingCurrency),
        hint: customerCount > 0 ? `Across ${customerCount} customers` : 'No outstanding invoices',
        accent: true,
      },
      {
        label: 'Collected this month',
        value: formatCurrency(collectedTotal, outstandingCurrency),
        hint: `${paidThisMonth.length} paid this month`,
      },
      {
        label: 'Awaiting payment',
        value: formatCurrency(awaitingTotal, outstandingCurrency),
        hint: `${sentLinks.length} invoices sent`,
      },
      {
        label: 'Awaiting review',
        value: String(draftLinks.length),
        hint: draftLinks.length === 1 ? 'Draft ready to send' : 'Drafts ready to send',
      },
      {
        label: 'Average payment time',
        value: avgDays != null ? `${avgDays} days` : '—',
        hint: paidDurations.length > 0 ? `From ${paidDurations.length} paid invoices` : 'No paid invoices yet',
      },
    ];
  }, [paymentLinks, monthStart]);

  const liveLines = useMemo(() => {
    const overdue = paymentLinks.filter((l) => toInvoiceDisplayStatus(l) === 'Overdue').length;
    const drafts = paymentLinks.filter((l) => l.status === 'DRAFT').length;
    const paidRecent = paymentLinks.filter((l) => {
      if (l.status !== 'PAID' || !l.paidAt) return false;
      const paid = new Date(l.paidAt);
      const hours = (Date.now() - paid.getTime()) / (1000 * 60 * 60);
      return hours <= 24;
    }).length;
    const synced = paymentLinks.filter((link) => {
      const syncs = xeroSyncById[link.id];
      if (!syncs) return false;
      const column = receivablesInvoiceXeroColumn(syncs);
      return column?.label === 'Synced';
    }).length;

    const lines = [
      overdue > 0
        ? `${overdue} invoice${overdue === 1 ? '' : 's'} overdue`
        : 'No overdue invoices',
      paidRecent > 0
        ? `${paidRecent} payment${paidRecent === 1 ? '' : 's'} received recently`
        : 'Monitoring incoming payments',
      synced > 0
        ? `${synced} invoice${synced === 1 ? '' : 's'} synced with Xero`
        : 'Xero sync ready when invoices are issued',
      drafts > 0
        ? `${drafts} draft${drafts === 1 ? '' : 's'} awaiting review`
        : 'All drafts have been sent',
    ];
    return lines;
  }, [paymentLinks, xeroSyncById]);

  const tableRows = useMemo(() => {
    return [...paymentLinks]
      .sort((a, b) => {
    const priority = (link: PaymentLink) => {
      const status = toInvoiceDisplayStatus(link);
          if (status === 'Overdue') return 0;
          if (status === 'Sent') return 1;
          if (status === 'Draft') return 2;
          return 3;
        };
        return priority(a) - priority(b);
      })
      .slice(0, 5)
      .map((link) => ({
        id: link.id,
        status: toInvoiceDisplayStatus(link),
        customer: link.customerName || link.customerEmail || '—',
        amount: formatCurrency(Number(link.amount), link.currency),
        due: formatInvoiceDueLabel(link),
        method: invoicePaymentMethodLabel(link),
        invoiceRef: invoicePublicReference(link),
      }));
  }, [paymentLinks]);

  const activity = useMemo(() => {
    const items: {
      title: string;
      detail: string;
      time: string;
      kind: ActivityKind;
    }[] = [];

    for (const link of paymentLinks) {
      const ref = invoicePublicReference(link);
      const amount = formatCurrency(Number(link.amount), link.currency);
      const customer = link.customerName || link.customerEmail || 'Customer';

      if (link.status === 'PAID' && link.paidAt) {
        const paid = new Date(link.paidAt);
        items.push({
          title: `Invoice ${ref} paid`,
          detail: `${amount} · ${invoicePaymentMethodLabel(link)}`,
          time: formatDistanceToNow(paid, { addSuffix: true }),
          kind: link.paymentMethod === 'HEDERA' || link.paymentMethod === 'EVM_WALLET' ? 'crypto' : 'paid',
        });
      }

      const events = link.paymentEvents ?? [];
      for (const event of events.slice(0, 3)) {
        if (event.eventType === 'CREATED') {
          items.push({
            title: `Invoice ${ref} created`,
            detail: `${customer} · ${amount}`,
            time: formatDistanceToNow(new Date(event.createdAt), { addSuffix: true }),
            kind: 'created',
          });
        }
        if (event.eventType === 'PAYMENT_CONFIRMED' && link.status !== 'PAID') {
          items.push({
            title: 'Payment received',
            detail: `${amount} · ${invoicePaymentMethodLabel(link)}`,
            time: formatDistanceToNow(new Date(event.createdAt), { addSuffix: true }),
            kind: 'paid',
          });
        }
      }
    }

    return items
      .sort((a, b) => {
        /* keep approximate recency via string — good enough for Phase 1 */
        return a.time.localeCompare(b.time);
      })
      .slice(0, 6);
  }, [paymentLinks]);

  const handleExport = () => {
    if (paymentLinks.length === 0) {
      toast({
        title: 'No data to export',
        description: 'No invoices available for export',
        variant: 'destructive',
      });
      return;
    }

    const columns: ExportColumn<PaymentLink>[] = [
      { key: 'shortCode', header: 'Short Code' },
      { key: 'status', header: 'Status' },
      {
        key: 'amount',
        header: 'Amount',
        format: (value, row) => formatCurrency(Number(value), row.currency),
      },
      { key: 'currency', header: 'Currency' },
      { key: 'description', header: 'Description' },
      { key: 'invoiceReference', header: 'Invoice Reference' },
      { key: 'customerEmail', header: 'Customer Email' },
      { key: 'customerName', header: 'Customer Name' },
      {
        key: 'createdAt',
        header: 'Created At',
        format: (value) => format(new Date(value), 'yyyy-MM-dd HH:mm:ss'),
      },
    ];

    exportToCSV(paymentLinks, columns, `invoices-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`);
    toast({
      title: 'Export complete',
      description: `Exported ${paymentLinks.length} invoice(s)`,
    });
  };

  return (
    <div className="animate-fade-up space-y-14 pb-24">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">Receivables</h1>
          <p className="mt-3 max-w-xl text-[16px] text-ink-soft">
            Everything related to getting paid, in one place.
          </p>
        </div>

        <div className="w-full max-w-sm rounded-2xl border border-primary/25 bg-accent/25 p-4 shadow-card">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-purple text-primary-foreground">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="text-[13px] font-semibold">Provvy AI</span>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live
            </span>
          </div>
          <ul className="mt-3 space-y-1.5" aria-live="polite">
            {liveLines.map((l, i) => (
              <li
                key={l}
                className={`text-[13px] transition-opacity duration-500 ${
                  i === liveIndex % liveLines.length ? 'font-medium text-foreground' : 'text-ink-soft opacity-60'
                }`}
              >
                {l}
              </li>
            ))}
          </ul>
        </div>
      </header>

      <section aria-label="Today's receivables position">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((k) => (
            <div
              key={k.label}
              className={`rounded-2xl border bg-card p-6 shadow-card transition-transform duration-200 hover:-translate-y-0.5 ${
                k.accent ? 'border-primary/25' : 'border-border'
              }`}
            >
              <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">{k.label}</div>
              <div className="mt-3 text-[34px] font-semibold leading-none tracking-[-0.03em]">
                {isLoading ? '…' : k.value}
              </div>
              <div className="mt-2 text-[12.5px] text-ink-soft">{k.hint}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <CommercialOsCreateInvoiceLink
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-purple px-6 text-[14.5px] font-semibold text-primary-foreground shadow-glow transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          Create Invoice
        </CommercialOsCreateInvoiceLink>
        <Link
          href={COMMERCIAL_OS_ROUTES.invoiceList}
          className="inline-flex h-12 items-center gap-2 rounded-xl px-4 text-[13.5px] font-medium text-ink-soft transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowRight className="h-4 w-4" />
          View All Invoices
        </Link>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex h-12 items-center gap-2 rounded-xl px-4 text-[13.5px] font-medium text-ink-soft transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
        <button
          type="button"
          onClick={() => void fetchPaymentLinks()}
          className="inline-flex h-12 items-center gap-2 rounded-xl px-4 text-[13.5px] font-medium text-ink-soft transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-soft">Recent activity</h2>
          {activity.length === 0 ? (
            <p className="mt-4 text-[13px] text-ink-soft">
              {isLoading ? 'Loading activity…' : 'No invoice activity yet.'}
            </p>
          ) : (
            <ol className="relative mt-4 space-y-1 pl-1">
              <div className="absolute left-[19px] top-3 bottom-3 w-px bg-border" aria-hidden />
              {activity.map((a) => {
                const cfg = ACT_ICON[a.kind];
                const Icon = cfg.icon;
                return (
                  <li
                    key={`${a.title}-${a.time}`}
                    className="relative flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-secondary/60"
                  >
                    <div className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${cfg.cls}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-medium">{a.title}</div>
                      <div className="text-[12px] text-ink-soft">{a.detail}</div>
                    </div>
                    <div className="whitespace-nowrap text-[11.5px] text-ink-soft">{a.time}</div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Quick actions</h2>
            <div className="mt-3 space-y-1">
              {QUICK.map((item) => {
                const Icon = item.icon;
                if (item.comingSoon) {
                  return (
                    <div
                      key={item.label}
                      className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px]"
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 font-medium">
                          {item.label}
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-soft">
                            Coming soon
                          </span>
                        </div>
                        <p className="mt-0.5 text-[12px] text-ink-soft">{item.description}</p>
                      </div>
                    </div>
                  );
                }
                if (item.label === 'Create Invoice') {
                  return (
                    <CommercialOsCreateInvoiceLink
                      key={item.label}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-medium transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Icon className="h-4 w-4 text-ink-soft" />
                      {item.label}
                      <ArrowRight className="ml-auto h-3.5 w-3.5 text-ink-soft" />
                    </CommercialOsCreateInvoiceLink>
                  );
                }
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-medium transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon className="h-4 w-4 text-ink-soft" />
                    {item.label}
                    <ArrowRight className="ml-auto h-3.5 w-3.5 text-ink-soft" />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-ink-soft" />
              <h2 className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Next best action</h2>
            </div>
            <p className="mt-2.5 text-[13.5px] text-ink-soft">
              {tableRows.find((r) => r.status === 'Overdue')
                ? `Follow up on overdue invoices from the table below — reminders typically collect within 48 hours.`
                : 'Create or send your next invoice to start collecting payments.'}
            </p>
            <Link
              href={COMMERCIAL_OS_ROUTES.invoiceList}
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[12.5px] font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Manage invoices
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="inv-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="inv-heading" className="text-[13px] font-semibold uppercase tracking-wider text-ink-soft">
            Most relevant invoices
          </h2>
          <span className="text-[12px] text-ink-soft">
            {tableRows.length} of {paymentLinks.length}
          </span>
        </div>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
          <table className="w-full text-left text-[13.5px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-ink-soft">
                {['Status', 'Customer', 'Amount', 'Due date', 'Payment method', 'Xero', ''].map((h) => (
                  <th key={h} scope="col" className="px-5 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-ink-soft">
                    Loading invoices…
                  </td>
                </tr>
              ) : tableRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-ink-soft">
                    No invoices yet. Create your first invoice to get started.
                  </td>
                </tr>
              ) : (
                tableRows.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-t border-border/70 transition-colors hover:bg-secondary/50"
                  >
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLS[inv.status]}`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-medium">{inv.customer}</td>
                    <td className="px-5 py-4">{inv.amount}</td>
                    <td className="px-5 py-4 text-ink-soft">{inv.due}</td>
                    <td className="px-5 py-4 text-ink-soft">{inv.method}</td>
                    <td className="px-5 py-4">
                      {(() => {
                        const syncs = xeroSyncById[inv.id];
                        if (syncs === undefined) {
                          return <span className="text-[12px] text-ink-soft">…</span>;
                        }
                        const xeroDisplay = receivablesInvoiceXeroColumn(syncs ?? undefined);
                        if (!xeroDisplay) {
                          return <span className="text-[12px] text-ink-soft">—</span>;
                        }
                        return (
                          <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft">
                            <span className={`h-1.5 w-1.5 rounded-full ${xeroDisplay.dotClass}`} />
                            {xeroDisplay.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            COMMERCIAL_OS_ROUTES.invoiceDetail(inv.invoiceRef, { id: inv.id })
                          )
                        }
                        className="rounded-lg px-2.5 py-1 text-[12.5px] font-medium text-primary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Link
          href={COMMERCIAL_OS_ROUTES.invoiceList}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-[13.5px] font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View All Invoices
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {connectedSystems && connectedSystems.length > 0 ? (
        <section aria-labelledby="sys-heading">
          <h2 id="sys-heading" className="text-[13px] font-semibold uppercase tracking-wider text-ink-soft">
            Connected systems
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {connectedSystems.map((s) => (
              <div key={s.name} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-[12.5px] font-semibold">
                    {s.name.slice(0, 2)}
                  </div>
                  <span className="h-2 w-2 rounded-full bg-emerald-500" aria-label="Connected" />
                </div>
                <div className="mt-4 text-[14px] font-semibold">{s.name}</div>
                <div className="text-[11.5px] text-ink-soft">{s.detail}</div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Link
              href={COMMERCIAL_OS_ROUTES.connected}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
            >
              Manage connections
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      ) : null}

      <p className="flex items-center gap-2 text-[12px] text-ink-soft">
        <CreditCard className="h-3.5 w-3.5" />
        Payments executed through Pinch, Stripe and on-chain rails. Ledger of record: Xero.
      </p>
    </div>
  );
}
