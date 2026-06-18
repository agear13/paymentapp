'use client';

/**
 * Commercial Brain Context
 *
 * The single React context for the Commercial Decision Engine within
 * an agreement workspace.
 *
 * Previously, WorkflowHeader, ProjectPageCopilot, CommercialReadiness and
 * other components each called analyseWorkspace() independently — computing
 * the same decision from the same inputs multiple times per render.
 *
 * Now: CommercialBrainProvider runs the engine once. Every component within
 * the agreement workspace consumes this shared result via useCommercialBrain().
 *
 * No page derives its own commercial logic.
 * No engine call is duplicated.
 */

import * as React from 'react';
import {
  analyseWorkspace,
  type CommercialDecisionResult,
  type CommercialCapabilities,
} from '@/components/workflow/commercial-decision-engine';
import {
  deriveWorkflowContext,
  type WorkflowContext,
} from '@/components/workflow/workflow-context';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';

/* ─── Context shape ─── */

export type CommercialBrainContextValue = {
  /** Full Decision Engine result — recommendations, consequences, memory, etc. */
  decision: CommercialDecisionResult | null;
  /** Workflow stage derivation — stage, progress %, continueHref, etc. */
  workflowCtx: WorkflowContext | null;
  /**
   * Commercial capabilities — the single source of truth for every completion
   * indicator in the product. Read this; never infer completion locally.
   * Shortcut for decision.commercialCapabilities.
   */
  commercialCapabilities: CommercialCapabilities | null;
  /** The agreement's project ID */
  projectId: string;
  /** The agreement's display name */
  agreementName: string | null;
  /** True while either workspace or operational data is still loading */
  loading: boolean;
};

const EMPTY: CommercialBrainContextValue = {
  decision: null,
  workflowCtx: null,
  commercialCapabilities: null,
  projectId: '',
  agreementName: null,
  loading: true,
};

const CommercialBrainCtx = React.createContext<CommercialBrainContextValue>(EMPTY);

/* ─── Consumer hook ─── */

/**
 * Consume the Commercial Brain from any agreement workspace component.
 *
 * Guaranteed to be stable within a render — the engine runs exactly once
 * per workspace page, not once per component.
 */
export function useCommercialBrain(): CommercialBrainContextValue {
  return React.useContext(CommercialBrainCtx);
}

/* ─── Provider ─── */

/**
 * Provide the Commercial Brain to all child components.
 *
 * Place this in the agreement workspace shell so every agreement page
 * (money, people, history, overview) gets the same computed result.
 */
export function CommercialBrainProvider({ children }: { children: React.ReactNode }) {
  const {
    deal,
    summary,
    projectParticipants,
    projectId,
    loading: wsLoading,
  } = useProjectWorkspace();

  const {
    kpis,
    guidance,
    workspaceContext,
    activation,
    auditTimeline,
    loading: opLoading,
  } = useOperationalCoordinationState({
    scope: 'project',
    project: deal ?? undefined,
    participants: projectParticipants,
    treasury: summary?.treasury ?? undefined,
    enabled: Boolean(deal),
    traceSurface: 'commercial-brain',
  });

  const value = React.useMemo<CommercialBrainContextValue>(() => {
    const loading = wsLoading || opLoading;

    if (loading || !deal || !summary) {
      return { ...EMPTY, projectId, loading };
    }

    // Run the engine exactly once
    const decision = analyseWorkspace({
      projectId,
      agreementName: summary.name,
      kpis: kpis ?? null,
      releaseConfidence: guidance.releaseConfidence ?? null,
      workspaceContext: workspaceContext ?? null,
      activation: activation ?? null,
      auditEntries: auditTimeline ?? [],
    });

    // Derive workflow stage (also used by WorkflowHeader)
    const workflowCtx = deriveWorkflowContext({
      projectId,
      agreementName: summary.name,
      kpis: kpis ?? null,
      releaseConfidence: guidance.releaseConfidence ?? null,
      workspaceContext: workspaceContext ?? null,
      activation: activation ?? null,
    });

    return {
      decision,
      workflowCtx,
      commercialCapabilities: decision.commercialCapabilities,
      projectId,
      agreementName: summary.name,
      loading: false,
    };
  }, [
    wsLoading,
    opLoading,
    deal,
    summary,
    projectId,
    kpis,
    guidance.releaseConfidence,
    workspaceContext,
    activation,
    auditTimeline,
  ]);

  return (
    <CommercialBrainCtx.Provider value={value}>
      {children}
    </CommercialBrainCtx.Provider>
  );
}
