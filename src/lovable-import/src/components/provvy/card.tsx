import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ArrowUpRight, TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge, type Status } from "./status-badge";

const surface = cva(
  "relative rounded-2xl border bg-card text-card-foreground shadow-card transition-all duration-200",
  {
    variants: {
      interactive: {
        true: "hover:-translate-y-0.5 hover:shadow-glow",
        false: "",
      },
      tone: {
        default: "border-border",
        ai: "border-primary/25 bg-accent/30",
        emphasis: "border-border ring-1 ring-primary/10",
      },
    },
    defaultVariants: { interactive: false, tone: "default" },
  }
);

export interface SurfaceProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof surface> {}

export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, interactive, tone, ...props }, ref) => (
    <div ref={ref} className={cn(surface({ interactive, tone }), className)} {...props} />
  )
);
Surface.displayName = "Surface";

/** Commercial Health card */
export function CommercialHealthCard({ score, label = "Commercial Health", trend }: { score: number; label?: string; trend?: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const circumference = 2 * Math.PI * 42;
  const dash = (pct / 100) * circumference;
  return (
    <Surface tone="emphasis" className="p-5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">{label}</div>
        {typeof trend === "number" && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              trend >= 0 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-destructive/10 text-destructive"
            )}
          >
            {trend >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-5">
        <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
          <circle cx="50" cy="50" r="42" strokeWidth="8" className="fill-none stroke-secondary" />
          <circle
            cx="50"
            cy="50"
            r="42"
            strokeWidth="8"
            strokeLinecap="round"
            stroke="url(#health-grad)"
            className="fill-none transition-[stroke-dasharray] duration-700 ease-out"
            strokeDasharray={`${dash} ${circumference}`}
          />
          <defs>
            <linearGradient id="health-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="oklch(0.55 0.22 292)" />
              <stop offset="1" stopColor="oklch(0.62 0.2 275)" />
            </linearGradient>
          </defs>
        </svg>
        <div>
          <div className="text-4xl font-semibold tracking-[-0.03em]">{pct}<span className="text-xl text-ink-soft">/100</span></div>
          <div className="text-[12px] text-ink-soft">Composite of liquidity, growth &amp; efficiency</div>
        </div>
      </div>
    </Surface>
  );
}

/** Metric card */
export function MetricCard({ label, value, delta, hint }: { label: string; value: string; delta?: string; hint?: string }) {
  return (
    <Surface interactive className="p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">{label}</div>
      <div className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">{value}</div>
      <div className="mt-1 flex items-center justify-between text-[11.5px] text-ink-soft">
        <span>{hint}</span>
        {delta && <span className="text-emerald-600 dark:text-emerald-400">{delta}</span>}
      </div>
    </Surface>
  );
}

/** Workflow card */
export function WorkflowCard({ name, description, status, savings, onOpen }: { name: string; description?: string; status: Status; savings?: string; onOpen?: () => void }) {
  return (
    <Surface interactive className="group p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[14.5px] font-semibold">{name}</div>
          {description && <div className="mt-0.5 text-[12.5px] text-ink-soft">{description}</div>}
        </div>
        <StatusBadge status={status} />
      </div>
      {savings && <div className="mt-4 text-[11.5px] text-ink-soft">Estimated saving <span className="font-medium text-foreground">{savings}</span></div>}
      <button
        onClick={onOpen}
        className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-medium text-primary opacity-90 transition-opacity hover:opacity-100"
      >
        Open workflow <ArrowUpRight className="size-3.5" />
      </button>
    </Surface>
  );
}

/** Recommendation card (AI) */
export function RecommendationCard({ title, reason, impact, cta, onAccept }: { title: string; reason: string; impact?: string; cta?: string; onAccept?: () => void }) {
  return (
    <Surface tone="ai" className="p-5">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-background/50 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-primary">
        <Sparkles className="size-3" />
        Recommendation
      </div>
      <div className="mt-3 text-[15px] font-semibold">{title}</div>
      <div className="mt-1 text-[12.5px] text-ink-soft">{reason}</div>
      {impact && (
        <div className="mt-3 rounded-lg border border-border bg-background/60 p-2.5 text-[12px]">
          <span className="text-ink-soft">Expected impact — </span>
          <span className="font-medium">{impact}</span>
        </div>
      )}
      {cta && (
        <button
          onClick={onAccept}
          className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-purple px-3 text-[12.5px] font-medium text-primary-foreground shadow-glow"
        >
          {cta}
        </button>
      )}
    </Surface>
  );
}

/** Insight card */
export function InsightCard({ title, body }: { title: string; body: string }) {
  return (
    <Surface tone="ai" className="p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-purple text-primary-foreground">
          <Sparkles className="size-4" />
        </div>
        <div>
          <div className="text-[13px] font-semibold">{title}</div>
          <div className="mt-1 text-[12.5px] text-ink-soft">{body}</div>
        </div>
      </div>
    </Surface>
  );
}

/** Connected system card */
export function ConnectedSystemCard({ name, category, status }: { name: string; category: string; status: Status }) {
  return (
    <Surface interactive className="p-4">
      <div className="flex items-center justify-between">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-[13px] font-semibold">
          {name.slice(0, 2)}
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="mt-4 text-[14px] font-semibold">{name}</div>
      <div className="text-[12px] text-ink-soft">{category}</div>
    </Surface>
  );
}
