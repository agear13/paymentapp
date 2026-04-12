'use client';

import * as React from 'react';
import { CopilotHeader } from '@/components/copilot/copilot-header';
import { CopilotContextBar } from '@/components/copilot/copilot-context-bar';
import { CopilotSuggestions } from '@/components/copilot/copilot-suggestions';
import { CopilotConversation } from '@/components/copilot/copilot-conversation';
import { CopilotComposer } from '@/components/copilot/copilot-composer';
import { useProvvyCopilot } from '@/components/copilot/provvy-copilot-provider';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

function useLargeScreen() {
  return React.useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia('(min-width: 1024px)');
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia('(min-width: 1024px)').matches,
    () => false,
  );
}

function CopilotPanelBody({
  collapsed,
  mobile,
  className,
}: {
  collapsed: boolean;
  /** Full-width mobile sheet — never use collapsed strip */
  mobile?: boolean;
  className?: string;
}) {
  const {
    state,
    setOpen,
    toggleCollapsed,
    applySuggestion,
    sendComposerMessage,
    confirmAction,
    cancelAction,
  } = useProvvyCopilot();

  const effectiveCollapsed = mobile ? false : collapsed;

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-background', className)}>
      <CopilotHeader
        collapsed={effectiveCollapsed}
        onToggleCollapse={toggleCollapsed}
        onClose={() => setOpen(false)}
      />
      {!effectiveCollapsed ? (
        <>
          <CopilotContextBar screen={state.screen} entity={state.entity} />
          <CopilotSuggestions
            suggestions={state.suggestions}
            disabled={state.loading}
            onSelect={applySuggestion}
          />
          <CopilotConversation
            messages={state.messages}
            loading={state.loading}
            error={state.error}
            completedActionIds={state.completedActionIds}
            cancelledActionIds={state.cancelledActionIds}
            pendingAction={state.pendingAction}
            onConfirmAction={confirmAction}
            onCancelAction={cancelAction}
          />
          <CopilotComposer disabled={state.loading} onSend={sendComposerMessage} />
        </>
      ) : null}
    </div>
  );
}

export function ProvvyCopilotPanel() {
  const { state, setOpen } = useProvvyCopilot();
  const isLarge = useLargeScreen();
  const sheetOpen = state.isOpen && !isLarge;

  return (
    <>
      {/* Desktop / tablet: inline rail */}
      {state.isOpen && isLarge ? (
        <aside
          id="provvy-copilot-panel"
          className={cn(
            'hidden h-full shrink-0 flex-col border-l bg-background lg:flex',
            state.isCollapsed ? 'w-14' : 'w-[380px]',
          )}
          aria-label="Provvypay Copilot"
        >
          <CopilotPanelBody collapsed={state.isCollapsed} />
        </aside>
      ) : null}

      {/* Mobile: overlay sheet */}
      <div className="lg:hidden">
        <Sheet
          open={sheetOpen}
          onOpenChange={(open) => {
            setOpen(open);
          }}
        >
          <SheetContent
            side="right"
            className="h-full w-full max-w-[380px] gap-0 border-l p-0 [&>button]:hidden"
          >
            <CopilotPanelBody collapsed={false} mobile className="h-full" />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
