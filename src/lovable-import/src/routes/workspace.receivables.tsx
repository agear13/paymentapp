import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Sparkles,
  Plus,
  ArrowRight,
  Download,
  RefreshCw,
  Repeat,
  Bell,
  Coins,
  TrendingDown,
  Check,
  CreditCard,
  FileText,
  Landmark,
  BarChart3,
  PhoneCall,
  Clock,
} from "lucide-react";

export const Route = createFileRoute("/workspace/receivables")({
  head: () => ({
    meta: [
      { title: "Receivables — Provvy" },
      {
        name: "description",
        content:
          "Everything related to getting paid, in one place. Today's receivables position, Provvy AI recommendations and your next best action.",
      },
      { property: "og:title", content: "Receivables — Provvy" },
      {
        property: "og:description",
        content:
          "Your receivables workspace inside the Commercial Operating System — AI recommendations, activity and invoices.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReceivablesPage,
});

const LIVE = [
  "2 invoices require attention",
  "1 payment received overnight",
  "Xero synchronised successfully",
  "1 invoice is likely to become overdue",
];

const KPIS: { label: string; value: string; hint: string; accent?: boolean }[] = [
  { label: "Open invoices", value: "14", hint: "3 due this week" },
  { label: "Outstanding value", value: "A$18,200", hint: "Across 9 customers", accent: true },
  { label: "Collected this month", value: "A$42,650", hint: "+18% on last month" },
  { label: "Awaiting payment", value: "A$11,400", hint: "6 invoices sent" },
  { label: "Awaiting review", value: "2", hint: "Drafts ready to send" },
  { label: "Average payment time", value: "11 days", hint: "2 days faster" },
];

const RECS: {
  icon: typeof Repeat;
  title: string;
  body: string;
  action: string;
  tone?: "warn";
}[] = [
  {
    icon: Repeat,
    title: "This customer receives the same invoice every month",
    body: "Northbridge Logistics has been invoiced A$4,800 on the 1st for six months running.",
    action: "Create recurring invoice",
  },
  {
    icon: Bell,
    title: "Three invoices haven't been viewed",
    body: "Sent 4–6 days ago with no open events. A reminder recovers most of these within 48 hours.",
    action: "Resend reminders",
  },
  {
    icon: Coins,
    title: "This customer prefers USDC",
    body: "Halcyon Studio has settled its last 4 invoices in USDC on Base.",
    action: "Use USDC by default",
  },
  {
    icon: TrendingDown,
    title: "Cashflow may tighten in 9 days",
    body: "Outstanding invoices total A$18,200 while A$9,700 of payables fall due on the 14th.",
    action: "Review collections plan",
    tone: "warn",
  },
];

const ACTIVITY: { title: string; detail: string; time: string; kind: "paid" | "created" | "sync" | "crypto" | "settle" }[] = [
  { title: "Invoice INV-1043 paid", detail: "A$6,200 · Pinch Payments", time: "07:12", kind: "paid" },
  { title: "Payment received", detail: "A$1,150 · Stripe card", time: "06:48", kind: "paid" },
  { title: "Crypto payment confirmed", detail: "USDC 2,400 · Base network", time: "02:31", kind: "crypto" },
  { title: "Settlement completed", detail: "A$7,350 swept to operating account", time: "Yesterday", kind: "settle" },
  { title: "Invoice INV-1044 created", detail: "Northbridge Logistics · A$4,800", time: "Yesterday", kind: "created" },
  { title: "Xero synchronised", detail: "18 records reconciled, 0 exceptions", time: "Yesterday", kind: "sync" },
];

const ACT_ICON = {
  paid: { icon: Check, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  created: { icon: FileText, cls: "bg-secondary text-ink-soft" },
  sync: { icon: RefreshCw, cls: "bg-primary/10 text-primary" },
  crypto: { icon: Coins, cls: "bg-primary/10 text-primary" },
  settle: { icon: Landmark, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
} as const;

type InvStatus = "Paid" | "Sent" | "Overdue" | "Draft";

const STATUS_CLS: Record<InvStatus, string> = {
  Paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Sent: "bg-primary/10 text-primary",
  Overdue: "bg-destructive/10 text-destructive",
  Draft: "bg-secondary text-ink-soft",
};

const INVOICES: {
  status: InvStatus;
  customer: string;
  amount: string;
  due: string;
  method: string;
  xero: "Synced" | "Pending";
}[] = [
  { status: "Overdue", customer: "Kestrel Freight", amount: "A$5,400", due: "3 days ago", method: "Bank transfer", xero: "Synced" },
  { status: "Sent", customer: "Northbridge Logistics", amount: "A$4,800", due: "In 4 days", method: "Pinch direct debit", xero: "Synced" },
  { status: "Sent", customer: "Halcyon Studio", amount: "A$2,400", due: "In 6 days", method: "USDC · Base", xero: "Pending" },
  { status: "Paid", customer: "Arbor & Co", amount: "A$6,200", due: "Paid today", method: "Card · Stripe", xero: "Synced" },
  { status: "Draft", customer: "Sable Interiors", amount: "A$1,150", due: "Not sent", method: "—", xero: "Pending" },
];

const QUICK = [
  { label: "Create Invoice", icon: Plus },
  { label: "Recurring Invoices", icon: Repeat },
  { label: "Collections", icon: PhoneCall },
  { label: "Reports", icon: BarChart3 },
];

const SYSTEMS = [
  { name: "Xero", detail: "Ledger · synced 12m ago" },
  { name: "Stripe", detail: "Cards · live" },
  { name: "Pinch", detail: "Direct debit · live" },
  { name: "MetaMask", detail: "USDC · Base" },
  { name: "Wise", detail: "Multi-currency · live" },
];

function ReceivablesPage() {
  const [liveIndex, setLiveIndex] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setLiveIndex((i) => (i + 1) % LIVE.length), 3400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="animate-fade-up space-y-14 pb-24">
      {/* Header */}
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
            {LIVE.map((l, i) => (
              <li
                key={l}
                className={`text-[13px] transition-opacity duration-500 ${
                  i === liveIndex ? "font-medium text-foreground" : "text-ink-soft opacity-60"
                }`}
              >
                {l}
              </li>
            ))}
          </ul>
        </div>
      </header>

      {/* KPIs */}
      <section aria-label="Today's receivables position">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {KPIS.map((k) => (
            <div
              key={k.label}
              className={`rounded-2xl border bg-card p-6 shadow-card transition-transform duration-200 hover:-translate-y-0.5 ${
                k.accent ? "border-primary/25" : "border-border"
              }`}
            >
              <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">{k.label}</div>
              <div className="mt-3 text-[34px] font-semibold leading-none tracking-[-0.03em]">{k.value}</div>
              <div className="mt-2 text-[12.5px] text-ink-soft">{k.hint}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Primary action area */}
      <section className="flex flex-wrap items-center gap-3">
        <button className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-purple px-6 text-[14.5px] font-semibold text-primary-foreground shadow-glow transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <Plus className="h-4 w-4" />
          Create Invoice
        </button>
        <Link
          to="/workspace/invoices"
          className="inline-flex h-12 items-center gap-2 rounded-xl px-4 text-[13.5px] font-medium text-ink-soft transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowRight className="h-4 w-4" />
          View All Invoices
        </Link>
        {[
          { label: "Export", icon: Download },
          { label: "Refresh", icon: RefreshCw },
        ].map(({ label, icon: Icon }) => (
          <button
            key={label}
            className="inline-flex h-12 items-center gap-2 rounded-xl px-4 text-[13.5px] font-medium text-ink-soft transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </section>

      {/* AI Recommendations */}
      <section aria-labelledby="recs-heading">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 id="recs-heading" className="text-[13px] font-semibold uppercase tracking-wider text-ink-soft">
            Provvy AI recommends
          </h2>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {RECS.map((r) => {
            const Icon = r.icon;
            return (
              <article
                key={r.title}
                className={`rounded-2xl border p-6 shadow-card transition-transform duration-200 hover:-translate-y-0.5 ${
                  r.tone === "warn"
                    ? "border-amber-500/30 bg-amber-500/[0.04]"
                    : "border-primary/25 bg-accent/20"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                      r.tone === "warn"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        : "bg-gradient-purple text-primary-foreground"
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[15.5px] font-semibold leading-snug">{r.title}</h3>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{r.body}</p>
                    <div className="mt-4 flex items-center gap-2">
                      <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-3.5 text-[12.5px] font-semibold text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        {r.action}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                      <button className="h-9 rounded-lg px-3 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Activity + quick actions */}
      <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-soft">Recent activity</h2>
          <ol className="relative mt-4 space-y-1 pl-1">
            <div className="absolute left-[19px] top-3 bottom-3 w-px bg-border" aria-hidden />
            {ACTIVITY.map((a) => {
              const cfg = ACT_ICON[a.kind];
              const Icon = cfg.icon;
              return (
                <li key={a.title} className="relative flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-secondary/60">
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
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Quick actions</h2>
            <div className="mt-3 space-y-1">
              {QUICK.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-medium transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon className="h-4 w-4 text-ink-soft" />
                  {label}
                  <ArrowRight className="ml-auto h-3.5 w-3.5 text-ink-soft" />
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-ink-soft" />
              <h2 className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Next best action</h2>
            </div>
            <p className="mt-2.5 text-[13.5px] text-ink-soft">
              Kestrel Freight is 3 days overdue on A$5,400. A reminder today typically collects within 48 hours.
            </p>
            <button className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[12.5px] font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Send reminder
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Invoice preview */}
      <section aria-labelledby="inv-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="inv-heading" className="text-[13px] font-semibold uppercase tracking-wider text-ink-soft">
            Most relevant invoices
          </h2>
          <span className="text-[12px] text-ink-soft">5 of 14</span>
        </div>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
          <table className="w-full text-left text-[13.5px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-ink-soft">
                {["Status", "Customer", "Amount", "Due date", "Payment method", "Xero", ""].map((h) => (
                  <th key={h} scope="col" className="px-5 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {INVOICES.map((inv) => (
                <tr key={inv.customer} className="border-t border-border/70 transition-colors hover:bg-secondary/50">
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLS[inv.status]}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-medium">{inv.customer}</td>
                  <td className="px-5 py-4">{inv.amount}</td>
                  <td className="px-5 py-4 text-ink-soft">{inv.due}</td>
                  <td className="px-5 py-4 text-ink-soft">{inv.method}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          inv.xero === "Synced" ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                      {inv.xero}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button className="rounded-lg px-2.5 py-1 text-[12.5px] font-medium text-primary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link
          to="/workspace/invoices"
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-[13.5px] font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View All Invoices
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* Connected systems */}
      <section aria-labelledby="sys-heading">
        <h2 id="sys-heading" className="text-[13px] font-semibold uppercase tracking-wider text-ink-soft">
          Connected systems
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {SYSTEMS.map((s) => (
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
            to="/workspace/connected"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
          >
            Manage connections
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      <p className="flex items-center gap-2 text-[12px] text-ink-soft">
        <CreditCard className="h-3.5 w-3.5" />
        Payments executed through Pinch, Stripe and on-chain rails. Ledger of record: Xero.
      </p>
    </div>
  );
}
