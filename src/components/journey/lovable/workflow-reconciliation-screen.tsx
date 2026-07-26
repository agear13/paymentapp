'use client';

import '@/components/journey/lovable/lovable-journey.css';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
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
  ChevronRight,
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

export function WorkflowReconciliationScreen() {
  const [stage, setStage] = useState<StageKey>("agreement");
  const stageIndex = WORKFLOW.stages.findIndex((s) => s.key === stage);

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
        {stage === "agreement" && <StageAgreement onNext={next} />}
        {stage === "extraction" && <StageExtraction onNext={next} />}
        {stage === "review" && <StageReview onNext={next} />}
        {stage === "approvals" && <StageApprovals onNext={next} />}
        {stage === "collection" && <StageCollection onNext={next} />}
        {stage === "settlement" && <StageSettlement onNext={next} />}
        {stage === "complete" && <StageComplete onReset={() => go("agreement")} />}
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
  },
  {
    icon: FileText,
    label: "Drag & drop",
    detail: "Contract, MSA or SOW",
    kind: "File",
  },
  {
    icon: Mail,
    label: "Paste from email",
    detail: "Forward or paste thread",
    kind: "Email",
  },
  {
    icon: MessageSquare,
    label: "Paste WhatsApp",
    detail: "Conversation transcript",
    kind: "Chat",
  },
  {
    icon: Cloud,
    label: "Import from cloud",
    detail: "Drive · Dropbox · SharePoint",
    kind: "Cloud",
  },
];

function StageAgreement({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState<string | null>("Upload PDF");
  const [file] = useState({
    name: "Northside_Venue_RevShare_2026.pdf",
    size: "412 KB",
    pages: 8,
  });

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-5">
        <SectionCard
          eyebrow="Stage 1"
          title="Bring your agreement into Provvy"
          description="Provvy accepts commercial context from anywhere. Documents, threads and chats all become structured commercial data."
        >
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
                  {file.name}
                </div>
                <div className="text-[11.5px] text-ink-soft">
                  {file.pages} pages · {file.size} · Ready for analysis
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                <Check className="h-3 w-3" />
                Uploaded
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              End-to-end encrypted · Never used for model training
            </div>
            <PrimaryButton onClick={onNext} icon={Brain}>
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
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2 — AI Extraction
// ─────────────────────────────────────────────────────────────────────────────

const EXTRACTIONS = [
  { icon: Users, label: "Parties", value: "4 identified", confidence: 99 },
  { icon: Coins, label: "Commercial terms", value: "12 clauses parsed", confidence: 96 },
  { icon: CreditCard, label: "Payment obligations", value: "A$48,600 total", confidence: 98 },
  { icon: Percent, label: "Revenue splits", value: "60 / 30 / 10", confidence: 97 },
  { icon: Flag, label: "Milestones", value: "3 detected", confidence: 92 },
  { icon: Calendar, label: "Important dates", value: "5 upcoming", confidence: 99 },
  { icon: ShieldCheck, label: "Conditions", value: "6 obligations", confidence: 94 },
  { icon: AlertTriangle, label: "Risks", value: "2 flagged", confidence: 88 },
];

function StageExtraction({ onNext }: { onNext: () => void }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= EXTRACTIONS.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), 420);
    return () => clearTimeout(t);
  }, [step]);
  const done = step >= EXTRACTIONS.length;
  const progress = Math.min(100, Math.round((step / EXTRACTIONS.length) * 100));

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      {/* Left — the document becoming data */}
      <div className="lg:col-span-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Source document
          </div>
          <div className="mt-3 aspect-[3/4] w-full overflow-hidden rounded-xl border border-border bg-background">
            <div className="relative h-full w-full p-4">
              {/* fake document lines */}
              <div className="space-y-1.5">
                <div className="h-2 w-3/5 rounded bg-secondary" />
                <div className="h-2 w-2/5 rounded bg-secondary" />
                <div className="mt-3 h-1.5 w-full rounded bg-secondary/70" />
                <div className="h-1.5 w-11/12 rounded bg-secondary/70" />
                <div className="h-1.5 w-10/12 rounded bg-secondary/70" />
                <div className="h-1.5 w-full rounded bg-secondary/70" />
                <div className="h-1.5 w-9/12 rounded bg-secondary/70" />
                <div className="mt-3 h-2 w-2/5 rounded bg-secondary" />
                <div className="h-1.5 w-11/12 rounded bg-secondary/70" />
                <div className="h-1.5 w-10/12 rounded bg-secondary/70" />
                <div className="h-1.5 w-full rounded bg-secondary/70" />
                <div className="mt-3 h-2 w-1/3 rounded bg-secondary" />
                <div className="h-1.5 w-full rounded bg-secondary/70" />
                <div className="h-1.5 w-9/12 rounded bg-secondary/70" />
                <div className="h-1.5 w-11/12 rounded bg-secondary/70" />
              </div>
              {/* scanning beam */}
              {!done && (
                <div
                  className="pointer-events-none absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-primary/25 to-transparent"
                  style={{
                    top: `${Math.min(85, 8 + progress * 0.8)}%`,
                    transition: "top 300ms ease-out",
                  }}
                />
              )}
              {/* highlights */}
              {step > 1 && (
                <div className="absolute left-4 top-[18%] h-2 w-2/5 rounded bg-primary/30 ring-1 ring-primary/40" />
              )}
              {step > 3 && (
                <div className="absolute left-4 top-[40%] h-1.5 w-1/2 rounded bg-primary/30 ring-1 ring-primary/40" />
              )}
              {step > 5 && (
                <div className="absolute left-4 top-[62%] h-1.5 w-2/5 rounded bg-primary/30 ring-1 ring-primary/40" />
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-[12px]">
            <span className="text-ink-soft">Pages analysed</span>
            <span className="font-medium">
              {Math.min(8, Math.ceil((step / EXTRACTIONS.length) * 8))} / 8
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-gradient-purple transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Right — structured extractions */}
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
          <div className="grid gap-2 sm:grid-cols-2">
            {EXTRACTIONS.map((e, i) => {
              const revealed = i < step;
              const Icon = e.icon;
              return (
                <div
                  key={e.label}
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
                      <div className="text-[12.5px] font-semibold">{e.label}</div>
                      {revealed && <Confidence value={e.confidence} />}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-ink-soft">
                      {revealed ? e.value : "Analysing…"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] text-ink-soft">
              {done
                ? "All commercial data extracted. Ready for human review."
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

function StageReview({ onNext }: { onNext: () => void }) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-5">
        <SectionCard
          eyebrow="Stage 3"
          title="Review the commercial understanding"
          description="Everything below was extracted by Provvy. Edit inline before deploying the workflow."
        >
          {/* Participants */}
          <ReviewBlock title="Participants" confidence={99} icon={Users}>
            <div className="grid gap-2 sm:grid-cols-2">
              {WORKFLOW.participants.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
                >
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-[11px] font-semibold">
                    {p.name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <EditableText value={p.name} className="text-[13px] font-medium" />
                    <div className="text-[11.5px] text-ink-soft">{p.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </ReviewBlock>

          {/* Commercial obligations */}
          <ReviewBlock title="Commercial obligations" confidence={96} icon={ShieldCheck}>
            <ul className="space-y-2">
              {[
                "Venue provides space and technical production for scheduled event dates",
                "Promoter delivers marketing, ticketing and audience acquisition",
                "Operator collects gross revenue and distributes per allocation schedule",
                "Monthly reconciliation completed within 5 business days of month end",
              ].map((c, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
                >
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <EditableText value={c} className="flex-1" />
                </li>
              ))}
            </ul>
          </ReviewBlock>

          {/* Payment schedule */}
          <ReviewBlock title="Payment schedule" confidence={98} icon={Calendar}>
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
                  {[
                    { d: "5 Mar 2026", m: "Event settlement · Autumn tour", a: "A$18,200" },
                    { d: "5 Apr 2026", m: "Event settlement · Late shows", a: "A$16,900" },
                    { d: "5 May 2026", m: "Final settlement", a: "A$13,500" },
                  ].map((r) => (
                    <tr key={r.d} className="border-t border-border">
                      <td className="px-3 py-2">{r.d}</td>
                      <td className="px-3 py-2">
                        <EditableText value={r.m} />
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{r.a}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ReviewBlock>

          {/* Revenue allocation */}
          <ReviewBlock title="Revenue allocation" confidence={97} icon={Percent}>
            <div className="space-y-2">
              {[
                { name: "Northside Venue", pct: 60, amount: 29160, color: "from-purple-500 to-fuchsia-500" },
                { name: "Loop Promotions", pct: 30, amount: 14580, color: "from-primary to-purple-500" },
                { name: "Operator fee", pct: 10, amount: 4860, color: "from-indigo-500 to-primary" },
              ].map((r) => (
                <div key={r.name} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-ink-soft">
                      <span className="font-semibold text-foreground">
                        A${r.amount.toLocaleString()}
                      </span>{" "}
                      · {r.pct}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full bg-gradient-to-r ${r.color}`}
                      style={{ width: `${r.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </ReviewBlock>

          {/* Approval requirements */}
          <ReviewBlock title="Approval requirements" confidence={94} icon={UserRoundCheck}>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                "Venue must approve final allocations",
                "Promoter must confirm event settlement",
                "Accountant reviews reconciliation",
                "Operator authorises fund release",
              ].map((c, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
                >
                  <Circle className="mt-0.5 h-3 w-3 shrink-0 text-ink-soft" />
                  <EditableText value={c} />
                </div>
              ))}
            </div>
          </ReviewBlock>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <div className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Edits are saved automatically and versioned
            </div>
            <PrimaryButton onClick={onNext} icon={UserRoundCheck}>
              Approve Workflow
            </PrimaryButton>
          </div>
        </SectionCard>
      </div>

      <AISidePanel
        title="Provvy AI notes"
        lines={[
          "Split calculation matches historical events",
          "One clause references a legacy 2024 rate — worth confirming",
          "Suggested reconciliation cadence: monthly",
          "No missing signatures detected",
        ]}
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

function EditableText({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <span
      ref={ref}
      role="textbox"
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => setText(e.currentTarget.textContent || "")}
      className={`inline-block max-w-full rounded px-1 -mx-1 outline-none transition-colors focus:bg-accent focus:ring-1 focus:ring-primary/40 ${
        className || ""
      }`}
    >
      {text}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 4 — Approvals
// ─────────────────────────────────────────────────────────────────────────────

function StageApprovals({ onNext }: { onNext: () => void }) {
  const [statuses, setStatuses] = useState<Record<string, "approved" | "pending" | "waiting">>({
    "Northside Venue": "approved",
    "Loop Promotions": "pending",
    "Harper & Co": "approved",
    "Provvy Operator": "approved",
  });
  const [sent, setSent] = useState(false);

  const request = () => {
    setSent(true);
    // simulate the pending party approving after a moment
    setTimeout(() => {
      setStatuses((s) => ({ ...s, "Loop Promotions": "approved" }));
    }, 1600);
  };

  const total = Object.keys(statuses).length;
  const approved = Object.values(statuses).filter((v) => v === "approved").length;
  const allApproved = approved === total;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <SectionCard
          eyebrow="Stage 4"
          title="Participants approve the workflow"
          description="Provvy routes the workflow to each party. Approvals are captured, timestamped and reflected in the timeline."
          headerRight={
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground">
              {approved} / {total} approved
            </span>
          }
        >
          <div className="space-y-2.5">
            {WORKFLOW.participants.map((p) => {
              const status = statuses[p.name] || "waiting";
              return (
                <div
                  key={p.name}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background px-3.5 py-3"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-[11.5px] font-semibold">
                    {p.name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold">{p.name}</div>
                    <div className="text-[11.5px] text-ink-soft">{p.role}</div>
                  </div>
                  <ApprovalPill status={status} />
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-gradient-purple transition-all duration-700"
                style={{ width: `${(approved / total) * 100}%` }}
              />
            </div>
            <span className="text-[12px] font-medium text-ink-soft">
              {Math.round((approved / total) * 100)}%
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] text-ink-soft">
              {allApproved
                ? "All parties have approved. Ready to collect funds."
                : sent
                ? "Reminders sent · Awaiting Loop Promotions"
                : "One participant still to approve."}
            </div>
            {allApproved ? (
              <PrimaryButton onClick={onNext} icon={CreditCard}>
                Continue to Payment
              </PrimaryButton>
            ) : (
              <SecondaryButton onClick={request} icon={Send}>
                {sent ? "Reminder sent" : "Request Remaining Approvals"}
              </SecondaryButton>
            )}
          </div>
        </SectionCard>
      </div>

      <AISidePanel
        title="What Provvy is doing"
        lines={[
          "Routing to each party via preferred channel",
          "Auto-following up if a party is idle > 24h",
          "Recording approvals in the Commercial Timeline",
          "Notifying you the moment funds can be collected",
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

function StageCollection({ onNext }: { onNext: () => void }) {
  const [phase, setPhase] = useState<"ready" | "collecting" | "received">("ready");

  useEffect(() => {
    if (phase !== "collecting") return;
    const t = setTimeout(() => setPhase("received"), 1800);
    return () => clearTimeout(t);
  }, [phase]);

  return (
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
                  A${WORKFLOW.amount.toLocaleString()}
                </div>
                <div className="mt-1 text-[12px] text-ink-soft">
                  From Operator settlement account · Ref WKF-1042
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
                <div className="mt-1 text-[11px] text-ink-soft">PayTo · Direct Debit</div>
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <MiniStat label="Fee" value="0.4%" />
              <MiniStat label="Est. settlement" value="Same day" />
              <MiniStat label="Compliance" value="Verified" />
            </div>
          </div>

          <div className="mt-5 space-y-2.5">
            <FlowLine
              icon={CreditCard}
              label="Initiating collection with Pinch"
              active={phase !== "ready"}
              done={phase === "received"}
            />
            <FlowLine
              icon={ShieldCheck}
              label="Authorisation verified"
              active={phase !== "ready"}
              done={phase === "received"}
            />
            <FlowLine
              icon={Check}
              label="Payment received"
              active={phase === "received"}
              done={phase === "received"}
            />
            <FlowLine
              icon={Activity}
              label="Timeline updated · Settlement unlocked"
              active={phase === "received"}
              done={phase === "received"}
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Funds move under your operating rules · Provvy never holds money
            </div>
            {phase === "received" ? (
              <PrimaryButton onClick={onNext} icon={RefreshCw}>
                Continue to Settlement
              </PrimaryButton>
            ) : (
              <PrimaryButton
                onClick={() => setPhase("collecting")}
                disabled={phase === "collecting"}
                icon={phase === "collecting" ? Loader2 : CreditCard}
                spinIcon={phase === "collecting"}
              >
                {phase === "collecting" ? "Collecting…" : "Collect Funds with Pinch"}
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
  { icon: Percent, label: "Revenue allocated to each party", detail: "60 / 30 / 10 split applied" },
  { icon: RefreshCw, label: "Ledger updated", detail: "Journals posted to internal ledger" },
  { icon: Cloud, label: "Xero synchronised", detail: "Invoices, payments and bills reconciled" },
  { icon: Flag, label: "Workflow marked complete", detail: "Timeline event created" },
];

function StageSettlement({ onNext }: { onNext: () => void }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= SETTLE_STEPS.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), 700);
    return () => clearTimeout(t);
  }, [step]);
  const done = step >= SETTLE_STEPS.length;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <SectionCard
          eyebrow="Stage 6"
          title="Automatic settlement"
          description="Provvy allocates funds, updates ledgers and reconciles to Xero — with no human intervention."
        >
          <div className="space-y-2.5">
            {SETTLE_STEPS.map((s, i) => (
              <FlowLine
                key={s.label}
                icon={s.icon}
                label={s.label}
                active={i < step}
                done={i < step}
              />
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-border bg-background p-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
              Settlement summary
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {[
                { k: "Northside Venue", v: "A$29,160", tone: "primary" },
                { k: "Loop Promotions", v: "A$14,580", tone: "primary" },
                { k: "Operator fee", v: "A$4,860", tone: "muted" },
              ].map((r) => (
                <div
                  key={r.k}
                  className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5"
                >
                  <div className="text-[11px] text-ink-soft">{r.k}</div>
                  <div className="mt-0.5 text-[14px] font-semibold">{r.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft">
              <RefreshCw className="h-3.5 w-3.5 text-primary" />
              Reconciled in Xero · 0 exceptions
            </div>
            <PrimaryButton onClick={onNext} disabled={!done} icon={Flag}>
              Finalise Workflow
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

function StageComplete({ onReset }: { onReset: () => void }) {
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

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Suggested next workflow
          </div>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-[15px] font-semibold">Revenue Sharing Automation</div>
                <p className="mt-1 max-w-md text-[12.5px] text-ink-soft">
                  Automate ongoing splits with your top three revenue partners. Estimated saving: 12 hours per month.
                </p>
              </div>
            </div>
            <Link
              href="/workspace/workflows"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
            >
              Preview
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
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
}: {
  onClick?: () => void;
  children: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-3 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}
