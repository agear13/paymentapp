import * as React from "react";
import {
  Check,
  Info,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  User,
  CreditCard,
  Cog,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type TimelineKind =
  | "success"
  | "warning"
  | "info"
  | "error"
  | "ai"
  | "user"
  | "payment"
  | "system";

export interface TimelineEvent {
  id: string;
  title: string;
  detail?: string;
  time: string;
  kind: TimelineKind;
}

const kindMap: Record<TimelineKind, { icon: LucideIcon; className: string }> = {
  success: { icon: Check, className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  warning: { icon: AlertTriangle, className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  info: { icon: Info, className: "bg-secondary text-ink-soft" },
  error: { icon: AlertCircle, className: "bg-destructive/10 text-destructive" },
  ai: { icon: Sparkles, className: "bg-accent text-accent-foreground" },
  user: { icon: User, className: "bg-secondary text-ink-soft" },
  payment: { icon: CreditCard, className: "bg-primary/10 text-primary" },
  system: { icon: Cog, className: "bg-secondary text-ink-soft" },
};

export function Timeline({ events, className }: { events: TimelineEvent[]; className?: string }) {
  return (
    <div className={cn("relative pl-3", className)}>
      <div className="absolute left-[13px] top-2 bottom-2 w-px bg-border" />
      <ol className="space-y-1">
        {events.map((e) => {
          const cfg = kindMap[e.kind];
          const Icon = cfg.icon;
          return (
            <li
              key={e.id}
              className="relative flex items-start gap-3 rounded-lg py-2.5 pl-4 pr-2 transition-colors hover:bg-secondary/60 animate-fade-up"
            >
              <div className={cn("relative z-10 mt-0.5 grid size-7 place-items-center rounded-lg", cfg.className)}>
                <Icon className="size-3.5" />
              </div>
              <div className="flex-1">
                <div className="text-[13.5px] font-medium">{e.title}</div>
                {e.detail && <div className="text-[12px] text-ink-soft">{e.detail}</div>}
              </div>
              <div className="whitespace-nowrap text-[11.5px] text-ink-soft">{e.time}</div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
