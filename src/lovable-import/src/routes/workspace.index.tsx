import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Sparkles,
  Clock,
  TrendingUp,
  FileText,
  CreditCard,
  RefreshCw,
  Activity,
  Upload,
  Plug,
  Workflow as WorkflowIcon,
  Library,
  Send,
} from "lucide-react";

export const Route = createFileRoute("/workspace/")({
  component: WorkspaceHome,
});

const TIMELINE = [
  { icon: Check, label: "Commercial OS provisioned", time: "Just now", tone: "primary" as const },
  { icon: Sparkles, label: "Autonomous Reconciliation recommended", time: "2m ago", tone: "primary" as const },
  { icon: Plug, label: "Xero connected", time: "5m ago", tone: "muted" as const },
  { icon: Check, label: "Commercial assessment completed", time: "8m ago", tone: "muted" as const },
  { icon: CreditCard, label: "Payment received · Invoice #INV-1042", time: "Yesterday", tone: "muted" as const },
  { icon: RefreshCw, label: "Settlement completed · A$12,480", time: "2 days ago", tone: "muted" as const },
];

const SYSTEMS = [
  { name: "Xero", detail: "Accounting", status: "Connected" },
  { name: "Pinch Payments", detail: "Payments", status: "Connected" },
  { name: "Google Workspace", detail: "Email · Docs", status: "Connected" },
  { name: "Outlook", detail: "Email", status: "Available" },
  { name: "Stripe", detail: "Payments", status: "Available" },
];

const CAPABILITIES = [
  "Agreement Intelligence",
  "Payment Collection",
  "Pinch Payments",
  "Xero Synchronisation",
  "AI Monitoring",
];

const PROMPTS = [
  "Explain my Commercial Health",
  "Why was this workflow recommended?",
  "What should I improve next?",
  "How can I reduce manual work?",
];

function WorkspaceHome() {
  const [health, setHealth] = useState(0);
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      n += 2;
      if (n >= 82) {
        n = 82;
        clearInterval(id);
      }
      setHealth(n);
    }, 20);
    return () => clearInterval(id);
  }, []);

  const circumference = 2 * Math.PI * 44;
  const dash = (health / 100) * circumference;

  return (
    <div className="animate-fade-up space-y-8 pb-16">
      {/* Welcome */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-accent px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-accent-foreground">
            <Sparkles className="h-3 w-3" />
            Personalised for your business
          </div>
          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Welcome to your Commercial Operating System.
          </h1>
          <p className="mt-2 max-w-xl text-[15px] text-ink-soft">
            Provvy has analysed your business and prepared the highest-impact workflow. Everything below is calibrated to how you operate.
          </p>
        </div>
      </div>

      {/* Top row: Commercial Health + Recommended Workflow */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Commercial Health */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
              Commercial Health
            </div>
            <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-3 w-3" />
              Improving
            </div>
          </div>
          <div className="mt-6 flex items-center gap-5">
            <div className="relative h-28 w-28">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle cx="50" cy="50" r="44" fill="none" stroke="var(--color-secondary)" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="url(#healthGradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circumference}`}
                  className="transition-all duration-500 ease-out"
                />
                <defs>
                  <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--purple-glow)" />
                    <stop offset="100%" stopColor="var(--purple-deep)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <div className="text-2xl font-semibold tracking-tight">{health}</div>
                  <div className="-mt-0.5 text-[10px] text-ink-soft">/ 100</div>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <div className="text-[15px] font-semibold">Good</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
                A composite score of your commercial maturity — how well systems, workflows and data operate together.
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-2 border-t border-border pt-4 text-[12.5px]">
            {[
              { k: "Systems connected", v: "3 / 5" },
              { k: "Workflows active", v: "0 / 1" },
              { k: "Automation coverage", v: "42%" },
            ].map((r) => (
              <div key={r.k} className="flex items-center justify-between">
                <span className="text-ink-soft">{r.k}</span>
                <span className="font-medium">{r.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recommended Workflow — hero card */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-6 shadow-glow lg:col-span-2 lg:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-purple px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-primary-foreground">
                <Sparkles className="h-3 w-3" />
                Recommended workflow
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Ready to Deploy
              </div>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
              Autonomous Reconciliation
            </h2>
            <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-ink-soft">
              Provvy has identified this workflow as the highest-impact opportunity for your business. Agreements, invoices and payments reconcile end-to-end with AI oversight.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Metric icon={Clock} label="Hours saved / month" value="38" />
              <Metric icon={TrendingUp} label="Manual work reduced" value="72%" />
              <Metric icon={Activity} label="Business impact" value="High" />
            </div>

            <div className="mt-6">
              <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                Connected capabilities
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {CAPABILITIES.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-2.5 py-1 text-[12px] font-medium text-foreground"
                  >
                    <Check className="h-3 w-3 text-primary" />
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/workspace/workflow/reconciliation"
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-purple px-5 py-3 text-[14px] font-semibold text-primary-foreground shadow-glow transition-transform hover:-translate-y-0.5"
              >
                Continue Workflow
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/workspace/workflow/reconciliation"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-3 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
              >
                View details
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Second row: Timeline + Advisor */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Timeline */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                Commercial Timeline
              </div>
              <div className="mt-1 text-[15px] font-semibold">Live business activity</div>
            </div>
            <Link
              to="/workspace/timeline"
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline"
            >
              View all
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-5 space-y-1">
            {TIMELINE.map((e, i) => {
              const Icon = e.icon;
              return (
                <div key={i} className="group relative flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary/60">
                  <div
                    className={`mt-0.5 grid h-7 w-7 place-items-center rounded-lg ${
                      e.tone === "primary"
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-ink-soft"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13.5px] font-medium text-foreground">{e.label}</div>
                    <div className="text-[11.5px] text-ink-soft">{e.time}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Advisor */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-purple text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                AI Advisor
              </div>
              <div className="text-[14px] font-semibold">Your operating partner</div>
            </div>
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">
            Ask grounded commercial questions. Provvy reasons across your systems, agreements and workflows.
          </p>
          <div className="mt-4 space-y-1.5">
            {PROMPTS.map((p) => (
              <Link
                key={p}
                to="/workspace/advisor"
                className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-[12.5px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <span>{p}</span>
                <ArrowRight className="h-3.5 w-3.5 text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
            <input
              readOnly
              placeholder="Ask Provvy AI…"
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-soft"
            />
            <button
              className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-purple text-primary-foreground"
              aria-label="Send"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Connected systems + Quick actions */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                Connected Systems
              </div>
              <div className="mt-1 text-[15px] font-semibold">Your operating infrastructure</div>
            </div>
            <Link
              to="/workspace/connected"
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline"
            >
              Manage
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {SYSTEMS.map((s) => {
              const connected = s.status === "Connected";
              return (
                <div
                  key={s.name}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3.5 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-[12px] font-semibold text-foreground">
                      {s.name.slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-[13.5px] font-medium">{s.name}</div>
                      <div className="text-[11.5px] text-ink-soft">{s.detail}</div>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      connected
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "bg-secondary text-ink-soft"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-ink-soft/50"}`}
                    />
                    {s.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Quick actions
          </div>
          <div className="mt-4 space-y-2">
            {[
              { label: "Upload Agreement", icon: Upload, to: "/workspace/workflow/reconciliation" as const },
              { label: "Connect another system", icon: Plug, to: "/workspace/connected" as const },
              { label: "Create Workflow", icon: WorkflowIcon, to: "/workspace/workflows" as const },
              { label: "View Workflow Library", icon: Library, to: "/workspace/workflows" as const },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.label}
                  to={a.to}
                  className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-ink-soft group-hover:text-primary" />
                    {a.label}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-ink-soft transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer note */}
      <div className="pt-2 text-center text-[12px] text-ink-soft">
        Provvy AI operates continuously. Your Commercial Timeline updates in real time.
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/70 px-4 py-3.5">
      <div className="flex items-center gap-2 text-ink-soft">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
