import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Bell,
  Copy,
  Download,
  Link2,
  Pencil,
  Trash2,
  Share2,
  RefreshCw,
  Repeat,
  Archive,
  QrCode,
  Landmark,
  Coins,
  ExternalLink,
  FileText,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { findInvoice, heroState, STATUS_CLS, XERO_DOT, type Invoice } from "@/lib/invoice-data";

export const Route = createFileRoute("/workspace/invoice/$id")({
  head: () => ({
    meta: [
      { title: "Invoice detail — Provvy" },
      {
        name: "description",
        content:
          "Everything about one invoice in a single workspace: payment status, timeline, crypto settlement, Xero sync and Provvy AI recommendations.",
      },
      { property: "og:title", content: "Invoice detail — Provvy" },
      {
        property: "og:description",
        content: "Understand invoice health in seconds and act on Provvy AI recommendations.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvoiceDetailPage,
});

/* ------------------------------ primitives ------------------------------ */

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">{label}</div>
      <div className="mt-1 text-[13.5px] font-medium">{value}</div>
    </div>
  );
}

function ActionButton({
  label,
  icon: Icon,
  danger,
  primary,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  danger?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        primary
          ? "bg-gradient-purple font-semibold text-primary-foreground shadow-glow hover:brightness-110"
          : danger
            ? "border border-destructive/30 text-destructive hover:bg-destructive/10"
            : "border border-border hover:bg-secondary"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function ExpandableCard({
  title,
  summary,
  defaultOpen,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-6 py-5 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="text-[13.5px] font-semibold">{title}</span>
        {summary && <span className="truncate text-[12.5px] text-ink-soft">{summary}</span>}
        <ChevronDown
          className={`ml-auto h-4 w-4 shrink-0 text-ink-soft transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="border-t border-border px-6 py-6">{children}</div>}
    </section>
  );
}

const TONE_RING: Record<string, string> = {
  good: "border-emerald-500/30 bg-emerald-500/[0.06]",
  warn: "border-amber-500/30 bg-amber-500/[0.06]",
  bad: "border-destructive/30 bg-destructive/[0.06]",
  info: "border-primary/25 bg-accent/20",
};

/* --------------------------------- page --------------------------------- */

function InvoiceDetailPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const invoice = findInvoice(id);

  if (!invoice) {
    return (
      <div className="animate-fade-up rounded-2xl border border-border bg-card p-16 text-center shadow-card">
        <FileText className="mx-auto h-6 w-6 text-ink-soft" />
        <h1 className="mt-4 text-[18px] font-semibold">Invoice not found</h1>
        <p className="mt-2 text-[13.5px] text-ink-soft">This invoice may have been deleted or archived.</p>
        <Link
          to="/workspace/invoices"
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-[13.5px] font-medium transition-colors hover:bg-secondary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to invoices
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-10 pb-24">
      <Breadcrumbs invoice={invoice} onBack={() => router.history.back()} />
      <Header invoice={invoice} />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* LEFT — primary content */}
        <div className="space-y-6">
          <HeroStatus invoice={invoice} />
          <TimelineCard invoice={invoice} />
          <PaymentCard invoice={invoice} />
          {invoice.chain && <CryptoCard invoice={invoice} />}
          <AccountingCard invoice={invoice} />
          {invoice.attachments && invoice.attachments.length > 0 && <AttachmentsCard invoice={invoice} />}
          <AuditCard invoice={invoice} />
          <BottomActions />
        </div>

        {/* RIGHT — AI, status, actions */}
        <aside className="space-y-6 xl:sticky xl:top-8 xl:self-start">
          <AISidebar invoice={invoice} />
          <StatusSummary invoice={invoice} />
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------- sections ------------------------------- */

function Breadcrumbs({ invoice, onBack }: { invoice: Invoice; onBack: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={onBack}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">
        <Link to="/workspace/receivables" className="transition-colors hover:text-foreground">
          Receivables
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to="/workspace/invoices" className="transition-colors hover:text-foreground">
          Invoices
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">Invoice {invoice.number}</span>
      </nav>
    </div>
  );
}

function Header({ invoice }: { invoice: Invoice }) {
  return (
    <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLS[invoice.status]}`}>
            {invoice.status}
          </span>
          <span className="text-[12.5px] text-ink-soft">{invoice.number}</span>
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">{invoice.customer}</h1>
        <p className="mt-3 max-w-xl text-[15.5px] text-ink-soft">{invoice.description}</p>
        <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
          <Field label="Amount" value={invoice.display} />
          <Field label="Outstanding" value={invoice.outstanding ?? invoice.display} />
          <Field label="Payment method" value={invoice.method} />
          <Field label="Created" value={invoice.created} />
          <Field label="Due" value={invoice.due} />
        </dl>
      </div>
      <div className="flex flex-wrap gap-2">
        <ActionButton label="Edit" icon={Pencil} />
        <ActionButton label="Duplicate" icon={Copy} />
        <ActionButton label="Download PDF" icon={Download} />
        <ActionButton label="Copy payment link" icon={Link2} />
        <ActionButton label="Delete" icon={Trash2} danger />
      </div>
    </header>
  );
}

function HeroStatus({ invoice }: { invoice: Invoice }) {
  const { headline, tone } = heroState(invoice);
  return (
    <section className={`rounded-2xl border p-8 shadow-card ${TONE_RING[tone]}`}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Current status</div>
          <div className="mt-2 text-[32px] font-semibold leading-none tracking-[-0.03em]">{headline}</div>
          <p className="mt-3 text-[13.5px] text-ink-soft">
            {invoice.display} · {invoice.customer} · {invoice.due}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-3">
          <Field label="Payment status" value={invoice.pay} />
          <Field label="Preferred method" value={invoice.method} />
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Xero</div>
            <div className="mt-1 flex items-center gap-1.5 text-[13.5px] font-medium">
              <span className={`h-1.5 w-1.5 rounded-full ${XERO_DOT[invoice.xero]}`} />
              {invoice.xero}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TimelineCard({ invoice }: { invoice: Invoice }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <h2 className="text-[13.5px] font-semibold">Invoice timeline</h2>
      <ol className="relative mt-5 space-y-1 pl-1">
        <div className="absolute left-[15px] top-3 bottom-3 w-px bg-border" aria-hidden />
        {invoice.events.map((e) => (
          <li key={e.label + e.time} className="relative flex items-start gap-3 py-2">
            <span className="relative z-10 mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-ink-soft">
              <Check className="h-3 w-3" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium">{e.label}</div>
              <div className="text-[12px] text-ink-soft">{e.detail}</div>
            </div>
            <div className="whitespace-nowrap text-[11.5px] text-ink-soft">{e.time}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PaymentCard({ invoice }: { invoice: Invoice }) {
  return (
    <ExpandableCard title="Payment information" summary={`${invoice.method} · ${invoice.pay}`} defaultOpen>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-primary/25 bg-accent/20 p-5 sm:flex-row sm:items-center">
          <div className="grid h-24 w-24 shrink-0 place-items-center rounded-xl border border-border bg-background">
            <QrCode className="h-12 w-12 text-foreground" aria-label="Payment QR code" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] text-ink-soft">
              pay.provvy.com/{invoice.number.toLowerCase()}
            </div>
            <div className="mt-3 flex gap-2">
              <ActionButton label="Copy link" icon={Link2} primary />
              <ActionButton label="Share" icon={Share2} />
            </div>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Payment method" value={invoice.method} />
          <Field label="Payment status" value={invoice.pay} />
          <Field label="Settlement" value={invoice.settlement ?? "No settlement recorded yet"} />
        </div>

        {invoice.refs && (
          <dl className="rounded-2xl border border-border bg-background p-5">
            {invoice.refs.map((r) => (
              <div key={r.label} className="flex justify-between gap-4 py-1 text-[13px]">
                <dt className="text-ink-soft">{r.label}</dt>
                <dd className="font-medium">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {invoice.attempts && (
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Payment attempts</div>
            <ul className="mt-3 space-y-2">
              {invoice.attempts.map((a) => (
                <li
                  key={a.label + a.detail}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3 text-[13px]"
                >
                  <span className="font-medium">{a.label}</span>
                  <span className="truncate text-ink-soft">{a.detail}</span>
                  <span className="whitespace-nowrap text-[12px] text-ink-soft">{a.state}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Payment events</div>
          <ul className="mt-3 space-y-2 text-[12.5px] text-ink-soft">
            {invoice.events.map((e) => (
              <li key={"pay-" + e.time} className="flex justify-between gap-4">
                <span>{e.label}</span>
                <span>{e.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ExpandableCard>
  );
}

function CryptoCard({ invoice }: { invoice: Invoice }) {
  const chain = invoice.chain!;
  return (
    <ExpandableCard title="Crypto settlement" summary={`${chain.network} · ${chain.confirmations}`}>
      <div className="space-y-6">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Network" value={chain.network} />
          <Field label="Token" value={chain.token ?? invoice.currency} />
          <Field label="Wallet used" value={chain.wallet ?? "Not yet received"} />
          <Field label="Transaction" value={chain.hash} />
          <Field label="State" value={chain.confirmations} />
          {chain.gas && <Field label="Gas fee" value={chain.gas} />}
        </div>

        {typeof chain.progress === "number" && (
          <div>
            <div className="mb-2 flex items-center justify-between text-[11.5px] text-ink-soft">
              <span>Confirmation progress</span>
              <span className="tabular-nums">{chain.progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gradient-purple transition-[width] duration-700"
                style={{ width: `${chain.progress}%` }}
              />
            </div>
          </div>
        )}

        {invoice.fx && (
          <div className="grid gap-5 rounded-2xl border border-border bg-background p-5 sm:grid-cols-3">
            <Field label="FX rate" value={invoice.fx.rate} />
            <Field label="Snapshot captured" value={invoice.fx.captured} />
            <Field label="AUD value" value={invoice.fx.settles} />
          </div>
        )}

        <p className="flex items-start gap-2 text-[13px] text-ink-soft">
          <Coins className="mt-0.5 h-4 w-4 shrink-0" />
          {invoice.settlement ?? "Settlement pending confirmation."}
        </p>

        <ActionButton label="View on block explorer" icon={ExternalLink} />
      </div>
    </ExpandableCard>
  );
}

function AccountingCard({ invoice }: { invoice: Invoice }) {
  return (
    <ExpandableCard title="Accounting & Xero" summary={invoice.xero}>
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-[13.5px] font-medium">
          <span className={`h-1.5 w-1.5 rounded-full ${XERO_DOT[invoice.xero]}`} />
          {invoice.xero}
        </div>

        <dl className="rounded-2xl border border-border bg-background p-5">
          {(invoice.refs ?? []).map((r) => (
            <div key={"acct-" + r.label} className="flex justify-between gap-4 py-1 text-[13px]">
              <dt className="text-ink-soft">{r.label}</dt>
              <dd className="font-medium">{r.value}</dd>
            </div>
          ))}
        </dl>

        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Sync history</div>
          <ul className="mt-3 space-y-2 text-[12.5px] text-ink-soft">
            {invoice.events
              .filter((e) => /xero|reconcil|ledger|sync/i.test(e.label + e.detail))
              .map((e) => (
                <li key={"sync-" + e.time} className="flex justify-between gap-4">
                  <span>{e.label}</span>
                  <span>{e.time}</span>
                </li>
              ))}
            {!invoice.events.some((e) => /xero|reconcil|ledger|sync/i.test(e.label + e.detail)) && (
              <li>No sync activity recorded yet.</li>
            )}
          </ul>
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton label="Push to Xero" icon={RefreshCw} />
          <ActionButton label="Retry sync" icon={RefreshCw} />
          <ActionButton label="View audit" icon={ShieldCheck} />
        </div>
      </div>
    </ExpandableCard>
  );
}

function AttachmentsCard({ invoice }: { invoice: Invoice }) {
  return (
    <ExpandableCard title="Attachments" summary={`${invoice.attachments!.length} file(s)`}>
      <ul className="space-y-2">
        {invoice.attachments!.map((f) => (
          <li
            key={f.name}
            className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3"
          >
            <FileText className="h-4 w-4 shrink-0 text-ink-soft" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{f.name}</div>
              <div className="text-[11.5px] text-ink-soft">{f.meta}</div>
            </div>
            <ActionButton label="Download" icon={Download} />
          </li>
        ))}
      </ul>
    </ExpandableCard>
  );
}

function AuditCard({ invoice }: { invoice: Invoice }) {
  return (
    <ExpandableCard title="Audit log" summary={`${invoice.events.length} entries`}>
      <ol className="space-y-2">
        {invoice.events.map((e) => (
          <li
            key={"audit-" + e.time}
            className="flex items-start justify-between gap-4 border-b border-border/60 pb-2 text-[13px] last:border-0"
          >
            <div>
              <div className="font-medium">{e.label}</div>
              <div className="text-[12px] text-ink-soft">{e.detail}</div>
            </div>
            <span className="whitespace-nowrap text-[11.5px] text-ink-soft">{e.time}</span>
          </li>
        ))}
      </ol>
    </ExpandableCard>
  );
}

function BottomActions() {
  return (
    <section className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-6 shadow-card">
      <ActionButton label="Send reminder" icon={Bell} primary />
      <ActionButton label="Duplicate invoice" icon={Copy} />
      <ActionButton label="Create recurring invoice" icon={Repeat} />
      <ActionButton label="Download PDF" icon={Download} />
      <ActionButton label="Archive" icon={Archive} />
      <ActionButton label="Delete" icon={Trash2} danger />
    </section>
  );
}

function AISidebar({ invoice }: { invoice: Invoice }) {
  const [dismissed, setDismissed] = useState<number[]>([]);
  const items = (invoice.ai ?? []).filter((_, i) => !dismissed.includes(i));

  return (
    <section
      aria-labelledby="ai-detail-heading"
      className="rounded-2xl border border-primary/25 bg-accent/20 p-6 shadow-card"
    >
      <div className="flex items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-purple text-primary-foreground">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <h2 id="ai-detail-heading" className="text-[13.5px] font-semibold">
          Provvy AI
        </h2>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Live
        </span>
      </div>
      <p className="mt-4 text-[12.5px] text-ink-soft">Analysis of {invoice.number}</p>

      <ul className="mt-4 space-y-3">
        {items.length === 0 && (
          <li className="rounded-xl border border-border bg-background/70 p-4 text-[13px] text-ink-soft">
            Nothing needs your attention on this invoice.
          </li>
        )}
        {(invoice.ai ?? []).map((a, i) =>
          dismissed.includes(i) ? null : (
            <li
              key={a.cta + i}
              className={`rounded-xl border bg-background/70 p-4 ${
                a.tone === "warn" ? "border-amber-500/30" : "border-border"
              }`}
            >
              <p className="text-[13px] leading-relaxed">{a.text}</p>
              <div className="mt-3 flex items-center gap-3">
                {a.cta !== "Dismiss" && (
                  <button className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {a.cta}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setDismissed((d) => [...d, i])}
                  className="text-[12px] text-ink-soft transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Dismiss
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

function StatusSummary({ invoice }: { invoice: Invoice }) {
  const rows = [
    { label: "Amount", value: invoice.display },
    { label: "Outstanding", value: invoice.outstanding ?? invoice.display },
    { label: "Due", value: invoice.due },
    { label: "Payment", value: invoice.pay },
    { label: "Xero", value: invoice.xero },
    { label: "Settlement", value: invoice.settlement ?? "Not settled" },
  ];
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <h2 className="text-[13.5px] font-semibold">At a glance</h2>
      <dl className="mt-4 space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-4 text-[13px]">
            <dt className="text-ink-soft">{r.label}</dt>
            <dd className="max-w-[60%] text-right font-medium">{r.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex items-center gap-2 text-[12px] text-ink-soft">
        <Landmark className="h-3.5 w-3.5" />
        Reconciles into your Commercial OS ledger
      </div>
    </section>
  );
}
