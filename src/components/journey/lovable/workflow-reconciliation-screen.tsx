'use client';

import '@/components/journey/lovable/lovable-journey.css';
import Link from 'next/link';
import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ConversationInputModal } from '@/components/ai-extractor/conversation-input-modal';
import { ExtractionReviewModal } from '@/components/ai-extractor/extraction-review-modal';
import { StarterLimitAlert } from '@/components/entitlements/starter-limit-alert';
import { useEntitlements } from '@/hooks/use-entitlements';
import { useOrganization } from '@/hooks/use-organization';
import type { ExtractionResult, SourceType } from '@/lib/ai-extractor/extraction-types';
import { SOURCE_TYPE_LABELS } from '@/lib/ai-extractor/extraction-types';
import {
  buildExtractionReadiness,
  type ReadinessDimension,
} from '@/lib/ai-extractor/extraction-readiness';
import { buildExtractionSummary } from '@/lib/ai-extractor/extraction-summary';
import { buildSettlementSchedule } from '@/lib/ai-extractor/settlement-schedule';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { fetchPilotSnapshot } from '@/lib/deal-network-demo/pilot-store';
import {
  buildInsightsFromExtraction,
  type AgreementIntelligenceInsight,
} from '@/lib/onboarding/agreement-intelligence-insights';
import {
  mapDemoParticipantToOnboardingDraft,
  onboardingDraftsFromExtraction,
} from '@/lib/onboarding/onboarding-participant-persist';
import type { OnboardingDraftParticipant } from '@/components/onboarding/onboarding-participant-card';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { deriveApprovalStats } from '@/components/projects/approval-centre-header';
import { deriveParticipantOperationalWorkflow } from '@/lib/commercial/participant-commercial-lifecycle';
import { operationalRoleLabel } from '@/lib/projects/participants-for-project';
import { persistParticipantAgreementShare } from '@/lib/projects/participant-agreement-share';
import { buildParticipantWorkspaceUrlForParticipant } from '@/lib/participant-portal/participant-portal-url';
import {
  isHackathonJourneyEnabled,
  logHackathonDemoFlagsInDevelopment,
} from '@/lib/journey/hackathon-journey';
import {
  simulateExternalParticipantApprovals,
} from '@/lib/journey/development-approval-simulator.client';
import {
  fetchPinchDevTestPayerId,
  formatPinchPayerLabel,
  formatPinchPaymentStatusLabel,
  formatPinchSourceTypeLabel,
  isPinchPaymentSuccessful,
  PINCH_CAPTUREJS_INTEGRITY,
  PINCH_CAPTUREJS_SRC,
  runPinchCollectionFlow,
} from '@/lib/payments/pinch/collection-flow.client';
import {
  deriveDemoClientPaymentPurpose,
  deriveDemoClientPaymentStatus,
  simulateDemoClientPayment,
  type DemoClientPaymentStep,
} from '@/lib/payments/pinch/development-payment-simulator.client';
import type { PinchCreatePaymentResponse } from '@/lib/payments/pinch/payment-service';
import type { PinchCreateSourceResponse } from '@/lib/payments/pinch/source-service';
import {
  buildWorkflowAllocationCards,
  deriveWorkflowSettlementStates,
  deriveWorkflowTimelineStep,
  executeWorkflowSettlementRelease,
  formatWorkflowFundingStatus,
  formatWorkflowMoney,
  isWorkflowSettlementComplete,
  loadWorkflowSettlementSnapshot,
  refreshWorkflowObligations,
  settlementParticipantsForDeal,
  type WorkflowFundingSummary,
  type WorkflowObligationRow,
} from '@/lib/commercial/workflows/settlement-flow.client';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Check,
  FileText,
  Brain,
  Eye,
  CreditCard,
  RefreshCw,
  Flag,
  Upload,
  Mail,
  MessageSquare,
  Cloud,
  ShieldCheck,
  Users,
  Activity,
  Calendar,
  AlertTriangle,
  Percent,
  Coins,
  Circle,
  Clock,
  TrendingUp,
  Loader2,
  BadgeCheck,
  UserRoundCheck,
  Send,
  PartyPopper,
  Plug,
  type LucideIcon,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Generic Workflow Framework — swap this config to render a different workflow
// ─────────────────────────────────────────────────────────────────────────────

type StageKey =
  | "agreement"
  | "extraction"
  | "review"
  | "approvals"
  | "collection"
  | "settlement"
  | "complete";

type WorkflowConfig = {
  name: string;
  objective: string;
  participants: { name: string; role: string }[];
  systems: string[];
  currency: string;
  amount: number;
  stages: { key: StageKey; label: string; icon: LucideIcon }[];
};

const RECONCILIATION: WorkflowConfig = {
  name: "Autonomous Reconciliation",
  objective: "Collect, allocate and reconcile A$48,600 across three parties",
  participants: [
    { name: "Northside Venue", role: "Venue" },
    { name: "Loop Promotions", role: "Promoter" },
    { name: "Harper & Co", role: "Accountant" },
    { name: "Provvy Operator", role: "Operator" },
  ],
  systems: ["Xero", "Pinch Payments", "Gmail", "Google Drive"],
  currency: "A$",
  amount: 48600,
  stages: [
    { key: "agreement", label: "Agreement", icon: FileText },
    { key: "extraction", label: "AI Extraction", icon: Brain },
    { key: "review", label: "Review", icon: Eye },
    { key: "approvals", label: "Approvals", icon: UserRoundCheck },
    { key: "collection", label: "Payment Collection", icon: CreditCard },
    { key: "settlement", label: "Settlement", icon: RefreshCw },
    { key: "complete", label: "Complete", icon: Flag },
  ],
};

const WORKFLOW = RECONCILIATION;

type WorkflowImportSnapshot = {
  result: ExtractionResult;
  dealId: string;
  dealName: string;
  sourceType: SourceType;
  rawConversationText: string;
};

export function WorkflowReconciliationScreen() {
  const [stage, setStage] = useState<StageKey>("agreement");
  const [importSnapshot, setImportSnapshot] = useState<WorkflowImportSnapshot | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const stageIndex = WORKFLOW.stages.findIndex((s) => s.key === stage);

  useEffect(() => {
    logHackathonDemoFlagsInDevelopment();
  }, []);

  const go = (key: StageKey) => {
    setStage(key);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const next = () => {
    const n = WORKFLOW.stages[stageIndex + 1];
    if (n) go(n.key);
  };

  return (
    <div className="animate-fade-up space-y-8 pb-16">
      <Link
        href="/workspace"
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to workspace
      </Link>

      {/* Workflow header */}
      <header className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-purple px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-primary-foreground">
                <Sparkles className="h-3 w-3" />
                Commercial workflow
              </div>
              <StatusPill stage={stage} />
            </div>
            <h1 className="mt-3 text-balance text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
              {WORKFLOW.name}
            </h1>
            <p className="mt-1.5 max-w-2xl text-[13.5px] text-ink-soft">
              {WORKFLOW.objective}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-3">
          <MetaGroup icon={Users} label="Participants">
            <div className="flex -space-x-1.5">
              {WORKFLOW.participants.map((p, i) => (
                <div
                  key={p.name}
                  title={`${p.name} · ${p.role}`}
                  className="grid h-7 w-7 place-items-center rounded-full border-2 border-card bg-secondary text-[10.5px] font-semibold text-foreground"
                  style={{ zIndex: WORKFLOW.participants.length - i }}
                >
                  {p.name
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")}
                </div>
              ))}
              <span className="ml-3 self-center text-[12.5px] text-ink-soft">
                {WORKFLOW.participants.length} parties
              </span>
            </div>
          </MetaGroup>
          <MetaGroup icon={Plug} label="Connected systems">
            <div className="flex flex-wrap gap-1.5">
              {WORKFLOW.systems.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11.5px] font-medium text-foreground"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {s}
                </span>
              ))}
            </div>
          </MetaGroup>
          <MetaGroup icon={Coins} label="Commercial value">
            <div className="text-[15px] font-semibold tracking-tight">
              {WORKFLOW.currency}
              {WORKFLOW.amount.toLocaleString()}
            </div>
            <div className="text-[11.5px] text-ink-soft">
              across {WORKFLOW.participants.length - 1} allocations
            </div>
          </MetaGroup>
        </div>

        {/* Stage tracker */}
        <div className="mt-6 border-t border-border pt-5">
          <StageTracker stage={stage} onSelect={go} />
        </div>
      </header>

      {/* Stage body */}
      <div key={stage} className="animate-fade-up">
        {stage === "agreement" && (
          <StageAgreement
            onImportComplete={(snapshot) => {
              setImportSnapshot(snapshot);
              setImportError(null);
              go("extraction");
            }}
            onExtractFailed={setImportError}
          />
        )}
        {stage === "extraction" && (
          <StageExtraction
            snapshot={importSnapshot}
            importError={importError}
            onRetry={() => go("agreement")}
            onNext={next}
          />
        )}
        {stage === "review" && (
          <StageReview
            snapshot={importSnapshot}
            onRetry={() => go("agreement")}
            onNext={next}
          />
        )}
        {stage === "approvals" && (
          <StageApprovals
            snapshot={importSnapshot}
            onRetry={() => go("agreement")}
            onNext={next}
          />
        )}
        {stage === "collection" && (
          <StageCollection snapshot={importSnapshot} onNext={next} />
        )}
        {stage === "settlement" && (
          <StageSettlement snapshot={importSnapshot} onNext={next} />
        )}
        {stage === "complete" && (
          <StageComplete
            onReset={() => {
              setImportSnapshot(null);
              setImportError(null);
              go("agreement");
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header helpers
// ─────────────────────────────────────────────────────────────────────────────

function StatusPill({ stage }: { stage: StageKey }) {
  const map: Record<StageKey, { label: string; tone: "primary" | "amber" | "emerald" }> = {
    agreement: { label: "Awaiting agreement", tone: "amber" },
    extraction: { label: "AI extracting", tone: "primary" },
    review: { label: "Ready for review", tone: "primary" },
    approvals: { label: "Awaiting approvals", tone: "amber" },
    collection: { label: "Collecting funds", tone: "primary" },
    settlement: { label: "Settling", tone: "primary" },
    complete: { label: "Complete", tone: "emerald" },
  };
  const s = map[stage];
  const tone =
    s.tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : s.tone === "amber"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      : "border-primary/30 bg-accent text-accent-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${tone}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

function MetaGroup({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-soft">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function StageTracker({
  stage,
  onSelect,
}: {
  stage: StageKey;
  onSelect: (key: StageKey) => void;
}) {
  const currentIndex = WORKFLOW.stages.findIndex((s) => s.key === stage);
  return (
    <div className="relative">
      <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:gap-2">
        {WORKFLOW.stages.map((s, i) => {
          const Icon = s.icon;
          const status: "done" | "current" | "upcoming" =
            i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming";
          return (
            <div key={s.key} className="flex flex-1 items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => onSelect(s.key)}
                className="group flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-secondary/60"
              >
                <div
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors ${
                    status === "done"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : status === "current"
                      ? "bg-gradient-purple text-primary-foreground shadow-glow"
                      : "bg-secondary text-ink-soft"
                  }`}
                >
                  {status === "done" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-ink-soft">
                    Stage {i + 1}
                  </div>
                  <div
                    className={`truncate text-[12.5px] font-semibold ${
                      status === "current" ? "text-foreground" : "text-ink-soft"
                    }`}
                  >
                    {s.label}
                  </div>
                </div>
              </button>
              {i < WORKFLOW.stages.length - 1 && (
                <div
                  className={`hidden h-px flex-1 sm:block ${
                    i < currentIndex ? "bg-emerald-500/40" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1 — Agreement
// ─────────────────────────────────────────────────────────────────────────────

const INTAKE = [
  {
    icon: Upload,
    label: "Upload PDF",
    detail: "Drop a signed agreement",
    kind: "PDF",
    sourceType: "other" as SourceType,
  },
  {
    icon: FileText,
    label: "Drag & drop",
    detail: "Contract, MSA or SOW",
    kind: "File",
    sourceType: "other" as SourceType,
  },
  {
    icon: Mail,
    label: "Paste from email",
    detail: "Forward or paste thread",
    kind: "Email",
    sourceType: "email" as SourceType,
  },
  {
    icon: MessageSquare,
    label: "Paste WhatsApp",
    detail: "Conversation transcript",
    kind: "Chat",
    sourceType: "whatsapp" as SourceType,
  },
  {
    icon: Cloud,
    label: "Import from cloud",
    detail: "Drive · Dropbox · SharePoint",
    kind: "Cloud",
    sourceType: "other" as SourceType,
  },
];

function StageAgreement({
  onImportComplete,
  onExtractFailed,
}: {
  onImportComplete: (snapshot: WorkflowImportSnapshot) => void;
  onExtractFailed: (error: string) => void;
}) {
  const { isAllowed, loading: entitlementsLoading } = useEntitlements();
  const aiImportAllowed = entitlementsLoading || isAllowed("ai_import");

  const [selected, setSelected] = useState<string | null>("Upload PDF");
  const [inputOpen, setInputOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [sourceType, setSourceType] = useState<SourceType>("other");
  const [rawConversationText, setRawConversationText] = useState("");

  const selectedIntake = INTAKE.find((item) => item.label === selected);
  const defaultSourceType = selectedIntake?.sourceType;

  const handleExtracted = useCallback(
    (result: ExtractionResult, st: SourceType, rawText: string) => {
      setExtractionResult(result);
      setSourceType(st);
      setRawConversationText(rawText);
      setReviewOpen(true);
    },
    []
  );

  const handleImportComplete = useCallback(
    (dealId?: string) => {
      if (!dealId || !extractionResult) return;
      onImportComplete({
        result: extractionResult,
        dealId,
        dealName:
          extractionResult.projectName.value?.trim() ||
          extractionResult.counterparty.value?.trim() ||
          "Imported agreement",
        sourceType,
        rawConversationText,
      });
    },
    [extractionResult, sourceType, rawConversationText, onImportComplete]
  );

  const openImport = () => {
    if (!aiImportAllowed || !selectedIntake) return;
    setInputOpen(true);
  };

  const intakeStatusTitle = selectedIntake?.label ?? "Choose a source";
  const intakeStatusDetail = selectedIntake
    ? `${SOURCE_TYPE_LABELS[selectedIntake.sourceType]} · Paste your commercial context to continue`
    : "Select how you want to bring your agreement into Provvy";

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <SectionCard
            eyebrow="Stage 1"
            title="Bring your agreement into Provvy"
            description="Provvy accepts commercial context from anywhere. Documents, threads and chats all become structured commercial data."
          >
            <StarterLimitAlert feature="ai_import" className="mb-4" />

            <div className="grid gap-2.5 sm:grid-cols-2">
              {INTAKE.map((i) => {
                const Icon = i.icon;
                const active = selected === i.label;
                return (
                  <button
                    key={i.label}
                    type="button"
                    onClick={() => setSelected(i.label)}
                    className={`group flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                      active
                        ? "border-primary/40 bg-accent shadow-glow"
                        : "border-border bg-background hover:border-primary/30 hover:bg-accent/50"
                    }`}
                  >
                    <div
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                        active
                          ? "bg-gradient-purple text-primary-foreground"
                          : "bg-secondary text-foreground group-hover:text-primary"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold">{i.label}</div>
                      <div className="mt-0.5 text-[12px] text-ink-soft">{i.detail}</div>
                    </div>
                    <span className="text-[10.5px] font-medium uppercase tracking-wider text-ink-soft">
                      {i.kind}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-xl border border-dashed border-primary/30 bg-accent/40 p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-card text-primary shadow-card">
                  <FileText className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-[13.5px] font-semibold">
                    {intakeStatusTitle}
                  </div>
                  <div className="text-[11.5px] text-ink-soft">{intakeStatusDetail}</div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                End-to-end encrypted · Never used for model training
              </div>
              <PrimaryButton
                onClick={openImport}
                disabled={!aiImportAllowed || !selectedIntake}
                icon={Brain}
              >
                Analyse Agreement
              </PrimaryButton>
            </div>
          </SectionCard>
        </div>

        <AISidePanel
          title="Provvy AI is standing by"
          lines={[
            "Ready to read the agreement",
            "Will extract parties, terms and payment obligations",
            "Will flag risks and missing detail",
          ]}
        />
      </div>

      <ConversationInputModal
        open={inputOpen}
        onOpenChange={setInputOpen}
        entryPoint="project_create"
        defaultSourceType={defaultSourceType}
        onExtracted={handleExtracted}
        onExtractFailed={onExtractFailed}
      />

      {extractionResult && (
        <ExtractionReviewModal
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          result={extractionResult}
          entryPoint="project_create"
          sourceType={sourceType}
          rawConversationText={rawConversationText}
          onComplete={handleImportComplete}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2 — AI Extraction
// ─────────────────────────────────────────────────────────────────────────────

const READINESS_DIMENSION_ICONS: Record<ReadinessDimension, LucideIcon> = {
  identity: Users,
  commercialTerms: Coins,
  deliverables: Flag,
  settlementLogic: CreditCard,
  paymentInfrastructure: ShieldCheck,
  taxInformation: Percent,
  compliance: AlertTriangle,
};

type WorkflowExtractionRow = {
  icon: LucideIcon;
  label: string;
  value: string;
  confidenceScore: number;
};

function buildWorkflowExtractionRows(result: ExtractionResult): WorkflowExtractionRow[] {
  const readiness = result.readinessAssessment ?? buildExtractionReadiness(result);
  const rows: WorkflowExtractionRow[] = readiness.dimensions.map((dimension) => ({
    icon: READINESS_DIMENSION_ICONS[dimension.dimension],
    label: dimension.label,
    value:
      dimension.blockers.length > 0
        ? `${dimension.score}% · ${dimension.blockers.length} gap${dimension.blockers.length === 1 ? "" : "s"}`
        : `${dimension.score}% complete`,
    confidenceScore: dimension.score,
  }));

  if (result.uncertainties.length > 0) {
    rows.push({
      icon: AlertTriangle,
      label: "Ambiguities",
      value: `${result.uncertainties.length} flagged for review`,
      confidenceScore: Math.max(0, 100 - result.uncertainties.length * 8),
    });
  }

  return rows;
}

function StageExtraction({
  snapshot,
  importError,
  onRetry,
  onNext,
}: {
  snapshot: WorkflowImportSnapshot | null;
  importError: string | null;
  onRetry: () => void;
  onNext: () => void;
}) {
  const rows = snapshot ? buildWorkflowExtractionRows(snapshot.result) : [];
  const readiness =
    snapshot?.result.readinessAssessment ??
    (snapshot ? buildExtractionReadiness(snapshot.result) : null);
  const summary = snapshot ? buildExtractionSummary(snapshot.result) : null;
  const [revealedCount, setRevealedCount] = useState(0);
  const [autoAdvanceSeconds, setAutoAdvanceSeconds] = useState(2);
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  useEffect(() => {
    if (!snapshot) return;
    setRevealedCount(rows.length);
  }, [snapshot, rows.length]);

  useEffect(() => {
    if (!snapshot || revealedCount < rows.length) return;
    setAutoAdvanceSeconds(2);
    const interval = setInterval(() => {
      setAutoAdvanceSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    const timeout = setTimeout(() => onNextRef.current(), 2000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [snapshot, revealedCount, rows.length]);

  if (!snapshot) {
    return (
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard
            eyebrow="Stage 2"
            title="Extracting commercial intelligence"
            description="Import an agreement in Stage 1 to run AI extraction."
          >
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
              {importError ??
                "No extraction result is available yet. Complete Stage 1 or retry the import flow."}
            </div>
            <div className="mt-6">
              <SecondaryButton onClick={onRetry} icon={RefreshCw}>
                Retry import
              </SecondaryButton>
            </div>
          </SectionCard>
        </div>
        <AISidePanel
          title={importError ? "Extraction failed" : "Extraction unavailable"}
          lines={
            importError
              ? [
                  importError,
                  "Return to Stage 1 to retry with the existing import flow",
                  "No duplicate extraction logic is run from this screen",
                ]
              : [
                  "Stage 1 must finish importing your agreement",
                  "Use the existing conversation import flow to extract commercial data",
                  "Then return here to review the structured output",
                ]
          }
        />
      </div>
    );
  }

  const done = revealedCount >= rows.length;
  const progress = rows.length > 0 ? Math.min(100, Math.round((revealedCount / rows.length) * 100)) : 100;
  const sourcePreview = snapshot.rawConversationText.trim().slice(0, 480);
  const sourceLines = sourcePreview.split(/\n/).slice(0, 12);

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Source conversation
          </div>
          <div className="mt-3 aspect-[3/4] w-full overflow-hidden rounded-xl border border-border bg-background">
            <div className="relative h-full w-full p-4">
              <div className="space-y-1.5">
                {sourceLines.map((line, index) => (
                  <div
                    key={`${index}-${line.slice(0, 12)}`}
                    className={`h-1.5 rounded bg-secondary/70 ${
                      line.trim().length === 0 ? "w-1/3 opacity-40" : "w-full"
                    }`}
                  />
                ))}
              </div>
              {done && (
                <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  Extraction complete
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 space-y-1 text-[12px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-ink-soft">Project</span>
              <span className="truncate font-medium">{snapshot.dealName}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-ink-soft">Source</span>
              <span className="font-medium">{SOURCE_TYPE_LABELS[snapshot.sourceType]}</span>
            </div>
            {readiness && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-ink-soft">Readiness</span>
                <span className="font-medium">{readiness.score}%</span>
              </div>
            )}
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-gradient-purple transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="lg:col-span-3">
        <SectionCard
          eyebrow="Stage 2"
          title="Extracting commercial intelligence"
          description="Provvy AI reads the agreement and turns unstructured text into structured commercial data."
          headerRight={
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-foreground">
              {done ? (
                <>
                  <BadgeCheck className="h-3 w-3" /> Extraction complete
                </>
              ) : (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Analysing…
                </>
              )}
            </span>
          }
        >
          {readiness && (
            <div className="mb-4 rounded-xl border border-border bg-background/70 p-4">
              <div className="text-[12.5px] font-semibold">
                Settlement readiness: {readiness.score}%
              </div>
              <div className="mt-1 text-[12px] text-ink-soft">{readiness.summary}</div>
              {summary?.oneLiner && (
                <div className="mt-2 text-[12px] italic text-foreground/80">
                  &ldquo;{summary.oneLiner}&rdquo;
                </div>
              )}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {rows.map((row, index) => {
              const revealed = index < revealedCount;
              const Icon = row.icon;
              return (
                <div
                  key={row.label}
                  className={`flex items-start gap-3 rounded-xl border p-3 transition-all ${
                    revealed
                      ? "border-border bg-background"
                      : "border-dashed border-border bg-secondary/40 opacity-60"
                  }`}
                >
                  <div
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                      revealed
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-ink-soft"
                    }`}
                  >
                    {revealed ? (
                      <Icon className="h-3.5 w-3.5" />
                    ) : (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[12.5px] font-semibold">{row.label}</div>
                      {revealed && <Confidence value={row.confidenceScore} />}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-ink-soft">
                      {revealed ? row.value : "Analysing…"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] text-ink-soft">
              {done
                ? `All commercial data extracted. Continuing to review in ${autoAdvanceSeconds}s…`
                : "Extracting commercial data — this typically takes seconds."}
            </div>
            <PrimaryButton onClick={onNext} disabled={!done} icon={Eye}>
              Continue to Review
            </PrimaryButton>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function Confidence({ value }: { value: number }) {
  const tone =
    value >= 95
      ? "text-emerald-600 dark:text-emerald-400"
      : value >= 90
      ? "text-primary"
      : "text-amber-600 dark:text-amber-400";
  return (
    <span className={`inline-flex items-center gap-1 text-[10.5px] font-medium ${tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {value}%
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 3 — Review
// ─────────────────────────────────────────────────────────────────────────────

function dealFromSnapshot(snapshot: WorkflowImportSnapshot): RecentDeal {
  const currency = snapshot.result.currency.value;
  return {
    id: snapshot.dealId,
    dealName: snapshot.dealName,
    partner: snapshot.dealName,
    value: snapshot.result.projectValue.value ?? 0,
    introducer: "",
    closer: "",
    status: "Pending",
    lastUpdated: new Date().toISOString(),
    paymentStatus: "Not Paid",
    projectValueCurrency: currency === "USD" ? "USD" : "AUD",
  };
}

function collectReviewBlockers(insight: AgreementIntelligenceInsight): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const blocker of insight.groupedBlockers ?? []) {
    const key = blocker.description.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      items.push(blocker.description);
    }
  }
  for (const blocker of insight.settlementBlockers ?? []) {
    const key = blocker.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      items.push(blocker);
    }
  }
  for (const gap of insight.potentialGaps) {
    const key = gap.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      items.push(gap);
    }
  }

  return items;
}

function readinessScoreForDimension(
  result: ExtractionResult,
  dimension: ReadinessDimension
): number {
  const readiness = result.readinessAssessment ?? buildExtractionReadiness(result);
  return readiness.dimensions.find((entry) => entry.dimension === dimension)?.score ?? readiness.score;
}

function useWorkflowReviewInsight(snapshot: WorkflowImportSnapshot | null) {
  const [insight, setInsight] = useState<AgreementIntelligenceInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!snapshot) {
      setInsight(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const data = await fetchPilotSnapshot();
        if (cancelled) return;

        const persisted = (data?.participants ?? []).filter(
          (participant) => participant.dealId === snapshot.dealId
        );

        const drafts: OnboardingDraftParticipant[] =
          persisted.length > 0
            ? persisted.map(mapDemoParticipantToOnboardingDraft)
            : onboardingDraftsFromExtraction(
                snapshot.result,
                dealFromSnapshot(snapshot),
                snapshot.sourceType,
                snapshot.result.currency.value
              );

        setInsight(buildInsightsFromExtraction(snapshot.result, drafts));
      } catch {
        if (!cancelled) {
          setError("Could not load agreement review data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [snapshot]);

  return { insight, loading, error };
}

function StageReview({
  snapshot,
  onRetry,
  onNext,
}: {
  snapshot: WorkflowImportSnapshot | null;
  onRetry: () => void;
  onNext: () => void;
}) {
  const { insight, loading, error } = useWorkflowReviewInsight(snapshot);

  if (!snapshot) {
    return (
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard
            eyebrow="Stage 3"
            title="Review the commercial understanding"
            description="Complete Stages 1 and 2 before reviewing the imported agreement."
          >
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
              No imported agreement is available for review yet.
            </div>
            <div className="mt-6">
              <SecondaryButton onClick={onRetry} icon={RefreshCw}>
                Back to import
              </SecondaryButton>
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  if (loading || !insight) {
    return (
      <div className="flex items-center justify-center py-20 text-ink-soft">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading agreement review…
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard
            eyebrow="Stage 3"
            title="Review the commercial understanding"
            description="Review the persisted agreement before deploying the workflow."
          >
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
              {error}
            </div>
            <div className="mt-6">
              <SecondaryButton onClick={onRetry} icon={RefreshCw}>
                Retry import
              </SecondaryButton>
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  const result = snapshot.result;
  const readiness = result.readinessAssessment ?? buildExtractionReadiness(result);
  const scheduleGroups = buildSettlementSchedule(result);
  const scheduleRows = scheduleGroups.flatMap((group) =>
    group.lines.map((line) => ({
      key: `${group.partyId}-${line.label}-${line.value}`,
      date: line.status === "conditional" ? "Conditional" : "Scheduled",
      milestone: `${group.partyName} · ${line.label}`,
      amount: line.value,
    }))
  );
  const reviewBlockers = collectReviewBlockers(insight);
  const currencyPrefix =
    result.currency.value === "USD"
      ? "US$"
      : result.currency.value === "AUD"
        ? "A$"
        : `${result.currency.value ?? ""} `;
  const projectValue = result.projectValue.value ?? 0;
  const revenueRows = insight.revenueShareSummary.map((row) => ({
    key: row.participantId,
    name: row.participantName,
    pct: row.percentage,
    amount: Math.round(projectValue * (row.percentage / 100)),
    color: "from-primary to-purple-500",
  }));
  const aiNotes = [
    insight.readinessExplanation,
    ...result.uncertainties.slice(0, 3).map((item) => item.issue),
    ...insight.potentialGaps.slice(0, 2),
  ].filter(Boolean);

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-5">
        <SectionCard
          eyebrow="Stage 3"
          title="Review the commercial understanding"
          description="Everything below reflects your imported agreement. Confirm the extracted commercial data before deploying the workflow."
        >
          <ReviewBlock
            title="Participants"
            confidence={readinessScoreForDimension(result, "identity")}
            icon={Users}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {insight.participantsFound.map((participant) => (
                <div
                  key={participant.name}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
                >
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-[11px] font-semibold">
                    {participant.name
                      .split(" ")
                      .map((word) => word[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <ReviewText value={participant.name} className="text-[13px] font-medium" />
                    <div className="text-[11.5px] text-ink-soft">
                      {participant.role ?? "Participant"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ReviewBlock>

          <ReviewBlock
            title="Commercial obligations"
            confidence={readinessScoreForDimension(result, "deliverables")}
            icon={ShieldCheck}
          >
            <ul className="space-y-2">
              {insight.obligationsIdentified.length > 0 ? (
                insight.obligationsIdentified.map((obligation) => (
                  <li
                    key={obligation}
                    className="flex items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
                  >
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <ReviewText value={obligation} className="flex-1" />
                  </li>
                ))
              ) : (
                <li className="rounded-lg border border-dashed border-border bg-background px-3 py-2 text-[13px] text-ink-soft">
                  No operational obligations were extracted.
                </li>
              )}
            </ul>
          </ReviewBlock>

          <ReviewBlock
            title="Payment schedule"
            confidence={readinessScoreForDimension(result, "settlementLogic")}
            icon={Calendar}
          >
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-[12.5px]">
                <thead className="bg-secondary/60 text-ink-soft">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-left font-medium">Milestone</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleRows.length > 0 ? (
                    scheduleRows.map((row) => (
                      <tr key={row.key} className="border-t border-border">
                        <td className="px-3 py-2">{row.date}</td>
                        <td className="px-3 py-2">
                          <ReviewText value={row.milestone} />
                        </td>
                        <td className="px-3 py-2 text-right font-medium">{row.amount}</td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-t border-border">
                      <td colSpan={3} className="px-3 py-3 text-ink-soft">
                        No settlement events were extracted.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ReviewBlock>

          <ReviewBlock
            title="Revenue allocation"
            confidence={readinessScoreForDimension(result, "commercialTerms")}
            icon={Percent}
          >
            <div className="space-y-2">
              {revenueRows.length > 0 ? (
                revenueRows.map((row) => (
                  <div key={row.key} className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="font-medium">{row.name}</span>
                      <span className="text-ink-soft">
                        <span className="font-semibold text-foreground">
                          {currencyPrefix}
                          {row.amount.toLocaleString()}
                        </span>{" "}
                        · {row.pct}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full bg-gradient-to-r ${row.color}`}
                        style={{ width: `${Math.max(row.pct, 4)}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-background px-3 py-2 text-[13px] text-ink-soft">
                  {insight.commercialTermsFound.length > 0
                    ? insight.commercialTermsFound.join(" · ")
                    : "No revenue allocation terms were extracted."}
                </div>
              )}
            </div>
          </ReviewBlock>

          <ReviewBlock
            title="Approval requirements"
            confidence={readinessScoreForDimension(result, "compliance")}
            icon={UserRoundCheck}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {reviewBlockers.length > 0 ? (
                reviewBlockers.map((blocker) => (
                  <div
                    key={blocker}
                    className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
                  >
                    <Circle className="mt-0.5 h-3 w-3 shrink-0 text-ink-soft" />
                    <ReviewText value={blocker} />
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-background px-3 py-2 text-[13px] text-ink-soft sm:col-span-2">
                  No outstanding approval blockers were identified.
                </div>
              )}
            </div>
          </ReviewBlock>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <div className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Settlement readiness {readiness.score}% · {insight.agreementName}
            </div>
            <PrimaryButton onClick={onNext} icon={UserRoundCheck}>
              Approve Workflow
            </PrimaryButton>
          </div>
        </SectionCard>
      </div>

      <AISidePanel
        title="Provvy AI notes"
        lines={
          aiNotes.length > 0
            ? aiNotes.slice(0, 4)
            : ["Review the extracted commercial terms before sending approvals."]
        }
      />
    </div>
  );
}

function ReviewBlock({
  title,
  icon: Icon,
  confidence,
  children,
}: {
  title: string;
  icon: LucideIcon;
  confidence: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 text-[12.5px] font-semibold">
          <Icon className="h-3.5 w-3.5 text-primary" />
          {title}
        </div>
        <Confidence value={confidence} />
      </div>
      {children}
    </div>
  );
}

function ReviewText({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <span className={`inline-block max-w-full px-1 -mx-1 ${className || ""}`}>
      {value}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 4 — Approvals
// ─────────────────────────────────────────────────────────────────────────────

type LovableApprovalStatus = "approved" | "pending" | "waiting";

function mapLovableApprovalStatus(participant: DemoParticipant): LovableApprovalStatus {
  const workflow = deriveParticipantOperationalWorkflow(participant);
  if (workflow.stage === "AGREEMENT_SENT") return "pending";
  if (workflow.stage === "DRAFT" || workflow.stage === "EARNINGS_CONFIGURED") {
    return "waiting";
  }
  return "approved";
}

function deriveParticipantLastActivity(participant: DemoParticipant): string | null {
  const now = Date.now();

  function ago(iso: string | undefined): string | null {
    if (!iso) return null;
    const diff = now - new Date(iso).getTime();
    const minutes = Math.round(diff / 60_000);
    if (minutes < 2) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(diff / 3_600_000);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(diff / 86_400_000);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  if (participant.approvedAt) return `Approved ${ago(participant.approvedAt) ?? ""}`.trim();
  if (participant.agreementViewedAt) return `Opened ${ago(participant.agreementViewedAt) ?? ""}`.trim();
  if (participant.agreementSharedAt) return `Sent ${ago(participant.agreementSharedAt) ?? ""}`.trim();
  if (participant.inviteSentAt) return `Invited ${ago(participant.inviteSentAt) ?? ""}`.trim();
  return null;
}

function deriveApprovalGuidance(participants: DemoParticipant[]): string {
  const stats = deriveApprovalStats(participants);
  if (stats.pending === 0) {
    return "All parties have approved. Ready to collect funds.";
  }
  if (stats.notSent > 0 && stats.waiting === 0) {
    return stats.notSent === 1
      ? "One participant still needs the agreement sent."
      : `${stats.notSent} participants still need the agreement sent.`;
  }
  if (stats.waiting > 0 && stats.notSent === 0) {
    const waitingNames = participants
      .filter((participant) => mapLovableApprovalStatus(participant) === "pending")
      .map((participant) => participant.name);
    if (waitingNames.length === 1) {
      return `Reminders sent · Awaiting ${waitingNames[0]}`;
    }
    return `${stats.waiting} participant${stats.waiting === 1 ? "" : "s"} still to approve.`;
  }
  return `${stats.pending} acceptance${stats.pending === 1 ? "" : "s"} outstanding.`;
}

function useWorkflowApprovals(dealId: string | undefined) {
  const [participants, setParticipants] = useState<DemoParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sentBatch, setSentBatch] = useState(false);

  const reload = useCallback(async () => {
    if (!dealId) {
      setParticipants([]);
      setLoading(false);
      return;
    }
    const data = await fetchPilotSnapshot();
    setParticipants((data?.participants ?? []).filter((participant) => participant.dealId === dealId));
    setLoading(false);
  }, [dealId]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!dealId) return;
    const interval = window.setInterval(() => {
      void reload();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [dealId, reload]);

  const stats = deriveApprovalStats(participants);
  const approvalsComplete = stats.total > 0 && stats.pending === 0;

  const requestRemainingApprovals = useCallback(async () => {
    if (participants.length === 0) return;
    setSending(true);
    try {
      let sentCount = 0;
      for (const participant of participants) {
        const workflow = deriveParticipantOperationalWorkflow(participant);
        if (
          workflow.stage === "DRAFT" ||
          workflow.stage === "EARNINGS_CONFIGURED" ||
          workflow.stage === "AGREEMENT_SENT"
        ) {
          await persistParticipantAgreementShare(participant);
          sentCount += 1;
        }
      }
      await reload();
      setSentBatch(true);
      toast.success(
        sentCount > 0 ? "Participant workspace invitations sent" : "Approval requests are up to date"
      );

      if (isHackathonJourneyEnabled() && dealId) {
        const snapshot = await fetchPilotSnapshot();
        const dealParticipants = (snapshot?.participants ?? []).filter(
          (participant) => participant.dealId === dealId,
        );
        void simulateExternalParticipantApprovals(dealParticipants)
          .then((result) => {
            if (result.errors.length > 0) {
              console.warn("[development approval simulator]", result);
            }
            void reload();
          })
          .catch((error) => {
            console.warn("[development approval simulator] failed", error);
          });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send approval requests");
    } finally {
      setSending(false);
    }
  }, [dealId, participants, reload]);

  const copyInviteLink = useCallback(async (participant: DemoParticipant) => {
    const url = buildParticipantWorkspaceUrlForParticipant(participant);
    if (!url) {
      const shared = await persistParticipantAgreementShare(participant);
      const nextUrl = buildParticipantWorkspaceUrlForParticipant(shared);
      if (!nextUrl) {
        toast.error("Could not resolve participant workspace link");
        return;
      }
      await navigator.clipboard.writeText(nextUrl);
      await reload();
      toast.success("Workspace link copied");
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success("Workspace link copied");
  }, [reload]);

  return {
    participants,
    loading,
    sending,
    sentBatch,
    stats,
    approvalsComplete,
    reload,
    requestRemainingApprovals,
    copyInviteLink,
  };
}

function StageApprovals({
  snapshot,
  onRetry,
  onNext,
}: {
  snapshot: WorkflowImportSnapshot | null;
  onRetry: () => void;
  onNext: () => void;
}) {
  const {
    participants,
    loading,
    sending,
    sentBatch,
    stats,
    approvalsComplete,
    requestRemainingApprovals,
    copyInviteLink,
  } = useWorkflowApprovals(snapshot?.dealId);

  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  useEffect(() => {
    if (!approvalsComplete) return;
    const timeout = window.setTimeout(() => onNextRef.current(), 1500);
    return () => window.clearTimeout(timeout);
  }, [approvalsComplete]);

  if (!snapshot) {
    return (
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard
            eyebrow="Stage 4"
            title="Participants approve the workflow"
            description="Complete the earlier stages before collecting participant approvals."
          >
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
              No imported agreement is available for approvals yet.
            </div>
            <div className="mt-6">
              <SecondaryButton onClick={onRetry} icon={RefreshCw}>
                Back to import
              </SecondaryButton>
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-ink-soft">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading participant approvals…
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard
            eyebrow="Stage 4"
            title="Participants approve the workflow"
            description="Provvy routes the workflow to each party. Approvals are captured, timestamped and reflected in the timeline."
          >
            <div className="rounded-xl border border-dashed border-border bg-background px-4 py-3 text-[13px] text-ink-soft">
              No participants were found for this agreement yet.
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  const guidance = deriveApprovalGuidance(participants);
  const progressPct = stats.percentage;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <SectionCard
          eyebrow="Stage 4"
          title="Participants approve the workflow"
          description="Provvy routes the workflow to each party. Approvals are captured, timestamped and reflected in the timeline."
          headerRight={
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground">
              {stats.approved} / {stats.total} approved
            </span>
          }
        >
          <div className="space-y-2.5">
            {participants.map((participant) => {
              const status = mapLovableApprovalStatus(participant);
              const lastActivity = deriveParticipantLastActivity(participant);
              return (
                <div
                  key={participant.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background px-3.5 py-3"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-[11.5px] font-semibold">
                    {participant.name
                      .split(" ")
                      .map((word) => word[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold">{participant.name}</div>
                    <div className="text-[11.5px] text-ink-soft">
                      {operationalRoleLabel(participant)}
                      {lastActivity ? ` · ${lastActivity}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyInviteLink(participant)}
                    className="hidden shrink-0 rounded-md border border-border px-2 py-1 text-[10.5px] font-medium text-ink-soft transition-colors hover:bg-accent sm:inline-flex"
                    title="Copy participant workspace link"
                  >
                    Copy link
                  </button>
                  <ApprovalPill status={status} />
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-gradient-purple transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-[12px] font-medium text-ink-soft">{progressPct}%</span>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] text-ink-soft">
              {approvalsComplete
                ? "All parties have approved. Continuing to payment…"
                : guidance}
            </div>
            {approvalsComplete ? (
              <PrimaryButton onClick={onNext} icon={CreditCard}>
                Continue to Payment
              </PrimaryButton>
            ) : (
              <SecondaryButton
                onClick={() => void requestRemainingApprovals()}
                icon={Send}
                disabled={sending}
              >
                {sending ? "Sending…" : sentBatch ? "Reminder sent" : "Request Remaining Approvals"}
              </SecondaryButton>
            )}
          </div>
        </SectionCard>
      </div>

      <AISidePanel
        title="What Provvy is doing"
        lines={[
          "Routing to each party via participant workspace links",
          "Tracking agreement acceptance through the production approval engine",
          "Recording approvals in the Commercial Timeline",
          approvalsComplete
            ? "All required participants have approved this agreement"
            : "Notifying you the moment funds can be collected",
        ]}
      />
    </div>
  );
}

function ApprovalPill({ status }: { status: "approved" | "pending" | "waiting" }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
        <Check className="h-3 w-3" /> Approved
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
        <Loader2 className="h-3 w-3 animate-spin" /> Awaiting
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-ink-soft">
      <Clock className="h-3 w-3" /> Queued
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 5 — Payment Collection (Pinch)
// ─────────────────────────────────────────────────────────────────────────────

type PinchCollectionStep = "idle" | "capture" | "source" | "payment" | "complete" | "failed";

function deriveWorkflowCollectionAmount(snapshot: WorkflowImportSnapshot | null): number {
  const extracted = snapshot?.result.projectValue.value;
  if (typeof extracted === "number" && extracted > 0) {
    return extracted;
  }
  return WORKFLOW.amount;
}

function deriveWorkflowCollectionCurrency(snapshot: WorkflowImportSnapshot | null): string {
  const extracted = snapshot?.result.currency.value?.trim();
  if (extracted) {
    return extracted === "AUD" ? "A$" : extracted;
  }
  return WORKFLOW.currency;
}

function deriveWorkflowCollectionPurpose(snapshot: WorkflowImportSnapshot): string {
  return deriveDemoClientPaymentPurpose(snapshot.dealName);
}

function StageCollectionDemo({
  snapshot,
  onNext,
}: {
  snapshot: WorkflowImportSnapshot;
  onNext: () => void;
}) {
  const [demoStep, setDemoStep] = useState<DemoClientPaymentStep | null>(null);
  const [busy, setBusy] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [payment, setPayment] = useState<PinchCreatePaymentResponse | null>(null);

  const amount = deriveWorkflowCollectionAmount(snapshot);
  const currencyPrefix = deriveWorkflowCollectionCurrency(snapshot);
  const amountCents = Math.max(1, Math.round(amount * 100));
  const clientLabel = snapshot.dealName?.trim() || "Project client";
  const paymentPurpose = deriveWorkflowCollectionPurpose(snapshot);
  const collectionComplete =
    payment !== null && isPinchPaymentSuccessful(payment.status);
  const demoStatus = deriveDemoClientPaymentStatus({
    busy,
    demoStep,
    complete: collectionComplete,
  });
  const requestCreated = demoStep === "request" || demoStep === "received" || demoStep === "reconciled" || collectionComplete;
  const paymentReceived =
    demoStep === "received" || demoStep === "reconciled" || collectionComplete;
  const fundsReconciled = demoStep === "reconciled" || collectionComplete;

  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  useEffect(() => {
    if (!collectionComplete) return;
    const timeout = window.setTimeout(() => onNextRef.current(), 2000);
    return () => window.clearTimeout(timeout);
  }, [collectionComplete]);

  const handleSimulateClientPayment = async () => {
    if (busy || collectionComplete) return;

    setBusy(true);
    setFlowError(null);
    setDemoStep(null);
    setPayment(null);

    const description = `Provvy workflow collection · ${snapshot.dealName}`;

    try {
      const result = await simulateDemoClientPayment({
        amountCents,
        description,
        payerLabel: clientLabel,
        onDemoStep: setDemoStep,
      });
      setPayment(result.payment);
    } catch (error) {
      setFlowError(error instanceof Error ? error.message : "Client payment simulation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <SectionCard
          eyebrow="Stage 5"
          title="Collect Client Funds"
          description="Pinch securely collects the agreed project funds from the client before settlement can begin."
        >
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-accent/60 to-transparent p-5 shadow-glow">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                  Client payment amount
                </div>
                <div className="mt-1 text-3xl font-semibold tracking-[-0.02em]">
                  {currencyPrefix}
                  {amount.toLocaleString()}
                </div>
                <div className="mt-1 text-[12px] text-ink-soft">
                  From {clientLabel}
                  {snapshot.dealId ? ` · Ref ${snapshot.dealId.slice(0, 8).toUpperCase()}` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                  Payment rail
                </div>
                <div className="mt-1 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5">
                  <div className="grid h-6 w-6 place-items-center rounded-md bg-gradient-purple text-[10px] font-bold text-primary-foreground">
                    P
                  </div>
                  <div className="text-[12.5px] font-semibold">Pinch Payments</div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <MiniStat label="Client" value={clientLabel} />
              <MiniStat label="Payment purpose" value={paymentPurpose} />
              <MiniStat label="Demo status" value={demoStatus} />
            </div>
          </div>

          {flowError && (
            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[12.5px] text-destructive">
              {flowError}
            </div>
          )}

          <div className="mt-5 space-y-2.5">
            <FlowLine
              icon={CreditCard}
              label="Payment request created"
              active={busy && demoStep === "request"}
              done={requestCreated}
            />
            <FlowLine
              icon={Check}
              label="Client payment received"
              active={busy && demoStep === "received"}
              done={paymentReceived}
            />
            <FlowLine
              icon={Activity}
              label="Funds reconciled"
              active={busy && demoStep === "reconciled"}
              done={fundsReconciled}
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Demo mode · No live bank debits · Production Pinch routes unchanged
            </div>
            {collectionComplete ? (
              <PrimaryButton onClick={onNext} icon={RefreshCw}>
                Continue to Settlement
              </PrimaryButton>
            ) : (
              <PrimaryButton
                onClick={() => void handleSimulateClientPayment()}
                disabled={busy}
                icon={busy ? Loader2 : CreditCard}
                spinIcon={busy}
              >
                {busy ? "Simulating payment…" : "Simulate Client Payment"}
              </PrimaryButton>
            )}
          </div>
        </SectionCard>
      </div>

      <AISidePanel
        title="Why Pinch"
        lines={[
          "Native PayTo & Direct Debit for Australian businesses",
          "Best-in-class for scheduled and recurring collections",
          "Fits inside Provvy's commercial workflow — not a separate checkout",
          "Reconciles directly to Xero via the same workflow",
        ]}
      />
    </div>
  );
}

function StageCollectionSandbox({
  snapshot,
  onNext,
}: {
  snapshot: WorkflowImportSnapshot;
  onNext: () => void;
}) {
  const publishableKey = process.env.NEXT_PUBLIC_PINCH_PUBLISHABLE_KEY ?? "";

  const [captureReady, setCaptureReady] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [payerId, setPayerId] = useState<string | null>(null);
  const [step, setStep] = useState<PinchCollectionStep>("idle");
  const [busy, setBusy] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [source, setSource] = useState<PinchCreateSourceResponse | null>(null);
  const [payment, setPayment] = useState<PinchCreatePaymentResponse | null>(null);

  const amount = deriveWorkflowCollectionAmount(snapshot);
  const currencyPrefix = deriveWorkflowCollectionCurrency(snapshot);
  const amountCents = Math.max(1, Math.round(amount * 100));
  const payerLabel = payment
    ? formatPinchPayerLabel(payment.payer, snapshot.dealName ?? "Payer")
    : snapshot.dealName ?? "Operator settlement account";
  const paymentMethodLabel = formatPinchSourceTypeLabel(
    payment?.sourceType ?? source?.sourceType ?? "bank-account",
  );
  const paymentStatusLabel = payment
    ? formatPinchPaymentStatusLabel(payment.status)
    : step === "failed"
    ? "Failed"
    : busy
    ? "Processing"
    : "Awaiting collection";
  const collectionComplete =
    step === "complete" &&
    payment !== null &&
    isPinchPaymentSuccessful(payment.status);
  const sandboxReady = Boolean(publishableKey.trim() && payerId?.trim());
  const canCollectFunds = !busy && step !== "complete" && captureReady && sandboxReady;

  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  useEffect(() => {
    void fetchPinchDevTestPayerId().then((id) => {
      if (id) setPayerId(id);
    });
  }, []);

  useEffect(() => {
    if (!collectionComplete) return;
    const timeout = window.setTimeout(() => onNextRef.current(), 2000);
    return () => window.clearTimeout(timeout);
  }, [collectionComplete]);

  const handleCollect = async () => {
    if (!canCollectFunds || !payerId) return;

    setBusy(true);
    setFlowError(null);
    setSource(null);
    setPayment(null);
    setStep("capture");

    const description = `Provvy workflow collection · ${snapshot.dealName}`;

    try {
      const result = await runPinchCollectionFlow({
        payerId,
        amountCents,
        publishableKey,
        description,
        onStep: (nextStep) => setStep(nextStep),
      });

      setSource(result.source);
      setPayment(result.payment);
      setStep("complete");
    } catch (error) {
      setStep("failed");
      setFlowError(error instanceof Error ? error.message : "Pinch collection failed");
    } finally {
      setBusy(false);
    }
  };

  const flowActive = step !== "idle";
  const sourceVerified = step === "source" || step === "payment" || step === "complete";
  const paymentRecorded = step === "complete";
  const settlementUnlocked = collectionComplete;

  return (
    <>
      <Script
        src={PINCH_CAPTUREJS_SRC}
        integrity={PINCH_CAPTUREJS_INTEGRITY}
        crossOrigin="anonymous"
        strategy="afterInteractive"
        onLoad={() => setCaptureReady(true)}
        onError={() => setCaptureError("Failed to load Pinch CaptureJS")}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard
            eyebrow="Stage 5"
            title="Collect funds via Pinch Payments"
            description="Pinch is Provvy's execution layer for money movement. This step runs inside the workflow — not as a separate checkout."
          >
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-accent/60 to-transparent p-5 shadow-glow">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                    Amount to collect
                  </div>
                  <div className="mt-1 text-3xl font-semibold tracking-[-0.02em]">
                    {currencyPrefix}
                    {amount.toLocaleString()}
                  </div>
                  <div className="mt-1 text-[12px] text-ink-soft">
                    From {payerLabel}
                    {snapshot.dealId ? ` · Ref ${snapshot.dealId.slice(0, 8).toUpperCase()}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                    Payment rail
                  </div>
                  <div className="mt-1 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5">
                    <div className="grid h-6 w-6 place-items-center rounded-md bg-gradient-purple text-[10px] font-bold text-primary-foreground">
                      P
                    </div>
                    <div className="text-[12.5px] font-semibold">Pinch Payments</div>
                  </div>
                  <div className="mt-1 text-[11px] text-ink-soft">{paymentMethodLabel}</div>
                </div>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <MiniStat label="Payer" value={payerLabel} />
                <MiniStat label="Payment method" value={paymentMethodLabel} />
                <MiniStat label="Status" value={paymentStatusLabel} />
              </div>
            </div>

            {(captureError || flowError || !publishableKey || !payerId) && (
              <div className="mt-4 space-y-2">
                {!publishableKey && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-[12.5px] text-amber-900 dark:text-amber-200">
                    Set <code className="font-mono">NEXT_PUBLIC_PINCH_PUBLISHABLE_KEY</code> in{" "}
                    <code className="font-mono">.env.local</code>.
                  </div>
                )}
                {!payerId && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-[12.5px] text-amber-900 dark:text-amber-200">
                    Set <code className="font-mono">PINCH_TEST_PAYER_ID</code> for the sandbox payer.
                  </div>
                )}
                {captureError && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[12.5px] text-destructive">
                    {captureError}
                  </div>
                )}
                {flowError && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[12.5px] text-destructive">
                    {flowError}
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 space-y-2.5">
              <FlowLine
                icon={CreditCard}
                label="Initiating collection with Pinch"
                active={flowActive && !paymentRecorded}
                done={sourceVerified}
              />
              <FlowLine
                icon={ShieldCheck}
                label="Authorisation verified"
                active={sourceVerified && !paymentRecorded}
                done={paymentRecorded}
              />
              <FlowLine
                icon={Check}
                label="Payment received"
                active={step === "payment" || paymentRecorded}
                done={paymentRecorded}
              />
              <FlowLine
                icon={Activity}
                label="Timeline updated · Settlement unlocked"
                active={settlementUnlocked}
                done={settlementUnlocked}
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Funds move under your operating rules · Provvy never holds money
              </div>
              {collectionComplete ? (
                <PrimaryButton onClick={onNext} icon={RefreshCw}>
                  Continue to Settlement
                </PrimaryButton>
              ) : (
                <PrimaryButton
                  onClick={() => void handleCollect()}
                  disabled={!canCollectFunds}
                  icon={busy ? Loader2 : CreditCard}
                  spinIcon={busy}
                >
                  {busy ? "Collecting…" : captureReady ? "Collect Funds with Pinch" : "Loading Pinch…"}
                </PrimaryButton>
              )}
            </div>
          </SectionCard>
        </div>

        <AISidePanel
          title="Why Pinch"
          lines={[
            "Native PayTo & Direct Debit for Australian businesses",
            "Best-in-class for scheduled and recurring collections",
            "Fits inside Provvy's commercial workflow — not a separate checkout",
            "Reconciles directly to Xero via the same workflow",
          ]}
        />
      </div>
    </>
  );
}

function StageCollection({
  snapshot,
  onNext,
}: {
  snapshot: WorkflowImportSnapshot | null;
  onNext: () => void;
}) {
  const isProductionBuild = process.env.NODE_ENV === "production";
  const hackathonJourneyEnabled = isHackathonJourneyEnabled();

  if (!snapshot) {
    return (
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard
            eyebrow="Stage 5"
            title="Collect funds via Pinch Payments"
            description="Complete the earlier stages before collecting funds."
          >
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
              No imported agreement is available for payment collection yet.
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  if (isProductionBuild && !hackathonJourneyEnabled) {
    return (
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard
            eyebrow="Stage 5"
            title="Collect funds via Pinch Payments"
            description="Pinch collection uses the existing sandbox APIs, which are disabled in production builds."
          >
            <div className="rounded-xl border border-dashed border-border bg-background px-4 py-3 text-[13px] text-ink-soft">
              Payment collection is not available in production until the existing Pinch routes are
              enabled for live use.
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  if (hackathonJourneyEnabled) {
    return <StageCollectionDemo snapshot={snapshot} onNext={onNext} />;
  }

  return <StageCollectionSandbox snapshot={snapshot} onNext={onNext} />;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="text-[10.5px] font-medium uppercase tracking-wider text-ink-soft">
        {label}
      </div>
      <div className="mt-0.5 text-[13px] font-semibold">{value}</div>
    </div>
  );
}

function FlowLine({
  icon: Icon,
  label,
  active,
  done,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 transition-all ${
        done
          ? "border-emerald-500/30 bg-emerald-500/5"
          : active
          ? "border-primary/30 bg-accent/60"
          : "border-border bg-background opacity-60"
      }`}
    >
      <div
        className={`grid h-7 w-7 place-items-center rounded-lg ${
          done
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : active
            ? "bg-gradient-purple text-primary-foreground"
            : "bg-secondary text-ink-soft"
        }`}
      >
        {done ? (
          <Check className="h-3.5 w-3.5" />
        ) : active ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Icon className="h-3.5 w-3.5" />
        )}
      </div>
      <div className="text-[13px] font-medium">{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 6 — Settlement
// ─────────────────────────────────────────────────────────────────────────────

const SETTLE_STEPS = [
  { icon: Percent, label: "Revenue allocated to each party", detail: "Participant allocations derived" },
  { icon: RefreshCw, label: "Ledger updated", detail: "Settlement readiness applied" },
  { icon: Cloud, label: "Xero synchronised", detail: "Funding reconciled" },
  { icon: Flag, label: "Workflow marked complete", detail: "Payouts released" },
];

function useWorkflowSettlement(snapshot: WorkflowImportSnapshot | null) {
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const dealId = snapshot?.dealId;
  const currency = snapshot?.result.currency.value?.trim().toUpperCase() || "AUD";

  const [participants, setParticipants] = useState<DemoParticipant[]>([]);
  const [obligations, setObligations] = useState<WorkflowObligationRow[]>([]);
  const [fundingSummary, setFundingSummary] = useState<WorkflowFundingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settlementStartedRef = useRef(false);

  const settlementStates = deriveWorkflowSettlementStates(
    participants,
    dealId ?? "",
    snapshot?.dealName,
  );
  const settlementComplete = dealId ? isWorkflowSettlementComplete(participants, dealId) : false;
  const allocationCards = buildWorkflowAllocationCards(obligations);
  const payeeParticipants = dealId ? settlementParticipantsForDeal(participants, dealId) : [];
  const completedCount = payeeParticipants.filter(
    (participant) =>
      participant.payoutSettlementStatus === "Paid" || Boolean(participant.payoutPaidAt),
  ).length;
  const pendingCount = Math.max(payeeParticipants.length - completedCount, 0);
  const reconciliationLabel = fundingSummary
    ? formatWorkflowFundingStatus(fundingSummary.projectFundingStatus)
    : "Reconciliation pending";
  const timelineStep = deriveWorkflowTimelineStep({
    obligationsLoaded: obligations.length > 0,
    settlementStates,
    fundingSummary,
    settlementComplete,
  });

  const reload = useCallback(async () => {
    if (!dealId) {
      setParticipants([]);
      setObligations([]);
      setFundingSummary(null);
      setLoading(false);
      return;
    }

    try {
      const data = await loadWorkflowSettlementSnapshot(dealId);
      setParticipants(data.participants);
      setObligations(data.obligations);
      setFundingSummary(data.fundingSummary);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settlement data");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  const runSettlement = useCallback(async () => {
    if (!dealId || !organizationId || settlementComplete) return;

    setExecuting(true);
    setError(null);
    try {
      await refreshWorkflowObligations(dealId);
      const data = await loadWorkflowSettlementSnapshot(dealId);
      setParticipants(data.participants);
      setObligations(data.obligations);
      setFundingSummary(data.fundingSummary);

      const releasableIds = settlementParticipantsForDeal(data.participants, dealId)
        .filter(
          (participant) =>
            participant.payoutSettlementStatus !== "Paid" && !participant.payoutPaidAt,
        )
        .map((participant) => participant.id);

      if (releasableIds.length > 0) {
        await executeWorkflowSettlementRelease({
          organizationId,
          dealId,
          currency,
          participantIds: releasableIds,
        });
      }

      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Settlement execution failed");
    } finally {
      setExecuting(false);
    }
  }, [currency, dealId, organizationId, reload, settlementComplete]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!dealId || settlementComplete) return;
    const interval = window.setInterval(() => {
      void reload();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [dealId, reload, settlementComplete]);

  useEffect(() => {
    if (!dealId || loading || orgLoading || settlementComplete || settlementStartedRef.current) {
      return;
    }
    if (!organizationId) return;
    settlementStartedRef.current = true;
    void runSettlement();
  }, [dealId, loading, orgLoading, organizationId, runSettlement, settlementComplete]);

  return {
    participants,
    obligations,
    fundingSummary,
    loading: loading || orgLoading,
    executing,
    error,
    timelineStep,
    settlementComplete,
    settlementStates,
    allocationCards,
    completedCount,
    pendingCount,
    reconciliationLabel,
    settlementAmount: obligations.reduce((sum, row) => sum + row.amount_owed, 0),
    currency,
    reload,
    runSettlement,
  };
}

function StageSettlement({
  snapshot,
  onNext,
}: {
  snapshot: WorkflowImportSnapshot | null;
  onNext: () => void;
}) {
  const {
    obligations,
    loading,
    executing,
    error,
    timelineStep,
    settlementComplete,
    allocationCards,
    completedCount,
    pendingCount,
    reconciliationLabel,
    settlementAmount,
    currency,
    runSettlement,
  } = useWorkflowSettlement(snapshot);

  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  useEffect(() => {
    if (!settlementComplete) return;
    const timeout = window.setTimeout(() => onNextRef.current(), 2000);
    return () => window.clearTimeout(timeout);
  }, [settlementComplete]);

  const done = timelineStep >= SETTLE_STEPS.length;

  if (!snapshot) {
    return (
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard
            eyebrow="Stage 6"
            title="Automatic settlement"
            description="Complete the earlier stages before running settlement."
          >
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
              No imported agreement is available for settlement yet.
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-ink-soft">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading settlement…
      </div>
    );
  }

  const summaryCards =
    allocationCards.length > 0
      ? allocationCards
      : buildSettlementSchedule(snapshot.result).flatMap((group) =>
          group.lines.slice(0, 1).map((line) => ({
            key: group.partyId,
            label: group.partyName,
            amountLabel: line.value,
            statusLabel: line.status ?? "Scheduled",
            tone: "primary" as const,
          })),
        );

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <SectionCard
          eyebrow="Stage 6"
          title="Automatic settlement"
          description="Provvy allocates funds, updates ledgers and reconciles to Xero — with no human intervention."
        >
          {error && (
            <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[12.5px] text-destructive">
              {error}
              <button
                type="button"
                onClick={() => void runSettlement()}
                className="ml-2 font-medium underline underline-offset-2"
              >
                Retry settlement
              </button>
            </div>
          )}

          <div className="space-y-2.5">
            {SETTLE_STEPS.map((step, index) => (
              <FlowLine
                key={step.label}
                icon={step.icon}
                label={step.label}
                active={index < timelineStep || executing}
                done={index < timelineStep}
              />
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-border bg-background p-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
              Settlement summary
            </div>
            {settlementAmount > 0 && (
              <div className="mt-2 text-[13px] text-ink-soft">
                Total settlement · {formatWorkflowMoney(settlementAmount, currency)}
              </div>
            )}
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {summaryCards.length > 0 ? (
                summaryCards.slice(0, 6).map((row) => (
                  <div
                    key={row.key}
                    className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5"
                  >
                    <div className="text-[11px] text-ink-soft">{row.label}</div>
                    <div className="mt-0.5 text-[14px] font-semibold">{row.amountLabel}</div>
                    <div className="mt-0.5 text-[10.5px] text-ink-soft">{row.statusLabel}</div>
                  </div>
                ))
              ) : (
                <div className="sm:col-span-3 rounded-lg border border-dashed border-border px-3 py-2.5 text-[12.5px] text-ink-soft">
                  No participant allocations are available yet.
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft">
              <RefreshCw className="h-3.5 w-3.5 text-primary" />
              {reconciliationLabel}
              {completedCount + pendingCount > 0
                ? ` · ${completedCount}/${completedCount + pendingCount} payouts`
                : ""}
            </div>
            <PrimaryButton onClick={onNext} disabled={!done && !settlementComplete} icon={Flag}>
              {settlementComplete ? "Finalise Workflow" : executing ? "Settling…" : "Finalise Workflow"}
            </PrimaryButton>
          </div>
        </SectionCard>
      </div>

      <AISidePanel
        title="Happening automatically"
        lines={[
          "Journals matched to bank feed",
          "Invoices raised and marked as paid",
          "Ledger balances refreshed",
          "Commercial Health recalculated",
        ]}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 7 — Complete
// ─────────────────────────────────────────────────────────────────────────────

const WORKFLOW_AUTOMATION_CAPABILITIES = [
  "Generate the recurring invoice.",
  "Collect client funds through Pinch Payments.",
  "Reconcile incoming payments.",
  "Reuse the approved commercial structure.",
  "Coordinate participant settlements automatically.",
  "Notify participants only when commercial terms change.",
] as const;

const WORKFLOW_AUTOMATION_IMPACT = [
  { icon: Clock, label: "Time saved each month", value: "6h 40m" },
  { icon: FileText, label: "Manual tasks eliminated", value: "24 tasks" },
  { icon: TrendingUp, label: "Reduced payment administration", value: "High" },
] as const;

function ProvvyWorkflowRecommendationCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-card">
      <div className="border-b border-border bg-gradient-to-br from-accent/50 to-transparent p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-purple text-primary-foreground shadow-glow">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 text-[12px] font-medium text-accent-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Provvy AI
              </div>
              <h3 className="mt-1 text-xl font-semibold tracking-[-0.02em]">Workflow Insight</h3>
            </div>
          </div>
          <div className="rounded-full border border-primary/20 bg-background/80 px-3 py-1.5 text-[11px] font-medium text-foreground">
            High confidence · 94%
          </div>
        </div>

        <div className="mt-5 space-y-3 text-[13.5px] leading-relaxed text-ink-soft">
          <p>
            I&apos;ve analysed this completed workflow and identified a repeatable commercial pattern.
          </p>
          <p>
            The same client pays the same project value on the second Friday of each month before
            settlement is distributed to the same participants.
          </p>
          <p className="rounded-xl border border-primary/20 bg-accent/70 px-4 py-3 text-foreground">
            This workflow is an excellent candidate for automation.
          </p>
        </div>
      </div>

      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
              Recommendation
            </div>
            <div className="mt-2 text-[16px] font-semibold text-foreground">
              Create a recurring commercial workflow.
            </div>
            <p className="mt-1 text-[13px] text-ink-soft">Provvy can automatically:</p>
          </div>

          <ul className="space-y-2.5">
            {WORKFLOW_AUTOMATION_CAPABILITIES.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[13px] text-foreground">
                <div className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Check className="h-2.5 w-2.5" />
                </div>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
              Estimated business impact
            </div>
            <div className="mt-3 space-y-2.5">
              {WORKFLOW_AUTOMATION_IMPACT.map((metric) => (
                <ImpactCard
                  key={metric.label}
                  icon={metric.icon}
                  label={metric.label}
                  value={metric.value}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background/70 px-4 py-3.5">
            <div className="flex items-center justify-between gap-3 text-[11px] font-medium uppercase tracking-wider text-ink-soft">
              <span>Confidence</span>
              <span className="text-foreground">94%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-[94%] rounded-full bg-gradient-purple" />
            </div>
            <p className="mt-2 text-[12px] text-ink-soft">
              Based on payment cadence, participant structure, and settlement pattern observed in
              this workflow.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border bg-background/50 px-6 py-4 sm:px-8">
        <PrimaryButton
          icon={RefreshCw}
          onClick={() =>
            toast.success("Recurring commercial workflow blueprint queued for deployment")
          }
        >
          Create Recurring Workflow
        </PrimaryButton>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function StageComplete({ onReset }: { onReset: () => void }) {
  const [recommendationDismissed, setRecommendationDismissed] = useState(false);

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-8 shadow-glow sm:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-purple text-primary-foreground shadow-glow">
            <PartyPopper className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <Check className="h-3 w-3" /> Workflow complete
            </div>
            <h2 className="mt-3 text-balance text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
              {WORKFLOW.name} — done.
            </h2>
            <p className="mt-1.5 max-w-2xl text-[13.5px] text-ink-soft">
              Agreement to settlement, run end-to-end by Provvy. Everything is reconciled and captured in your Commercial Timeline.
            </p>
          </div>
        </div>

        <div className="relative mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ImpactCard icon={Clock} label="Time saved" value="6h 40m" />
          <ImpactCard icon={FileText} label="Manual work avoided" value="24 tasks" />
          <ImpactCard icon={TrendingUp} label="Commercial Health" value="+7 pts" />
          <ImpactCard icon={Coins} label="Value moved" value={`A$${WORKFLOW.amount.toLocaleString()}`} />
        </div>
      </div>

      {!recommendationDismissed && (
        <ProvvyWorkflowRecommendationCard onDismiss={() => setRecommendationDismissed(true)} />
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/workspace"
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-purple px-5 py-3 text-[14px] font-semibold text-primary-foreground shadow-glow transition-transform hover:-translate-y-0.5"
            >
              Return to Commercial Workspace
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-3 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
            >
              Deploy another workflow
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            What ran automatically
          </div>
          <ul className="mt-3 space-y-2 text-[12.5px]">
            {[
              "Agreement parsed and understood",
              "4 approvals collected",
              "Funds collected via Pinch",
              "Revenue allocated to 3 parties",
              "Xero fully reconciled",
              "Timeline event created",
            ].map((l) => (
              <li key={l} className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ImpactCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/70 px-4 py-3.5">
      <div className="flex items-center gap-2 text-ink-soft">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-1.5 text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable primitives
// ─────────────────────────────────────────────────────────────────────────────

function SectionCard({
  eyebrow,
  title,
  description,
  headerRight,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-accent-foreground">
            {eyebrow}
          </div>
          <h2 className="mt-1.5 text-[19px] font-semibold tracking-[-0.01em] sm:text-xl">
            {title}
          </h2>
          {description && (
            <p className="mt-1 max-w-2xl text-[13px] text-ink-soft">{description}</p>
          )}
        </div>
        {headerRight}
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function AISidePanel({ title, lines }: { title: string; lines: string[] }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    const id = setInterval(() => {
      setShown((s) => (s >= lines.length ? s : s + 1));
    }, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.join("|")]);

  return (
    <div className="rounded-2xl border border-primary/20 bg-card p-6 shadow-card">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-purple text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Provvy AI
          </div>
          <div className="text-[14px] font-semibold">{title}</div>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {lines.map((l, i) => (
          <li
            key={l}
            className={`flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] transition-all ${
              i < shown ? "opacity-100" : "opacity-0"
            }`}
            style={{ transitionDelay: `${i * 40}ms` }}
          >
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{l}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrimaryButton({
  onClick,
  children,
  icon: Icon,
  disabled,
  spinIcon,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  icon?: LucideIcon;
  disabled?: boolean;
  spinIcon?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group inline-flex items-center gap-2 rounded-xl bg-gradient-purple px-5 py-3 text-[14px] font-semibold text-primary-foreground shadow-glow transition-transform enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
      {Icon && (
        <Icon className={`h-4 w-4 ${spinIcon ? "animate-spin" : "transition-transform group-hover:translate-x-0.5"}`} />
      )}
    </button>
  );
}

function SecondaryButton({
  onClick,
  children,
  icon: Icon,
  disabled,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  icon?: LucideIcon;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-3 text-[13px] font-medium text-foreground transition-colors enabled:hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}
