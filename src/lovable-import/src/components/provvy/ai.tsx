import * as React from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfidenceBar } from "./progress";

export function AIThinking({ label = "Thinking" }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-[12px] text-primary">
      <Sparkles className="size-3.5" />
      <span>{label}</span>
      <span className="inline-flex gap-0.5">
        <span className="size-1 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
        <span className="size-1 animate-bounce rounded-full bg-primary [animation-delay:120ms]" />
        <span className="size-1 animate-bounce rounded-full bg-primary [animation-delay:240ms]" />
      </span>
    </div>
  );
}

/** Character-by-character streaming text */
export function StreamingText({ text, speed = 14, className }: { text: string; speed?: number; className?: string }) {
  const [out, setOut] = React.useState("");
  React.useEffect(() => {
    setOut("");
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setOut(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [text, speed]);
  return (
    <span className={cn("inline", className)}>
      {out}
      {out.length < text.length && <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-primary align-middle" />}
    </span>
  );
}

export function AIReasoningCard({ title, reasoning, confidence }: { title: string; reasoning: string; confidence?: number }) {
  return (
    <div className="rounded-2xl border border-primary/25 bg-accent/30 p-4 shadow-card">
      <div className="flex items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-purple text-primary-foreground">
          <Sparkles className="size-3.5" />
        </div>
        <div className="text-[13px] font-semibold">{title}</div>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-foreground/90">{reasoning}</p>
      {typeof confidence === "number" && (
        <div className="mt-3">
          <ConfidenceBar value={confidence} />
        </div>
      )}
    </div>
  );
}

export interface SuggestedAction {
  label: string;
  onClick?: () => void;
}

export function SuggestedActions({ actions }: { actions: SuggestedAction[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((a, i) => (
        <button
          key={i}
          type="button"
          onClick={a.onClick}
          className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-background px-2.5 py-1 text-[12px] font-medium text-primary transition-colors hover:bg-accent"
        >
          {a.label}
          <ArrowRight className="size-3" />
        </button>
      ))}
    </div>
  );
}

export function AIInsightsPanel({ title = "Provvy AI", children }: { title?: string; children: React.ReactNode }) {
  return (
    <aside className="rounded-2xl border border-primary/25 bg-accent/20 p-5 shadow-card">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-purple text-primary-foreground shadow-glow">
          <Sparkles className="size-4" />
        </div>
        <div>
          <div className="text-[13.5px] font-semibold">{title}</div>
          <div className="text-[11px] text-ink-soft">Reasoning alongside your business</div>
        </div>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </aside>
  );
}
