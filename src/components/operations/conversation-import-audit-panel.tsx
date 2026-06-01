'use client';

import { ConfidenceBadge } from '@/components/ai-extractor/confidence-badge';
import type { ConversationImportAuditPayload } from '@/lib/operations/audit/conversation-import-audit-types';
import { formatPartyCompensationTerms } from '@/lib/operations/audit/conversation-import-audit';
import { participationModelLabel } from '@/lib/projects/participant-entitlement';
import { formatApprovalTimestamp } from '@/lib/projects/participant-compensation-copy';
import { cn } from '@/lib/utils';

type ConversationImportAuditPanelProps = {
  payload: ConversationImportAuditPayload;
  className?: string;
};

export function ConversationImportAuditPanel({
  payload,
  className,
}: ConversationImportAuditPanelProps) {
  const summary = payload.extractionSummary;

  return (
    <div
      className={cn(
        'mt-3 rounded-md border bg-muted/20 p-3 space-y-4 text-sm',
        className
      )}
    >
      <div className="grid gap-2 sm:grid-cols-2 text-xs">
        <div>
          <p className="text-muted-foreground uppercase tracking-wide text-[10px]">Source</p>
          <p className="font-medium">{payload.sourceType ?? 'Unknown'}</p>
        </div>
        <div>
          <p className="text-muted-foreground uppercase tracking-wide text-[10px]">Imported</p>
          <p className="font-medium">{formatApprovalTimestamp(payload.importedAt)}</p>
        </div>
        <div>
          <p className="text-muted-foreground uppercase tracking-wide text-[10px]">Extracted</p>
          <p className="font-medium">{formatApprovalTimestamp(payload.extractedAt)}</p>
        </div>
        <div>
          <p className="text-muted-foreground uppercase tracking-wide text-[10px]">Overall confidence</p>
          <ConfidenceBadge confidence={summary.overallConfidence} />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium mb-1">Extraction summary</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{summary.oneLiner}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {summary.participantCount} participant{summary.participantCount !== 1 ? 's' : ''} ·{' '}
          {summary.agreementTypeLabel}
        </p>
      </div>

      {payload.parties.length > 0 ? (
        <div>
          <p className="text-xs font-medium mb-2">Participants detected</p>
          <ul className="space-y-2">
            {payload.parties.map((party) => (
              <li
                key={`${party.name}-${party.role}`}
                className="rounded border bg-background px-3 py-2 space-y-1"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-sm">{party.name}</p>
                  <ConfidenceBadge confidence={party.partyConfidence} />
                </div>
                <p className="text-xs text-muted-foreground">{party.role}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span>{participationModelLabel(party.participationModel)}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-medium">{formatPartyCompensationTerms(party)}</span>
                </div>
                <div className="flex flex-wrap gap-3 pt-1">
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    Name <ConfidenceBadge confidence={party.nameConfidence} />
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    Model <ConfidenceBadge confidence={party.participationModelConfidence} />
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    Terms <ConfidenceBadge confidence={party.amountConfidence} />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <p className="text-xs font-medium mb-1.5">Original conversation</p>
        {payload.rawConversationText.trim() ? (
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded border bg-background p-3 text-xs leading-relaxed font-sans">
            {payload.rawConversationText}
          </pre>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Original conversation text was not stored for this import.
          </p>
        )}
      </div>
    </div>
  );
}
