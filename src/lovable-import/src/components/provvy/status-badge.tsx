import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Check,
  CircleDot,
  Clock,
  Loader2,
  Pause,
  Plug,
  PlugZap,
  X,
  FileText,
  ShieldCheck,
} from "lucide-react";

export type Status =
  | "connected"
  | "disconnected"
  | "ready"
  | "running"
  | "processing"
  | "pending"
  | "completed"
  | "failed"
  | "draft"
  | "approved";

const map: Record<Status, { label: string; className: string; icon: React.ComponentType<{ className?: string }>; spin?: boolean }> = {
  connected: { label: "Connected", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", icon: PlugZap },
  disconnected: { label: "Disconnected", className: "bg-secondary text-ink-soft", icon: Plug },
  ready: { label: "Ready", className: "bg-primary/10 text-primary", icon: CircleDot },
  running: { label: "Running", className: "bg-primary/10 text-primary", icon: Loader2, spin: true },
  processing: { label: "Processing", className: "bg-primary/10 text-primary", icon: Loader2, spin: true },
  pending: { label: "Pending", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: Clock },
  completed: { label: "Completed", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", icon: Check },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive", icon: X },
  draft: { label: "Draft", className: "bg-secondary text-ink-soft", icon: FileText },
  approved: { label: "Approved", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", icon: ShieldCheck },
};

export function StatusBadge({ status, label, className }: { status: Status; label?: string; className?: string }) {
  const cfg = map[status];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        cfg.className,
        className
      )}
    >
      <Icon className={cn("size-3", cfg.spin && "animate-spin")} />
      {label ?? cfg.label}
    </span>
  );
}

export function PauseBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-ink-soft">
      <Pause className="size-3" />
      Paused
    </span>
  );
}
