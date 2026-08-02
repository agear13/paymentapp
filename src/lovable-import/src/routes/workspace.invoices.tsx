import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Plus,
  Search,
  Download,
  RefreshCw,
  X,
  ArrowRight,
  Check,
  Clock,
  Coins,
  Repeat,
  Bell,
  Eye,
  AlertTriangle,
  FileText,
  MoreHorizontal,
  Copy,
  Share2,
  Pencil,
  Trash2,
  ExternalLink,
  Link2,
  ChevronDown,
} from "lucide-react";
import {
  INVOICES,
  STATUS_CLS,
  XERO_DOT,
  STATUSES,
  METHODS,
  CURRENCIES,
  XEROS,
  type Invoice,
} from "@/lib/invoice-data";

export const Route = createFileRoute("/workspace/invoices")({
  head: () => ({
    meta: [
      { title: "Invoices — Provvy" },
      {
        name: "description",
        content:
          "Manage invoices, payment links and collections in one AI-first workspace inside your Commercial Operating System.",
      },
      { property: "og:title", content: "Invoices — Provvy" },
      {
        property: "og:description",
        content:
          "Understand invoice health instantly, find any invoice and act on Provvy AI recommendations.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvoicesPage,
});

const INSIGHTS = [
  { label: "Needs attention", value: "3", icon: AlertTriangle, tone: "warn" as const },
  { label: "Awaiting payment", value: "A$21,750", icon: Clock },
  { label: "Awaiting Xero sync", value: "3", icon: RefreshCw },
  { label: "Crypto confirming", value: "1", icon: Coins },
  { label: "Viewed but unpaid", value: "2", icon: Eye },
  { label: "Recurring candidates", value: "1", icon: Repeat },
];

const AI_ITEMS = [
  {
    icon: AlertTriangle,
    text: "2 invoices are overdue by more than 3 days, totalling A$10,383.",
    cta: "Send reminders",
    tone: "warn" as const,
  },
  {
    icon: Repeat,
    text: "Northbridge Logistics has been invoiced the same amount for 6 months.",
    cta: "Create recurring invoice",
  },
  {
    icon: RefreshCw,
    text: "3 invoices are waiting for Xero sync, one failed on a missing contact.",
    cta: "Push to Xero",
  },
  {
    icon: Coins,
    text: "USDC 2,400 from Halcyon Studio is confirming on Base (9 of 12).",
    cta: "Review crypto confirmation",
  },
  {
    icon: Bell,
    text: "Arbor & Co usually pays within 24 hours of viewing an invoice.",
    cta: "Prioritise this customer",
  },
];

/* ----------------------------- components ------------------------------- */

function FilterChip({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          selected.length
            ? "border-primary/40 bg-accent/40 text-primary"
            : "border-border text-ink-soft hover:bg-secondary hover:text-foreground"
        }`}
      >
        {label}
        {selected.length > 0 && (
          <span className="rounded-full bg-primary/15 px-1.5 text-[11px]">{selected.length}</span>
        )}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 z-30 mt-2 w-52 rounded-xl border border-border bg-card p-1.5 shadow-card"
        >
          {options.map((o) => {
            const on = selected.includes(o);
            return (
              <button
                key={o}
                role="option"
                aria-selected={on}
                onClick={() => onToggle(o)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={`grid h-4 w-4 place-items-center rounded border ${
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  }`}
                >
                  {on && <Check className="h-3 w-3" />}
                </span>
                {o}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RowMenu({ onOpen }: { onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const items = [
    { label: "Open", icon: ExternalLink, action: onOpen },
    { label: "Edit", icon: Pencil },
    { label: "Duplicate", icon: Copy },
    { label: "Share", icon: Share2 },
    { label: "Copy payment link", icon: Link2 },
    { label: "Delete", icon: Trash2, danger: true },
  ];

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        aria-label="Invoice actions"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-52 rounded-xl border border-border bg-card p-1.5 shadow-card">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                it.action?.();
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                it.danger ? "text-destructive" : ""
              }`}
            >
              <it.icon className="h-3.5 w-3.5 opacity-70" />
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- page ---------------------------------- */

function InvoicesPage() {
  const navigate = useNavigate();
  const open = (inv: Invoice) =>
    navigate({ to: "/workspace/invoice/$id", params: { id: inv.number } });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string[]>([]);
  const [method, setMethod] = useState<string[]>([]);
  const [currency, setCurrency] = useState<string[]>([]);
  const [xero, setXero] = useState<string[]>([]);

  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>) => (v: string) =>
    set((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return INVOICES.filter((i) => {
      if (status.length && !status.includes(i.status)) return false;
      if (method.length && !method.includes(i.method)) return false;
      if (currency.length && !currency.includes(i.currency)) return false;
      if (xero.length && !xero.includes(i.xero)) return false;
      if (!q) return true;
      return [i.number, i.customer, i.description, i.display, i.method, i.currency, i.pay, i.chain?.hash]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q));
    });
  }, [query, status, method, currency, xero]);

  const clearAll = () => {
    setStatus([]);
    setMethod([]);
    setCurrency([]);
    setXero([]);
  };
  const anyFilter = status.length + method.length + currency.length + xero.length > 0;

  return (
    <div className="animate-fade-up space-y-12 pb-24">
      {/* Header */}
      <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">Invoices</h1>
          <p className="mt-3 max-w-xl text-[16px] text-ink-soft">
            Manage invoices, payment links and collections.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-purple px-5 text-[14px] font-semibold text-primary-foreground shadow-glow transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <Plus className="h-4 w-4" />
            Create Invoice
          </button>
          {[
            { label: "Export", icon: Download },
            { label: "Refresh", icon: RefreshCw },
          ].map(({ label, icon: Icon }) => (
            <button
              key={label}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-[13.5px] font-medium text-ink-soft transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Search */}
      <section>
        <label htmlFor="inv-search" className="sr-only">
          Search invoices
        </label>
        <div className="flex h-14 items-center gap-3 rounded-2xl border border-border bg-card px-5 shadow-card transition-colors focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-ring/20">
          <Search className="h-4.5 w-4.5 shrink-0 text-ink-soft" />
          <input
            id="inv-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer, invoice number, payment reference, wallet address or amount…"
            className="h-full w-full bg-transparent text-[14.5px] outline-none placeholder:text-ink-soft/70"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <FilterChip label="Status" options={STATUSES} selected={status} onToggle={toggle(setStatus)} />
          <FilterChip label="Payment method" options={METHODS} selected={method} onToggle={toggle(setMethod)} />
          <FilterChip label="Currency" options={CURRENCIES} selected={currency} onToggle={toggle(setCurrency)} />
          <FilterChip label="Xero status" options={XEROS} selected={xero} onToggle={toggle(setXero)} />
          {["Date", "Customer", "Amount"].map((l) => (
            <button
              key={l}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {l}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          ))}
          {anyFilter && (
            <button
              onClick={clearAll}
              className="h-9 rounded-full px-3 text-[12.5px] font-medium text-primary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      {/* AI summary */}
      <section aria-labelledby="ai-heading" className="rounded-2xl border border-primary/25 bg-accent/20 p-6 shadow-card">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-purple text-primary-foreground">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <h2 id="ai-heading" className="text-[13.5px] font-semibold">
            Provvy AI
          </h2>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
        </div>
        <ul className="mt-5 grid gap-3 lg:grid-cols-2">
          {AI_ITEMS.map((a) => (
            <li
              key={a.cta}
              className={`flex items-start gap-3 rounded-xl border bg-background/70 p-4 ${
                a.tone === "warn" ? "border-amber-500/30" : "border-border"
              }`}
            >
              <span
                className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                  a.tone === "warn"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    : "bg-primary/10 text-primary"
                }`}
              >
                <a.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[13.5px] leading-relaxed">{a.text}</p>
                <button className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {a.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Quick insights */}
      <section aria-label="Quick insights" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {INSIGHTS.map((i) => (
          <div
            key={i.label}
            className={`rounded-2xl border bg-card p-5 shadow-card transition-transform duration-200 hover:-translate-y-0.5 ${
              i.tone === "warn" ? "border-amber-500/30" : "border-border"
            }`}
          >
            <i.icon
              className={`h-4 w-4 ${
                i.tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-ink-soft"
              }`}
            />
            <div className="mt-4 text-[24px] font-semibold leading-none tracking-[-0.03em]">{i.value}</div>
            <div className="mt-2 text-[11.5px] text-ink-soft">{i.label}</div>
          </div>
        ))}
      </section>

      {/* Table */}
      <section aria-labelledby="table-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="table-heading" className="text-[13px] font-semibold uppercase tracking-wider text-ink-soft">
            All invoices
          </h2>
          <span className="text-[12.5px] text-ink-soft">
            {rows.length} of {INVOICES.length}
          </span>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[1080px] border-collapse text-[13px]">
            <thead className="text-ink-soft">
              <tr>
                {[
                  "Status",
                  "Invoice",
                  "Customer",
                  "Description",
                  "Amount",
                  "Method",
                  "Created",
                  "Due",
                  "Payment",
                  "Xero",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-5 py-3.5 text-left text-[11px] font-medium uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => open(inv)}
                  className="cursor-pointer border-t border-border/70 transition-colors hover:bg-secondary/50"
                >
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLS[inv.status]}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 font-medium">{inv.number}</td>
                  <td className="whitespace-nowrap px-5 py-4 font-medium">{inv.customer}</td>
                  <td className="max-w-[220px] truncate px-5 py-4 text-ink-soft">{inv.description}</td>
                  <td className="whitespace-nowrap px-5 py-4 font-medium">{inv.display}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-ink-soft">{inv.method}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-ink-soft">{inv.created}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-ink-soft">{inv.due}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-ink-soft">{inv.pay}</td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft">
                      <span className={`h-1.5 w-1.5 rounded-full ${XERO_DOT[inv.xero]}`} />
                      {inv.xero}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-right">
                    <RowMenu onOpen={() => open(inv)} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-5 py-16 text-center">
                    <FileText className="mx-auto h-6 w-6 text-ink-soft" />
                    <div className="mt-3 text-[14px] font-medium">No invoices match this view</div>
                    <p className="mt-1 text-[13px] text-ink-soft">
                      Try a different search, or clear your filters.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
