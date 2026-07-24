import * as React from "react";
import { type LucideIcon, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center animate-fade-up", className)}>
      <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-accent">
        <span className="absolute inset-0 animate-pulse-glow rounded-2xl bg-primary/10" />
        <Icon className="relative size-6 text-primary" />
      </div>
      <div className="mt-4 text-[15px] font-semibold tracking-[-0.01em]">{title}</div>
      {description && <div className="mt-1 max-w-sm text-[12.5px] text-ink-soft">{description}</div>}
      {(actionLabel || secondaryLabel) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {actionLabel && <Button onClick={onAction}>{actionLabel}</Button>}
          {secondaryLabel && (
            <Button variant="ghost" onClick={onSecondary}>
              {secondaryLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
