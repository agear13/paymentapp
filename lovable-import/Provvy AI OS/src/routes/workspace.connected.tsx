import { createFileRoute } from "@tanstack/react-router";
import { Plug, Check, Plus } from "lucide-react";

export const Route = createFileRoute("/workspace/connected")({
  component: ConnectedPage,
});

const CONNECTED = [
  { name: "Xero", detail: "Accounting · Live sync", tag: "Primary ledger" },
  { name: "Pinch Payments", detail: "Payments · Live", tag: "Collections" },
  { name: "Google Workspace", detail: "Email · Docs", tag: "Communications" },
];

const AVAILABLE = [
  { name: "Outlook", detail: "Email" },
  { name: "Stripe", detail: "Payments" },
  { name: "Slack", detail: "Communications" },
  { name: "WhatsApp", detail: "Communications" },
  { name: "Wise", detail: "Payments" },
];

function ConnectedPage() {
  return (
    <div className="animate-fade-up space-y-8 pb-16">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-soft">
          <Plug className="h-3 w-3" />
          Connected Systems
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          Your operating infrastructure.
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-soft">
          Every system Provvy is connected to feeds directly into your Commercial Operating System.
        </p>
      </header>

      <section>
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
          Connected
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {CONNECTED.map((s) => (
            <div key={s.name} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-[13px] font-semibold">
                  {s.name.slice(0, 2)}
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  <Check className="h-3 w-3" />
                  Connected
                </span>
              </div>
              <div className="mt-4 text-[14.5px] font-semibold">{s.name}</div>
              <div className="text-[12px] text-ink-soft">{s.detail}</div>
              <div className="mt-4 inline-flex rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                {s.tag}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
          Available to connect
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {AVAILABLE.map((s) => (
            <div key={s.name} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-[13px] font-semibold">
                  {s.name.slice(0, 2)}
                </div>
                <div>
                  <div className="text-[13.5px] font-semibold">{s.name}</div>
                  <div className="text-[11.5px] text-ink-soft">{s.detail}</div>
                </div>
              </div>
              <button className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-accent">
                <Plus className="h-3.5 w-3.5" />
                Connect
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
