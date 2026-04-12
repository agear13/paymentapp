'use client';

import { ChevronLeft, ChevronRight, PanelRightClose, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function CopilotHeader({
  onToggleCollapse,
  onClose,
  collapsed,
  className,
}: {
  onToggleCollapse: () => void;
  onClose: () => void;
  collapsed: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-12 shrink-0 items-center gap-1 border-b bg-background px-2',
        className,
      )}
    >
      {!collapsed ? (
        <>
          <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
            <span className="bg-primary/10 flex size-8 shrink-0 items-center justify-center rounded-md">
              <Sparkles className="text-primary size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">Provvypay Copilot</p>
              <p className="text-muted-foreground truncate text-[11px]">Operator assistant</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={onToggleCollapse}
            aria-label="Collapse panel"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={onClose}
            aria-label="Close copilot"
          >
            <PanelRightClose className="size-4" aria-hidden />
          </Button>
        </>
      ) : (
        <div className="flex w-full flex-col items-center gap-2 py-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onToggleCollapse}
            aria-label="Expand copilot"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Sparkles className="text-primary size-4" aria-hidden />
        </div>
      )}
    </div>
  );
}
