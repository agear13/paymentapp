import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface ModalProps {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  children?: React.ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryLoading?: boolean;
  primaryVariant?: "primary" | "destructive";
  secondaryLabel?: string;
  onSecondary?: () => void;
  className?: string;
}

export function Modal({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  primaryLabel,
  onPrimary,
  primaryLoading,
  primaryVariant = "primary",
  secondaryLabel = "Cancel",
  onSecondary,
  className,
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={cn("rounded-2xl border-border bg-card p-0 shadow-glow sm:max-w-[520px]", className)}>
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-[16px] font-semibold tracking-[-0.01em]">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-[13px] text-ink-soft">{description}</DialogDescription>
          )}
        </DialogHeader>
        {children && <div className="px-6 py-4 text-[13px]">{children}</div>}
        {(primaryLabel || secondaryLabel) && (
          <DialogFooter className="flex-row justify-end gap-2 border-t border-border bg-secondary/30 px-6 py-3">
            {secondaryLabel && (
              <Button variant="ghost" onClick={() => (onSecondary ? onSecondary() : onOpenChange?.(false))}>
                {secondaryLabel}
              </Button>
            )}
            {primaryLabel && (
              <Button variant={primaryVariant} loading={primaryLoading} onClick={onPrimary}>
                {primaryLabel}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
