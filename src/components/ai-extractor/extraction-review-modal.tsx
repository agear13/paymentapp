'use client';

import * as React from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { ExtractionResult, ExtractorEntryPoint, SourceType } from '@/lib/ai-extractor/extraction-types';
import type { ReviewedParty, ReviewFormState } from '@/lib/ai-extractor/review-form-types';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { reviewFormFromExtraction, isSupportedCurrency } from '@/lib/ai-extractor/review-form-types';
import { useOrganizationCurrency } from '@/hooks/use-organization-currency';
import { buildExtractionSummary } from '@/lib/ai-extractor/extraction-summary';
import { detectDuplicates, defaultResolutions } from '@/lib/ai-extractor/duplicate-detection';
import { mapReviewToRecentDeal, mapReviewToParticipants } from '@/lib/ai-extractor/extraction-mapper';
import { runParticipantAddSaveBranchTrace } from '@/lib/ai-extractor/duplicate-save-path-instrumentation';
import {
  logOnboardingPipelineDemoParticipants,
  startOnboardingPipelineSession,
} from '@/lib/ai-extractor/onboarding-pipeline-instrumentation';
import { EXTRACTOR_VERSION, SOURCE_TYPE_LABELS } from '@/lib/ai-extractor/extraction-types';
import { fetchPilotSnapshot, persistPilotSnapshot } from '@/lib/deal-network-demo/pilot-store';
import { toast } from 'sonner';
import { ConfidenceBadge } from './confidence-badge';
import { ReviewPartyCard } from './review-party-card';
import { PostExtractionPrompt } from './post-extraction-prompt';
import { appendOperationalAuditEntry } from '@/hooks/use-operational-audit-store';
import {
  appendConversationImportToDeal,
  buildConversationImportAuditRecord,
  buildIncompleteExtractionCompensationAuditEntries,
  conversationImportToAuditEntry,
} from '@/lib/operations/audit/conversation-import-audit';
import {
  fixedComponentActive,
  validateReviewFormCompensation,
} from '@/lib/ai-extractor/compensation-review-validation';

const CURRENCIES = ['AUD', 'USD'] as const;

function newEmptyParty(): ReviewedParty {
  return {
    id: `ep-new-${Date.now()}`,
    name: '',
    email: '',
    role: 'Contributor',
    participationModel: 'fixed_payout',
    fixedAmount: null,
    revenueSharePct: null,
    notes: '',
  };
}

interface ExtractionReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: ExtractionResult;
  entryPoint: ExtractorEntryPoint;
  sourceType: SourceType;
  /** Required for Entry Point B — the existing project being added to. */
  existingDeal?: RecentDeal;
  /** Required for Entry Point B — existing participants for duplicate detection. */
  existingParticipants?: DemoParticipant[];
  /** Original conversation text — stored on the deal for permanent audit access. */
  rawConversationText?: string;
  /** Entry Point A: called with new deal id. Entry Point B: called with no args. Entry Point C: called with new participants. */
  onComplete: (dealId?: string, participants?: DemoParticipant[]) => void;
}

export function ExtractionReviewModal({
  open,
  onOpenChange,
  result,
  entryPoint,
  sourceType,
  rawConversationText,
  existingDeal,
  existingParticipants,
  onComplete,
}: ExtractionReviewModalProps) {
  const { currency: workspaceCurrency } = useOrganizationCurrency();
  const currencyContext = React.useMemo(
    () => ({
      project: existingDeal ?? null,
      workspaceCurrency,
    }),
    [existingDeal, workspaceCurrency]
  );
  const [form, setForm] = React.useState<ReviewFormState>(() =>
    reviewFormFromExtraction(
      result,
      entryPoint,
      sourceType,
      existingDeal?.id,
      currencyContext
    )
  );
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [partyValidationErrors, setPartyValidationErrors] = React.useState<Record<string, string>>({});
  const [uncertaintiesOpen, setUncertaintiesOpen] = React.useState(true);
  const [postPromptOpen, setPostPromptOpen] = React.useState(false);
  const [createdParticipants, setCreatedParticipants] = React.useState<DemoParticipant[]>([]);
  const [createdProjectName, setCreatedProjectName] = React.useState<string | undefined>(undefined);

  // Re-initialise form when result changes (new extraction).
  React.useEffect(() => {
    const base = reviewFormFromExtraction(
      result,
      entryPoint,
      sourceType,
      existingDeal?.id,
      currencyContext
    );
    // Detect duplicates for Entry Point B.
    if (entryPoint === 'participant_add' && existingParticipants && existingParticipants.length > 0) {
      const matches = detectDuplicates(base.parties, existingParticipants);
      base.duplicateResolutions = defaultResolutions(matches);
    }
    base.rawConversationText = rawConversationText;
    setForm(base);
    setSaveError(null);
    setPartyValidationErrors({});
  }, [
    result,
    entryPoint,
    sourceType,
    existingDeal?.id,
    existingParticipants,
    rawConversationText,
    currencyContext,
  ]);

  const summary = React.useMemo(() => buildExtractionSummary(result), [result]);

  // Currency safety: unsupported ISO codes nulled fixed amounts in reviewFormFromExtraction.
  const extractedCurrency =
    form.extractedCurrencyCode ?? result.currency.value?.trim().toUpperCase() ?? null;
  const isUnsupportedCurrency = form.extractedCurrencyUnsupported;

  // Duplicate matches for Entry Point B.
  const duplicateMatches = React.useMemo(() => {
    if (entryPoint !== 'participant_add' || !existingParticipants) return [];
    return detectDuplicates(form.parties, existingParticipants);
  }, [entryPoint, existingParticipants, form.parties]);

  const updateParty = (index: number, updated: ReviewedParty) => {
    setForm((f) => {
      const parties = [...f.parties];
      parties[index] = updated;
      return { ...f, parties };
    });
    setPartyValidationErrors((prev) => {
      if (!prev[updated.id]) return prev;
      const next = { ...prev };
      delete next[updated.id];
      return next;
    });
  };

  const removeParty = (index: number) => {
    setForm((f) => ({ ...f, parties: f.parties.filter((_, i) => i !== index) }));
  };

  const addParty = () => {
    setForm((f) => ({ ...f, parties: [...f.parties, newEmptyParty()] }));
  };

  const validate = (): string | null => {
    if (form.parties.length === 0 || !form.parties.some((p) => p.name.trim())) {
      return 'Add at least one participant with a name.';
    }
    if (entryPoint === 'project_create' && !form.projectName.trim()) {
      return 'Project name is required.';
    }

    const originalsById = new Map(result.parties.map((p) => [p.id, p]));

    if (isUnsupportedCurrency && extractedCurrency) {
      if (entryPoint === 'project_create' && !form.projectValue) {
        return `Convert the project value from ${extractedCurrency} to AUD or USD before saving.`;
      }
      const unconverted = form.parties.filter(
        (p) =>
          p.name.trim() &&
          fixedComponentActive(p, originalsById.get(p.id)) &&
          (p.fixedAmount == null || p.fixedAmount <= 0)
      );
      if (unconverted.length > 0) {
        const names = unconverted.map((p) => p.name.trim()).join(', ');
        return `Convert the payout amount from ${extractedCurrency} to AUD or USD for: ${names}.`;
      }
    }
    const compensationIssues = validateReviewFormCompensation(form.parties, originalsById);
    if (compensationIssues.length > 0) {
      const nextErrors: Record<string, string> = {};
      for (const issue of compensationIssues) {
        nextErrors[issue.partyId] = issue.blockSaveMessage;
      }
      setPartyValidationErrors(nextErrors);
      const names = compensationIssues.map((i) => i.partyName).join(', ');
      return `Complete compensation terms for: ${names}. Enter missing amounts, change the model, or remove the participant.`;
    }

    setPartyValidationErrors({});
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setSaveError(err); return; }

    setSaving(true);
    setSaveError(null);

    try {
      const importRecord = buildConversationImportAuditRecord({
        form,
        result,
        entryPoint,
        sourceType,
      });

      if (entryPoint === 'project_create') {
        // Entry Point A: create new project + participants.
        const newDeal = mapReviewToRecentDeal(form, importRecord);
        const originalsById = new Map(result.parties.map((p) => [p.id, p]));
        const newParticipants = mapReviewToParticipants(form, newDeal, originalsById);
        const snapshot = await fetchPilotSnapshot();
        const existing = snapshot ?? { deals: [], participants: [] };
        const persistPayload = {
          deals: [newDeal, ...existing.deals.filter((d) => d.id !== newDeal.id)],
          participants: [...existing.participants, ...newParticipants],
        };
        const ok = await persistPilotSnapshot(persistPayload);
        if (!ok) throw new Error('Could not save project. Please try again.');
        await fetch('/api/deal-network-pilot/obligations/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ dealId: newDeal.id }),
        });
        onOpenChange(false);
        const pCount = newParticipants.length;
        toast.success('Agreement created from conversation', {
          description: pCount > 0
            ? `${pCount} participant${pCount !== 1 ? 's' : ''} added`
            : newDeal.dealName,
        });
        appendOperationalAuditEntry(conversationImportToAuditEntry(newDeal.id, importRecord));
        for (const entry of buildIncompleteExtractionCompensationAuditEntries({
          projectId: newDeal.id,
          result,
          importedAt: importRecord.importedAt,
        })) {
          appendOperationalAuditEntry(entry);
        }
        setCreatedParticipants(newParticipants);
        setCreatedProjectName(newDeal.dealName);
        setPostPromptOpen(true);
        onComplete(newDeal.id);

      } else if (entryPoint === 'participant_add' && existingDeal) {
        // Entry Point B: iterate form.parties directly so party.id is always in scope.
        // Duplicate resolution is keyed by party.id — no name matching anywhere.
        const provenanceTag = `[AI Import: ${SOURCE_TYPE_LABELS[form.sourceType] ?? form.sourceType} · ${EXTRACTOR_VERSION}]`;
        const snapshot = await fetchPilotSnapshot();
        const existing = snapshot ?? { deals: [], participants: [] };

        let updatedParticipants = [...existing.participants];
        let addedCount = 0;
        let updatedCount = 0;

        const { report: saveBranchReport, updatedParticipants: nextParticipants } =
          runParticipantAddSaveBranchTrace({
            label: `participant_add:${existingDeal.id}`,
            form,
            result,
            existingDeal,
            duplicateMatchesAtSave: duplicateMatches,
            snapshotParticipants: updatedParticipants,
            provenanceTag,
          });
        updatedParticipants = nextParticipants;
        addedCount = saveBranchReport.partyTraces.filter((t) => t.enteredBranch === 'create').length;
        updatedCount = saveBranchReport.partyTraces.filter((t) => t.enteredBranch === 'update').length;

        const updatedDeals = existing.deals.map((d) =>
          d.id === existingDeal.id ? appendConversationImportToDeal(d, importRecord) : d
        );

        const ok = await persistPilotSnapshot({
          deals: updatedDeals,
          participants: updatedParticipants,
        });
        if (!ok) throw new Error('Could not save participants. Please try again.');
        await fetch('/api/deal-network-pilot/obligations/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ dealId: existingDeal.id }),
        });
        onOpenChange(false);
        const parts: string[] = [];
        if (addedCount > 0) parts.push(`${addedCount} new participant${addedCount !== 1 ? 's' : ''} added`);
        if (updatedCount > 0) parts.push(`${updatedCount} existing participant${updatedCount !== 1 ? 's' : ''} updated`);
        toast.success('Participants added from conversation', {
          description: parts.join(', ') || `Added to ${existingDeal.dealName}`,
        });
        appendOperationalAuditEntry(
          conversationImportToAuditEntry(existingDeal.id, importRecord)
        );
        for (const entry of buildIncompleteExtractionCompensationAuditEntries({
          projectId: existingDeal.id,
          result,
          importedAt: importRecord.importedAt,
        })) {
          appendOperationalAuditEntry(entry);
        }
        onComplete();

      } else if (entryPoint === 'onboarding') {
        // Entry Point C: always use the real onboarding project — never the AI-extracted name.
        // existingDeal is always provided in onboarding mode from workflow-onboarding-form.tsx.
        const projectDeal: RecentDeal = existingDeal ?? {
          id: `onboarding-${Date.now()}`,
          dealName: 'Onboarding Project',
          partner: '',
          value: 0,
          introducer: '',
          closer: '',
          status: 'Pending',
          lastUpdated: new Date().toISOString(),
          paymentStatus: 'Not Paid',
        };
        const originalsById = new Map(result.parties.map((p) => [p.id, p]));
        const newParticipants = mapReviewToParticipants(form, projectDeal, originalsById);
        startOnboardingPipelineSession(`onboarding:${projectDeal.id}`);
        logOnboardingPipelineDemoParticipants('mapReviewToParticipants', newParticipants, {
          entryPoint: 'onboarding',
          projectId: projectDeal.id,
        });
        onOpenChange(false);
        const pCount = newParticipants.length;
        toast.success('Participants added', {
          description: `${pCount} participant${pCount !== 1 ? 's' : ''} added to ${projectDeal.dealName}`,
        });
        logOnboardingPipelineDemoParticipants('onCompletePayload', newParticipants, {
          entryPoint: 'onboarding',
        });
        onComplete(undefined, newParticipants);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const showProjectSection = entryPoint === 'project_create';
  const showPaymentTerms = entryPoint !== 'onboarding' && result.paymentTerms.length > 0;

  const confidenceConfig = {
    high:   { variant: 'default' as const, text: '✓ High confidence extraction. Review and save below.' },
    medium: { variant: 'default' as const, text: '⚠ Some fields need review. Check highlighted items.' },
    low:    { variant: 'destructive' as const, text: '✗ Low confidence. Please review all fields carefully.' },
    absent: { variant: 'destructive' as const, text: '✗ Could not extract agreement details. Please fill in all fields manually.' },
  };
  const conf = confidenceConfig[result.overallConfidence];

  const saveLabel = {
    project_create: 'Save Project',
    participant_add: 'Add Participants',
    onboarding: 'Add to Project',
  }[entryPoint];

  return (<>
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Extracted Agreement</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Overall confidence banner */}
          <Alert variant={conf.variant === 'destructive' ? 'destructive' : undefined}
                 className={cn(result.overallConfidence === 'high' && 'border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300')}>
            <AlertDescription className="text-xs">{conf.text}</AlertDescription>
          </Alert>

          {/* Unsupported currency warning — shown whenever extracted currency is not AUD/USD */}
          {isUnsupportedCurrency && extractedCurrency && (
            <Alert className="border-amber-500/40 bg-amber-500/8 text-amber-900 dark:text-amber-200">
              <AlertDescription className="text-xs space-y-1.5">
                <p className="font-medium">Unsupported Currency Detected</p>
                <p>
                  This conversation contains values denominated in {extractedCurrency}. Projects
                  support AUD and USD only. Enter converted AUD/USD amounts before saving or
                  generating agreements.
                </p>
                {result.projectValue.value != null && (
                  <p>
                    Original extracted amount:{' '}
                    <span className="font-semibold">
                      {extractedCurrency} {result.projectValue.value.toLocaleString()}
                    </span>
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* AI Summary */}
          <div className="rounded-lg border bg-muted/10 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI Summary</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {summary.projectCount > 0 && (
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{summary.projectCount}</span> Project
                </span>
              )}
              {summary.participantCount > 0 && (
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{summary.participantCount}</span>{' '}
                  {summary.participantCount === 1 ? 'Participant' : 'Participants'}
                </span>
              )}
              {summary.fixedPayoutCount > 0 && (
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{summary.fixedPayoutCount}</span>{' '}
                  Fixed {summary.fixedPayoutCount === 1 ? 'Payout' : 'Payouts'}
                </span>
              )}
              {summary.revenueShareCount > 0 && (
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{summary.revenueShareCount}</span>{' '}
                  Revenue Share {summary.revenueShareCount === 1 ? 'Arrangement' : 'Arrangements'}
                </span>
              )}
              {summary.attributionCount > 0 && (
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{summary.attributionCount}</span>{' '}
                  Attribution {summary.attributionCount === 1 ? 'Arrangement' : 'Arrangements'}
                </span>
              )}
            </div>
            {summary.oneLiner && (
              <p className="text-sm text-foreground/80 italic">"{summary.oneLiner}"</p>
            )}
          </div>

          {/* Uncertainties accordion */}
          {result.uncertainties.length > 0 && (
            <div className="rounded-md border">
              <button
                type="button"
                onClick={() => setUncertaintiesOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-accent/30 transition-colors"
              >
                <span className="text-amber-700 dark:text-amber-400">
                  ⚠ AI flagged ambiguities ({result.uncertainties.length})
                </span>
                <span className="text-muted-foreground text-xs">{uncertaintiesOpen ? '▲' : '▼'}</span>
              </button>
              {uncertaintiesOpen && (
                <div className="border-t divide-y">
                  {result.uncertainties.map((u, i) => (
                    <div key={i} className="px-4 py-2.5 space-y-0.5">
                      <p className="text-xs font-semibold">{u.field}</p>
                      <p className="text-xs text-muted-foreground">{u.issue}</p>
                      {u.snippet && (
                        <p className="text-xs text-muted-foreground/70 italic">"{u.snippet}"</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Project Details — Entry Point A only */}
          {showProjectSection && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Project Details</p>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Agreement name</Label>
                  <ConfidenceBadge confidence={result.projectName.confidence} />
                </div>
                <Input
                  value={form.projectName}
                  onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))}
                  placeholder="Project name"
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Description</Label>
                  <ConfidenceBadge confidence={result.projectDescription.confidence} />
                </div>
                <Textarea
                  value={form.projectDescription}
                  onChange={(e) => setForm((f) => ({ ...f, projectDescription: e.target.value }))}
                  placeholder="Optional description"
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">
                      Project Value {isUnsupportedCurrency ? '(AUD or USD)' : ''}
                    </Label>
                    {!isUnsupportedCurrency && (
                      <ConfidenceBadge confidence={result.projectValue.confidence} />
                    )}
                  </div>
                  <Input
                    type="number"
                    min={0}
                    value={form.projectValue ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, projectValue: e.target.value ? Number(e.target.value) : null }))
                    }
                    placeholder={isUnsupportedCurrency ? 'Enter converted amount' : '0'}
                    className={cn(
                      'h-8 text-sm',
                      isUnsupportedCurrency && form.projectValue === null && 'border-amber-400 focus-visible:ring-amber-400'
                    )}
                  />
                  {isUnsupportedCurrency && result.projectValue.value != null && (
                    <p className="text-xs text-muted-foreground">
                      Original:{' '}
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        {extractedCurrency} {result.projectValue.value.toLocaleString()}
                      </span>
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Currency</Label>
                    {!isUnsupportedCurrency && (
                      <ConfidenceBadge confidence={result.currency.confidence} />
                    )}
                  </div>
                  <Select
                    value={CURRENCIES.includes(form.currency as typeof CURRENCIES[number]) ? form.currency : 'AUD'}
                    onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c} className="text-sm">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Primary Counterparty</Label>
                  <ConfidenceBadge confidence={result.counterparty.confidence} />
                </div>
                <Input
                  value={form.counterparty}
                  onChange={(e) => setForm((f) => ({ ...f, counterparty: e.target.value }))}
                  placeholder="Optional"
                  className="h-8 text-sm"
                />
              </div>

              <Separator />
            </div>
          )}

          {/* Existing project label — Entry Point B */}
          {entryPoint === 'participant_add' && existingDeal && (
            <p className="text-xs text-muted-foreground">
              Adding participants to: <span className="font-medium text-foreground">{existingDeal.dealName}</span>
            </p>
          )}

          {/* Participants */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Participants ({form.parties.length})
              </p>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addParty}>
                <Plus className="mr-1 h-3 w-3" />
                Add Participant
              </Button>
            </div>

            <div className="space-y-3">
              {form.parties.map((party, index) => {
                const originalParty = result.parties.find((p) => p.id === party.id);
                const dupMatch = duplicateMatches.find((m) => m.extractedPartyId === party.id);
                return (
                  <ReviewPartyCard
                    key={party.id}
                    party={party}
                    originalParty={originalParty}
                    entryPoint={entryPoint}
                    extractedCurrency={
                      isUnsupportedCurrency && extractedCurrency ? extractedCurrency : undefined
                    }
                    duplicateMatch={dupMatch}
                    duplicateResolution={form.duplicateResolutions[party.id]}
                    onDuplicateResolutionChange={(resolution) =>
                      setForm((f) => ({
                        ...f,
                        duplicateResolutions: { ...f.duplicateResolutions, [party.id]: resolution },
                      }))
                    }
                    onChange={(updated) => updateParty(index, updated)}
                    onRemove={() => removeParty(index)}
                    validationMessage={partyValidationErrors[party.id] ?? null}
                  />
                );
              })}

              {form.parties.length === 0 && (
                <div className="rounded-lg border border-dashed bg-muted/10 py-8 text-center">
                  <p className="text-xs text-muted-foreground">No participants detected. Use the button above to add manually.</p>
                </div>
              )}
            </div>
          </div>

          {/* Payment Terms — reference only */}
          {showPaymentTerms && (
            <div className="space-y-2">
              <Separator />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Payment Terms <span className="font-normal normal-case">(reference only — not saved directly)</span>
              </p>
              <div className="rounded-md border bg-background px-3 py-2 space-y-1.5">
                {result.paymentTerms.map((term, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <ConfidenceBadge confidence={term.description.confidence} className="mt-0.5 flex-shrink-0" />
                    <span className="text-foreground/80">
                      {term.description.value}
                      {term.amount.value != null && ` · ${term.currency.value || 'AUD'} ${term.amount.value.toLocaleString()}`}
                      {term.dueCondition.value && ` · ${term.dueCondition.value}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save error */}
          {saveError && (
            <p className="text-xs text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              {saveError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <PostExtractionPrompt
      open={postPromptOpen}
      onOpenChange={setPostPromptOpen}
      participants={createdParticipants}
      projectName={createdProjectName}
    />
  </>);
}