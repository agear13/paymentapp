'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Brain, FileText, Plus } from 'lucide-react';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';
import { useDeployedWorkflows } from '@/hooks/use-deployed-workflows';
import { useWorkflowAgreement } from '@/hooks/use-workflow-agreement';
import { useWorkflowAgreementList } from '@/hooks/use-workflow-agreement-list';
import { AgreementIntelligenceInputModal } from '@/components/journey/lovable/agreement-intelligence-input-modal';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  matchesAgreementCollectionFilter,
} from '@/lib/workflows/agreement-intelligence/agreement-collection';
import type { AgreementCollectionFilter, AgreementCollectionItem } from '@/lib/workflows/agreement-intelligence/types';

const FILTERS: Array<{ id: AgreementCollectionFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'processing', label: 'Processing' },
  { id: 'ready_for_review', label: 'Ready for review' },
  { id: 'approved_active', label: 'Approved / Active' },
  { id: 'failed', label: 'Failed' },
];

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function AgreementCard({ item }: { item: AgreementCollectionItem }) {
  return (
    <Link
      href={item.href}
      className="block rounded-2xl border border-border bg-card p-5 shadow-card transition-colors hover:border-primary/40 hover:bg-secondary/20"
      data-testid="agreement-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[16px] font-semibold text-foreground">{item.title}</h2>
          <p className="mt-1 text-[13px] text-ink-soft">
            {item.participantCount == null
              ? 'Participants not captured yet'
              : `${item.participantCount} participant${item.participantCount === 1 ? '' : 's'}`}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-ink-soft">
          {item.statusLabel}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-soft">
        <span>Updated {formatUpdatedAt(item.updatedAt)}</span>
        {item.isCurrent ? <span>Current workflow</span> : null}
      </div>
    </Link>
  );
}

export function AgreementIntelligenceIndexScreen() {
  const router = useRouter();
  const { getBySlug, loading: workflowsLoading } = useDeployedWorkflows();
  const template = getWorkflowBySlug('agreement-intelligence');
  const installed = getBySlug('agreement-intelligence');
  const { data, loading: listLoading, error, refresh } = useWorkflowAgreementList(installed?.id ?? null);
  const {
    submitting,
    error: submitError,
    submitPaste,
    submitUpload,
    startNew,
  } = useWorkflowAgreement(installed?.id ?? null, undefined, { skipInitialFetch: true });

  const [inputOpen, setInputOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<AgreementCollectionFilter>('all');

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1') {
      setInputOpen(true);
      params.delete('new');
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
      window.history.replaceState(null, '', next);
    }
    const participantId = params.get('participant');
    if (participantId && data?.currentAgreementId) {
      router.replace(
        `${COMMERCIAL_OS_ROUTES.workflowAgreement('agreement-intelligence', data.currentAgreementId)}?participant=${encodeURIComponent(participantId)}`
      );
    }
  }, [data?.currentAgreementId, router]);

  const loading = workflowsLoading || listLoading;
  const agreements = data?.agreements ?? [];
  const visible = agreements.filter((item) => matchesAgreementCollectionFilter(item, filter));

  const beginNewExtraction = async () => {
    if (data && !data.canStartNew) {
      toast.error('Finish the extraction already in progress before starting a new one.');
      return;
    }
    if (agreements.length > 0) {
      const ok = await startNew();
      if (!ok) return;
      await refresh();
    }
    setInputOpen(true);
  };

  const handlePaste = async (text: string) => {
    const agreementId = await submitPaste(text);
    if (!agreementId) return false;
    await refresh();
    router.push(COMMERCIAL_OS_ROUTES.workflowAgreement('agreement-intelligence', agreementId));
    return true;
  };

  const handleUpload = async (file: File) => {
    const agreementId = await submitUpload(file);
    if (!agreementId) return false;
    await refresh();
    router.push(COMMERCIAL_OS_ROUTES.workflowAgreement('agreement-intelligence', agreementId));
    return true;
  };

  if (loading) {
    return (
      <div className="animate-fade-up py-16 text-center text-[13px] text-ink-soft">
        Loading agreements…
      </div>
    );
  }

  if (!installed) {
    return (
      <div className="animate-fade-up space-y-6 pb-16">
        <Link
          href={COMMERCIAL_OS_ROUTES.workspace}
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Workspace
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <h1 className="text-xl font-semibold">Agreement Intelligence</h1>
          <p className="mt-2 text-[14px] text-ink-soft">
            This workflow is not installed in your workspace yet.
          </p>
          <Link
            href={COMMERCIAL_OS_ROUTES.workflowDetail('agreement-intelligence')}
            className="mt-4 inline-flex rounded-xl bg-gradient-purple px-4 py-2 text-[13px] font-semibold text-primary-foreground"
          >
            Add from Workflow Library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-8 pb-16" data-testid="agreement-intelligence-index">
      <Link
        href={COMMERCIAL_OS_ROUTES.workspace}
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Workspace
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-purple text-primary-foreground shadow-glow">
            <Brain className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {template?.name ?? 'Agreement Intelligence'}
            </h1>
            <p className="mt-2 max-w-2xl text-[14px] text-ink-soft">
              Turn agreements into structured commercial workflows.
            </p>
          </div>
        </div>
        <Button type="button" onClick={() => void beginNewExtraction()} data-testid="new-extraction">
          <Plus className="mr-2 h-4 w-4" />
          New extraction
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
          {error}
        </div>
      ) : null}

      {agreements.length === 0 ? (
        <div
          className="rounded-3xl border border-dashed border-border bg-card px-8 py-16 text-center shadow-card"
          data-testid="agreements-empty-state"
        >
          <FileText className="mx-auto h-10 w-10 text-ink-soft" />
          <h2 className="mt-4 text-lg font-semibold">No agreements yet</h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-ink-soft">
            Upload an agreement or paste a conversation to turn it into a structured commercial
            workflow.
          </p>
          <Button
            type="button"
            className="mt-6"
            onClick={() => void beginNewExtraction()}
            data-testid="create-first-extraction"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create your first extraction
          </Button>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            <Button type="button" variant="outline" onClick={() => void beginNewExtraction()}>
              Upload Agreement
            </Button>
            <Button type="button" variant="outline" onClick={() => void beginNewExtraction()}>
              Paste Agreement Text
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((tab) => {
              const count =
                tab.id === 'all'
                  ? agreements.length
                  : agreements.filter((item) => item.statusFilter === tab.id).length;
              if (tab.id !== 'all' && count === 0) return null;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                    filter === tab.id
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border text-ink-soft hover:text-foreground'
                  }`}
                >
                  {tab.label}
                  <span className="ml-1.5 text-ink-soft">{count}</span>
                </button>
              );
            })}
          </div>

          {visible.length === 0 ? (
            <p className="text-[13px] text-ink-soft">No agreements in this view.</p>
          ) : (
            <div className="grid gap-4">
              {visible.map((item) => (
                <AgreementCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      )}

      <AgreementIntelligenceInputModal
        open={inputOpen}
        onOpenChange={setInputOpen}
        submitting={submitting}
        error={submitError}
        onUpload={handleUpload}
        onPaste={handlePaste}
        title="New extraction"
        loadingTitle="Extracting agreement details…"
        loadingDescription="Identifying parties, payment terms and obligations."
      />
    </div>
  );
}
