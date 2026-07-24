import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function LinearProgress({ value, className, label }: { value: number; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("w-full", className)}>
      {label && (
        <div className="mb-1 flex items-center justify-between text-[11.5px] text-ink-soft">
          <span>{label}</span>
          <span className="tabular-nums">{Math.round(pct)}%</span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-gradient-purple transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

export function CircularProgress({ value, size = 56, stroke = 5, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-secondary" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          className="fill-none stroke-primary transition-[stroke-dasharray] duration-500"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
        />
      </svg>
      <span className="absolute text-[11.5px] font-medium tabular-nums">{label ?? `${Math.round(pct)}%`}</span>
    </div>
  );
}

export interface Step {
  label: string;
  state: "todo" | "current" | "done";
}

export function StepProgress({ steps, className }: { steps: Step[]; className?: string }) {
  return (
    <ol className={cn("flex items-center gap-2", className)}>
      {steps.map((s, i) => (
        <li key={i} className="flex flex-1 items-center gap-2">
          <div
            className={cn(
              "grid size-6 place-items-center rounded-full border text-[11px] font-semibold transition-colors",
              s.state === "done" && "border-primary bg-primary text-primary-foreground",
              s.state === "current" && "border-primary text-primary",
              s.state === "todo" && "border-border text-ink-soft"
            )}
          >
            {s.state === "done" ? <Check className="size-3" /> : i + 1}
          </div>
          <span
            className={cn(
              "hidden text-[12px] sm:inline",
              s.state === "current" ? "font-medium text-foreground" : "text-ink-soft"
            )}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div className={cn("h-px flex-1", s.state === "done" ? "bg-primary" : "bg-border")} />
          )}
        </li>
      ))}
    </ol>
  );
}

export function AIProcessing({ label = "Provvy AI is thinking" }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-accent/60 px-3 py-1 text-[12px] font-medium text-primary">
      <span className="relative grid size-4 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
        <Loader2 className="size-3 animate-spin" />
      </span>
      {label}
      <span className="ml-0.5 inline-flex gap-0.5">
        <span className="size-1 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
        <span className="size-1 animate-bounce rounded-full bg-primary [animation-delay:120ms]" />
        <span className="size-1 animate-bounce rounded-full bg-primary [animation-delay:240ms]" />
      </span>
    </div>
  );
}

export function ConfidenceBar({ value, label = "Confidence" }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const tone = pct >= 85 ? "emerald" : pct >= 60 ? "primary" : "amber";
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-[11px] text-ink-soft">
        <span>{label}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            tone === "emerald" && "bg-emerald-500",
            tone === "primary" && "bg-primary",
            tone === "amber" && "bg-amber-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
