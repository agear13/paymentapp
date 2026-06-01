'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import { formatApprovalTimestamp } from '@/lib/projects/participant-compensation-copy';
import { ConversationImportAuditPanel } from '@/components/operations/conversation-import-audit-panel';

export type OperationalAuditTimelineProps = {
  entries: OperationalAuditEntry[];
  className?: string;
  maxItems?: number;
  emptyMessage?: string;
};

const TYPE_LABELS: Partial<Record<OperationalAuditEntry['type'], string>> = {
  agreement_shared: 'Agreement',
  agreement_viewed: 'Agreement',
  agreement_approved: 'Approval',
  participant_note_added: 'Note',
  funding_linked: 'Funding',
  obligations_generated: 'Obligations',
  obligations_funded: 'Funding',
  payout_eligible: 'Release',
  release_batch_generated: 'Release batch',
  compensation_updated: 'Compensation',
  attribution_configured: 'Attribution',
  payout_state_updated: 'Payout',
  conversation_imported: 'Import',
};

function ConversationImportTimelineItem({ entry }: { entry: OperationalAuditEntry }) {
  const [expanded, setExpanded] = React.useState(false);
  const payload = entry.conversationImport;

  return (
    <li className="pl-5 relative">
      <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-emerald-500 bg-background" />
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">{entry.title}</p>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {TYPE_LABELS.conversation_imported}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>
      <p className="text-[11px] text-muted-foreground/80 mt-1">
        {formatApprovalTimestamp(entry.timestamp)}
        {entry.actor ? ` · ${entry.actor}` : ''}
      </p>
      {payload ? (
        <div className="mt-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            View Conversation
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
            />
          </button>
          {expanded ? <ConversationImportAuditPanel payload={payload} /> : null}
        </div>
      ) : null}
    </li>
  );
}

export function OperationalAuditTimeline({
  entries,
  className,
  maxItems = 12,
  emptyMessage = 'Operational events will appear here as coordination progresses.',
}: OperationalAuditTimelineProps) {
  const visible = entries.slice(0, maxItems);

  if (visible.length === 0) {
    return <p className={cn('text-sm text-muted-foreground', className)}>{emptyMessage}</p>;
  }

  return (
    <ol className={cn('relative border-l border-border/60 ml-2 space-y-4', className)}>
      {visible.map((entry) =>
        entry.type === 'conversation_imported' && entry.conversationImport ? (
          <ConversationImportTimelineItem key={entry.id} entry={entry} />
        ) : (
          <li key={entry.id} className="pl-5 relative">
            <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-emerald-500 bg-background" />
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{entry.title}</p>
              {TYPE_LABELS[entry.type] ? (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {TYPE_LABELS[entry.type]}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>
            <p className="text-[11px] text-muted-foreground/80 mt-1">
              {formatApprovalTimestamp(entry.timestamp)}
              {entry.actor ? ` · ${entry.actor}` : ''}
            </p>
          </li>
        )
      )}
    </ol>
  );
}
