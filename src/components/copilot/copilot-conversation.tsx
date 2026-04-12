'use client';

import * as React from 'react';
import { Bot, User } from 'lucide-react';
import type { AssistantStructuredBlock, CopilotMessage } from '@/lib/copilot/copilot-types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { AssistantDiagnosticCard } from '@/components/copilot/cards/assistant-diagnostic-card';
import { AssistantChecklistCard } from '@/components/copilot/cards/assistant-checklist-card';
import { ActionConfirmCard } from '@/components/copilot/cards/action-confirm-card';
import { ActionResultCard } from '@/components/copilot/cards/action-result-card';
import { WarningCard } from '@/components/copilot/cards/warning-card';

function AssistantBlocks({
  blocks,
  completedActionIds,
  cancelledActionIds,
  pendingActionId,
  onConfirm,
  onCancel,
}: {
  blocks: AssistantStructuredBlock[];
  completedActionIds: string[];
  cancelledActionIds: string[];
  pendingActionId: string | undefined;
  onConfirm: (actionId: string) => void;
  onCancel: (actionId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block, i) => {
        const key = `${block.type}-${i}`;
        switch (block.type) {
          case 'text':
            return (
              <p key={key} className="text-sm leading-relaxed text-foreground">
                {block.content}
              </p>
            );
          case 'diagnostic':
            return (
              <AssistantDiagnosticCard
                key={key}
                title={block.title}
                summary={block.summary}
                items={block.items}
              />
            );
          case 'checklist':
            return <AssistantChecklistCard key={key} title={block.title} items={block.items} />;
          case 'warning':
            return <WarningCard key={key} title={block.title} message={block.message} />;
          case 'action_result':
            return (
              <ActionResultCard
                key={key}
                title={block.title}
                message={block.message}
                success={block.success}
              />
            );
          case 'action_confirm': {
            const done = completedActionIds.includes(block.actionId);
            const cancelled = cancelledActionIds.includes(block.actionId);
            const active = pendingActionId === block.actionId && !done && !cancelled;
            if (done) {
              return (
                <p key={key} className="text-muted-foreground text-xs">
                  Action completed.
                </p>
              );
            }
            if (cancelled) {
              return (
                <p key={key} className="text-muted-foreground text-xs">
                  Action dismissed.
                </p>
              );
            }
            if (!active) {
              return (
                <p key={key} className="text-muted-foreground text-xs">
                  This action is no longer active.
                </p>
              );
            }
            return (
              <ActionConfirmCard
                key={key}
                title={block.title}
                description={block.description}
                confirmLabel={block.confirmLabel}
                cancelLabel={block.cancelLabel}
                onConfirm={() => onConfirm(block.actionId)}
                onCancel={() => onCancel(block.actionId)}
              />
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}

export function CopilotConversation({
  messages,
  loading,
  error,
  completedActionIds,
  cancelledActionIds,
  pendingAction,
  onConfirmAction,
  onCancelAction,
}: {
  messages: CopilotMessage[];
  loading: boolean;
  error: string | null;
  completedActionIds: string[];
  cancelledActionIds: string[];
  pendingAction: { id: string } | null;
  onConfirmAction: (actionId: string) => void;
  onCancelAction: (actionId: string) => void;
}) {
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="space-y-4 px-3 py-3">
        {messages.length === 0 && !loading ? (
          <p className="text-muted-foreground text-center text-xs leading-relaxed">
            Ask a question or pick a suggestion. Responses are stubbed for this MVP.
          </p>
        ) : null}

        {messages.map((msg) => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex gap-2">
                <div className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-md">
                  <User className="text-muted-foreground size-3.5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm shadow-sm">
                  {msg.content}
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex gap-2">
              <div className="bg-primary/10 flex size-7 shrink-0 items-center justify-center rounded-md">
                <Bot className="text-primary size-3.5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <AssistantBlocks
                  blocks={msg.blocks}
                  completedActionIds={completedActionIds}
                  cancelledActionIds={cancelledActionIds}
                  pendingActionId={pendingAction?.id}
                  onConfirm={onConfirmAction}
                  onCancel={onCancelAction}
                />
              </div>
            </div>
          );
        })}

        {loading ? (
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Spinner className="size-3.5" />
            Thinking…
          </div>
        ) : null}

        {error ? (
          <p className="text-destructive text-xs">{error}</p>
        ) : null}

        <div ref={endRef} />
      </div>
    </ScrollArea>
  );
}
