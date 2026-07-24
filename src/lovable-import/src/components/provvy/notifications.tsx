import * as React from "react";
import { toast as sonnerToast } from "sonner";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Sparkles, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const notify = {
  success: (message: string, description?: string) =>
    sonnerToast.success(message, { description, icon: <CheckCircle2 className="size-4" /> }),
  error: (message: string, description?: string) =>
    sonnerToast.error(message, { description, icon: <AlertCircle className="size-4" /> }),
  warning: (message: string, description?: string) =>
    sonnerToast.warning(message, { description, icon: <AlertTriangle className="size-4" /> }),
  info: (message: string, description?: string) =>
    sonnerToast.message(message, { description, icon: <Info className="size-4" /> }),
  ai: (message: string, description?: string) =>
    sonnerToast(message, { description, icon: <Sparkles className="size-4" /> }),
  sync: (message: string, description?: string) =>
    sonnerToast(message, { description, icon: <RefreshCw className="size-4 animate-spin" /> }),
};

type BannerTone = "info" | "warning" | "success" | "error" | "ai";

const bannerMap: Record<BannerTone, { className: string; icon: React.ComponentType<{ className?: string }> }> = {
  info: { className: "border-border bg-secondary/50 text-foreground", icon: Info },
  warning: { className: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300", icon: AlertTriangle },
  success: { className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300", icon: CheckCircle2 },
  error: { className: "border-destructive/30 bg-destructive/10 text-destructive", icon: AlertCircle },
  ai: { className: "border-primary/25 bg-accent/40 text-foreground", icon: Sparkles },
};

export function Banner({
  tone = "info",
  title,
  children,
  onDismiss,
  className,
}: {
  tone?: BannerTone;
  title?: string;
  children?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  const cfg = bannerMap[tone];
  const Icon = cfg.icon;
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] shadow-soft animate-fade-up",
        cfg.className,
        className
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="flex-1">
        {title && <div className="text-[13px] font-semibold">{title}</div>}
        {children && <div className="mt-0.5 text-[12.5px] opacity-90">{children}</div>}
      </div>
      {onDismiss && (
        <button aria-label="Dismiss" onClick={onDismiss} className="opacity-60 hover:opacity-100">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
