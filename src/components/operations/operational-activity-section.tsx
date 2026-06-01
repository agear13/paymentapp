'use client';

import * as React from 'react';
import { OperationalAuditTimeline } from '@/components/operations/operational-audit-timeline';
import { useOperationalAuditStore } from '@/hooks/use-operational-audit-store';
import { useOptionalProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { deriveConversationImportAuditTimeline } from '@/lib/operations/audit/conversation-import-audit';
import { mergeAuditTimeline } from '@/lib/operations/audit/operational-audit';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { opCollapsibleTrigger } from '@/lib/design/operational-surfaces';
import { ChevronDown } from 'lucide-react';

type OperationalActivitySectionProps = {
  projectId?: string;
  participantId?: string;
  title?: string;
  emptyMessage?: string;
  defaultOpen?: boolean;
  maxItems?: number;
  className?: string;
};

/** Canonical operational activity mount — use on all coordination surfaces. */
export function OperationalActivitySection({
  projectId,
  participantId,
  title = 'Operational activity',
  emptyMessage,
  defaultOpen = false,
  maxItems = 12,
  className,
}: OperationalActivitySectionProps) {
  const storeEntries = useOperationalAuditStore({ projectId, participantId });
  const workspace = useOptionalProjectWorkspace();

  const entries = React.useMemo(() => {
    if (!projectId || !workspace?.deal) return storeEntries;
    const fromDeal = deriveConversationImportAuditTimeline([workspace.deal], projectId);
    return mergeAuditTimeline(storeEntries, fromDeal);
  }, [projectId, storeEntries, workspace?.deal]);

  return (
    <Collapsible defaultOpen={defaultOpen} className={className}>
      <CollapsibleTrigger className={opCollapsibleTrigger}>
        {title}
        {entries.length > 0 ? (
          <span className="text-xs text-muted-foreground ml-2">({entries.length})</span>
        ) : null}
        <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <OperationalAuditTimeline
          entries={entries}
          maxItems={maxItems}
          emptyMessage={
            emptyMessage ??
            'Operational events appear here as agreements, funding, obligations, and releases progress.'
          }
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
