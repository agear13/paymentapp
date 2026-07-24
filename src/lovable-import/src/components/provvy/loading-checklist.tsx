import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { LinearProgress } from "./progress";

export interface LoadingChecklistItem {
  label: string;
  detail?: string;
}

/**
 * Meaningful loading experience — an animated checklist that ticks items off
 * over time. Use for "Analysing agreement", "Provisioning workspace" etc.
 */
export function LoadingChecklist({
  title,
  items,
  perStepMs = 900,
  onComplete,
  className,
}: {
  title: string;
  items: LoadingChecklistItem[];
  perStepMs?: number;
  onComplete?: () => void;
  className?: string;
}) {
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    if (step >= items.length) {
      onComplete?.();
      return;
    }
    const t = window.setTimeout(() => setStep((s) => s + 1), perStepMs);
    return () => window.clearTimeout(t);
  }, [step, items.length, perStepMs, onComplete]);

  const pct = (Math.min(step, items.length) / items.length) * 100;

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-card", className)}>
      <div className="flex items-center justify-between">
        <div className="text-[13.5px] font-semibold">{title}</div>
        <div className="text-[11.5px] tabular-nums text-ink-soft">{Math.round(pct)}%</div>
      </div>
      <LinearProgress value={pct} className="mt-3" />
      <ul className="mt-4 space-y-2">
        {items.map((it, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li
              key={i}
              className={cn(
                "flex items-start gap-3 rounded-lg px-2 py-1.5 transition-colors",
                active && "bg-accent/40"
              )}
            >
              <div
                className={cn(
                  "mt-0.5 grid size-5 place-items-center rounded-full border transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary",
                  !done && !active && "border-border text-ink-soft"
                )}
              >
                {done ? <Check className="size-3" /> : active ? <Loader2 className="size-3 animate-spin" /> : null}
              </div>
              <div className="flex-1">
                <div className={cn("text-[12.5px]", done ? "text-ink-soft line-through" : active ? "font-medium" : "text-ink-soft")}>
                  {it.label}
                </div>
                {it.detail && active && (
                  <div className="text-[11.5px] text-ink-soft">{it.detail}</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
