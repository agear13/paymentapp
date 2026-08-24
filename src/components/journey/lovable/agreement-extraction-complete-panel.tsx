'use client';

import * as React from 'react';
import Link from 'next/link';
import { CheckCircle2, Download, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import {
  buildExtractionExportDocument,
  downloadExtractionExport,
  extractionContactEmails,
} from '@/lib/ai-extractor/extraction-export';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import type { WorkflowAgreementHubSummary } from '@/lib/workflows/agreement-intelligence/types';

export function AgreementExtractionCompletePanel({
  extraction,
  hub,
  operatorEmail,
  sharing,
  shareError,
  shareSuccess,
  onReview,
  onShare,
}: {
  extraction: ExtractionResult;
  hub: WorkflowAgreementHubSummary;
  operatorEmail?: string | null;
  sharing: boolean;
  shareError: string | null;
  shareSuccess: string | null;
  onReview: () => void;
  onShare: (to: string) => Promise<void>;
}) {
  const contacts = React.useMemo(() => {
    const emails = extractionContactEmails(extraction);
    const operator = operatorEmail?.trim().toLowerCase();
    if (operator && operator.includes('@') && !emails.includes(operator)) {
      return [operator, ...emails];
    }
    return emails;
  }, [extraction, operatorEmail]);

  const [to, setTo] = React.useState(operatorEmail?.trim() ?? '');

  React.useEffect(() => {
    setTo((current) => (current.trim() ? current : operatorEmail?.trim() ?? current));
  }, [operatorEmail]);

  const handleDownload = () => {
    downloadExtractionExport(
      buildExtractionExportDocument({
        result: extraction,
        title: hub.title,
      })
    );
  };

  return (
    <div
      className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5"
      data-testid="extraction-complete-panel"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
        <div>
          <p className="text-[15px] font-semibold text-foreground">Extraction complete</p>
          <p className="mt-1 text-[13px] text-ink-soft">
            {hub.oneLiner ||
              `Provvy extracted ${hub.participantCount} participant${hub.participantCount === 1 ? '' : 's'} and ${hub.obligationCount} obligation${hub.obligationCount === 1 ? '' : 's'}.`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handleDownload} data-testid="download-extraction">
          <Download className="mr-2 h-4 w-4" />
          Download extraction JSON
        </Button>
        <Button type="button" variant="outline" onClick={onReview}>
          Review structured result
        </Button>
      </div>

      <form
        className="space-y-3 rounded-xl border border-border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onShare(to);
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="extraction-operator-email">Send to operator email</Label>
          <p className="text-[12px] text-ink-soft">
            Uses the workspace email sender. Enter an operator address or choose a contact from this
            extraction.
          </p>
        </div>
        <Input
          id="extraction-operator-email"
          type="email"
          required
          value={to}
          onChange={(event) => setTo(event.target.value)}
          placeholder="operator@example.com"
          autoComplete="email"
          data-testid="extraction-share-email"
        />
        {contacts.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {contacts.map((email) => (
              <button
                key={email}
                type="button"
                className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-[12px] text-foreground hover:bg-secondary"
                onClick={() => setTo(email)}
              >
                {email}
              </button>
            ))}
          </div>
        ) : null}
        {shareError ? (
          <p className="text-[13px] text-destructive" data-testid="extraction-share-error">
            {shareError}
          </p>
        ) : null}
        {shareSuccess ? (
          <p className="text-[13px] text-emerald-700 dark:text-emerald-400" data-testid="extraction-share-success">
            {shareSuccess}
          </p>
        ) : null}
        <Button type="submit" variant="outline" disabled={sharing || !to.trim()}>
          {sharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
          {sharing ? 'Sending…' : 'Send extraction'}
        </Button>
      </form>

      <div className="space-y-2">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
          Next in Provvy
        </p>
        <div className="flex flex-wrap gap-2">
          {hub.canApprove ? (
            <Button type="button" variant="outline" onClick={onReview}>
              Approve structure
            </Button>
          ) : null}
          <Link
            href={COMMERCIAL_OS_ROUTES.workflowInstance('referral-management')}
            className="inline-flex h-10 items-center rounded-md border border-border bg-background px-4 text-[13px] font-medium text-foreground hover:bg-secondary"
          >
            Continue in Referral Management
          </Link>
          <Link
            href={COMMERCIAL_OS_ROUTES.workflowInstance('agreement-intelligence')}
            className="inline-flex h-10 items-center rounded-md px-4 text-[13px] font-medium text-ink-soft hover:text-foreground"
          >
            Back to Agreement Intelligence
          </Link>
          <Link
            href={COMMERCIAL_OS_ROUTES.workspace}
            className="inline-flex h-10 items-center rounded-md px-4 text-[13px] font-medium text-ink-soft hover:text-foreground"
          >
            Back to workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
