import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Workflow,
  Plug,
  FileText,
  Sparkles,
  Palette,
  Download,
} from "lucide-react";
import {
  Button,
  TextField,
  SearchField,
  Dropdown,
  MultiSelect,
  FileUpload,
  DatePicker,
  Surface,
  CommercialHealthCard,
  MetricCard,
  WorkflowCard,
  RecommendationCard,
  InsightCard,
  ConnectedSystemCard,
  StatusBadge,
  LinearProgress,
  CircularProgress,
  StepProgress,
  AIProcessing,
  ConfidenceBar,
  Timeline,
  AIThinking,
  StreamingText,
  AIReasoningCard,
  SuggestedActions,
  AIInsightsPanel,
  EmptyState,
  LoadingChecklist,
  Banner,
  notify,
  Modal,
  DataTable,
  Skeleton,
  CardSkeleton,
} from "@/components/provvy";

export const Route = createFileRoute("/system")({
  head: () => ({
    meta: [
      { title: "Provvy Design System — Component Library" },
      {
        name: "description",
        content:
          "The reusable design system that powers the Provvy Commercial Operating System — buttons, cards, AI patterns, tables and interaction primitives.",
      },
      { property: "og:title", content: "Provvy Design System" },
      { property: "og:description", content: "Reusable components and interaction patterns for the Provvy Commercial Operating System." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SystemPage,
});

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 animate-fade-up space-y-4">
      <div>
        <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-ink-soft">{description}</p>}
      </div>
      <div>{children}</div>
    </section>
  );
}

function SystemPage() {
  const [multi, setMulti] = useState<string[]>(["xero"]);
  const [modal, setModal] = useState(false);
  const [running, setRunning] = useState(0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-[min(1200px,calc(100%-2rem))] py-12 space-y-14">
        <header className="animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            <Palette className="h-3 w-3" />
            Design System
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            The Provvy component library.
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] text-ink-soft">
            Reusable primitives, patterns and micro-interactions used across the Commercial Operating System. Import from{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5 text-[12px]">@/components/provvy</code>.
          </p>
        </header>

        <Section id="tokens" title="Design tokens" description="Colour, typography, radius, elevation, motion — defined once in styles.css.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: "Primary", var: "--primary", cls: "bg-primary" },
              { name: "Accent", var: "--accent", cls: "bg-accent" },
              { name: "Foreground", var: "--foreground", cls: "bg-foreground" },
              { name: "Border", var: "--border", cls: "bg-border" },
            ].map((t) => (
              <Surface key={t.name} className="p-4">
                <div className={`h-14 w-full rounded-lg ${t.cls}`} />
                <div className="mt-3 flex items-center justify-between text-[12.5px]">
                  <span className="font-medium">{t.name}</span>
                  <code className="text-[11px] text-ink-soft">{t.var}</code>
                </div>
              </Surface>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Surface className="p-4"><div className="text-[11px] uppercase tracking-wider text-ink-soft">Radius</div><div className="mt-2 flex items-end gap-2">{["md","lg","xl","2xl"].map(r=>(<div key={r} className={`h-10 w-10 border border-border bg-secondary rounded-${r}`} />))}</div></Surface>
            <Surface className="p-4"><div className="text-[11px] uppercase tracking-wider text-ink-soft">Elevation</div><div className="mt-2 flex items-end gap-2"><div className="h-10 w-10 rounded-lg bg-card shadow-soft" /><div className="h-10 w-10 rounded-lg bg-card shadow-card" /><div className="h-10 w-10 rounded-lg bg-card shadow-glow" /></div></Surface>
            <Surface className="p-4"><div className="text-[11px] uppercase tracking-wider text-ink-soft">Typography</div><div className="mt-2 space-y-0.5"><div className="text-2xl font-semibold tracking-[-0.02em]">Display</div><div className="text-[15px]">Body</div><div className="text-[12px] text-ink-soft">Caption</div></div></Surface>
          </div>
        </Section>

        <Section id="buttons" title="Buttons">
          <div className="flex flex-wrap items-center gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
            <Button size="sm">Small</Button>
            <Button size="lg" leadingIcon={<Download />}>Download report</Button>
            <Button size="icon" aria-label="Download"><Download /></Button>
          </div>
        </Section>

        <Section id="inputs" title="Inputs & validation">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Business name" placeholder="Provvy Pty Ltd" />
            <TextField label="Email" placeholder="you@provvy.com" defaultValue="wrong" error="Enter a valid email" />
            <TextField label="ABN" defaultValue="12 345 678 901" success="Valid ABN" />
            <SearchField label="Search workflows" />
            <Dropdown label="Industry" placeholder="Select industry" options={[{value:"prof",label:"Professional services"},{value:"con",label:"Construction"},{value:"tech",label:"Technology"}]} />
            <MultiSelect label="Connected systems" value={multi} onChange={setMulti} options={[{value:"xero",label:"Xero"},{value:"pinch",label:"Pinch"},{value:"stripe",label:"Stripe"},{value:"slack",label:"Slack"}]} />
            <DatePicker label="Effective date" />
            <FileUpload label="Upload agreement" hint="PDF, DOCX up to 10MB" accept=".pdf,.docx" />
          </div>
        </Section>

        <Section id="badges" title="Status badges">
          <div className="flex flex-wrap gap-2">
            {(["connected","disconnected","ready","running","processing","pending","completed","failed","draft","approved"] as const).map(s => (
              <StatusBadge key={s} status={s} />
            ))}
          </div>
        </Section>

        <Section id="progress" title="Progress indicators">
          <div className="grid gap-6 lg:grid-cols-3">
            <Surface className="p-5 space-y-4">
              <LinearProgress value={64} label="Extraction progress" />
              <ConfidenceBar value={92} />
              <ConfidenceBar value={68} />
              <ConfidenceBar value={41} />
            </Surface>
            <Surface className="p-5 flex flex-col items-center justify-center gap-4">
              <CircularProgress value={82} size={92} />
              <AIProcessing />
            </Surface>
            <Surface className="p-5">
              <StepProgress steps={[{label:"Agreement",state:"done"},{label:"Extract",state:"done"},{label:"Review",state:"current"},{label:"Approve",state:"todo"},{label:"Settle",state:"todo"}]} />
            </Surface>
          </div>
        </Section>

        <Section id="cards" title="Cards">
          <div className="grid gap-3 lg:grid-cols-3">
            <CommercialHealthCard score={82} trend={4} />
            <MetricCard label="A/R outstanding" value="A$142,380" delta="+8%" hint="14 open invoices" />
            <MetricCard label="Runway" value="9.2 mo" hint="Steady" />
            <WorkflowCard name="Autonomous Reconciliation" description="Match receipts to invoices, post to Xero automatically." status="running" savings="14 hrs / month" />
            <ConnectedSystemCard name="Xero" category="Accounting · Live sync" status="connected" />
            <RecommendationCard title="Automate reconciliation" reason="47% of your admin time is spent matching invoices to payments." impact="A$3,200 saved / month" cta="Deploy workflow" />
            <InsightCard title="Cash timing risk" body="Two invoices worth A$18,400 are due next week with no payment plan." />
          </div>
        </Section>

        <Section id="timeline" title="Timeline">
          <Surface className="p-5">
            <Timeline events={[
              { id:"1", title:"Payment received", detail:"A$4,820 · INV-1042", time:"Just now", kind:"payment" },
              { id:"2", title:"AI extracted agreement", detail:"Master Services Agreement — Northline", time:"2m", kind:"ai" },
              { id:"3", title:"Ada approved workflow", time:"5m", kind:"user" },
              { id:"4", title:"Xero sync failed", detail:"Retrying in 30s.", time:"7m", kind:"error" },
              { id:"5", title:"System backup", time:"1h", kind:"system" },
            ]} />
          </Surface>
        </Section>

        <Section id="ai" title="AI language">
          <div className="grid gap-4 lg:grid-cols-2">
            <AIReasoningCard
              title="Why Autonomous Reconciliation?"
              confidence={91}
              reasoning="You process ~180 invoices/month across Xero and Pinch. 47% of your admin time is spent on manual matching — this workflow eliminates that entirely."
            />
            <AIInsightsPanel>
              <div className="text-[13px]">
                <AIThinking label="Analysing last 90 days" />
                <p className="mt-3"><StreamingText text="Your cash conversion cycle is 18 days — 6 days better than industry benchmark. Two customers account for 58% of receivables." /></p>
                <div className="mt-3">
                  <SuggestedActions actions={[{label:"Show breakdown"},{label:"Draft reminder"},{label:"Set credit limit"}]} />
                </div>
              </div>
            </AIInsightsPanel>
          </div>
        </Section>

        <Section id="loading" title="Loading states" description="Meaningful, narrative loading — never generic spinners.">
          <div className="grid gap-4 lg:grid-cols-2">
            <LoadingChecklist
              key={running}
              title="Analysing agreement"
              perStepMs={700}
              items={[
                { label: "Parsing document structure" },
                { label: "Extracting parties & obligations" },
                { label: "Identifying payment terms" },
                { label: "Cross-referencing with Xero" },
                { label: "Composing recommendation" },
              ]}
            />
            <div className="space-y-3">
              <CardSkeleton />
              <CardSkeleton />
              <Button variant="secondary" onClick={()=>setRunning(r=>r+1)}>Replay checklist</Button>
            </div>
          </div>
        </Section>

        <Section id="empty" title="Empty states">
          <div className="grid gap-4 lg:grid-cols-2">
            <EmptyState icon={Workflow} title="No workflows yet" description="Deploy your first workflow to start automating a commercial process." actionLabel="Browse library" secondaryLabel="Learn more" />
            <EmptyState icon={Plug} title="No systems connected" description="Connect Xero, Pinch or another platform to unlock live commercial insight." actionLabel="Connect a system" />
          </div>
        </Section>

        <Section id="notifications" title="Notifications & banners">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={()=>notify.success("Workflow deployed","Autonomous Reconciliation is now live.")}>Success toast</Button>
              <Button variant="secondary" onClick={()=>notify.error("Sync failed","Xero returned 401.")}>Error toast</Button>
              <Button variant="secondary" onClick={()=>notify.warning("Payment overdue","INV-1042 is 3 days overdue.")}>Warning toast</Button>
              <Button variant="secondary" onClick={()=>notify.ai("Provvy noticed something","Cash flow trend improved 12% this quarter.")}>AI toast</Button>
              <Button variant="secondary" onClick={()=>notify.sync("Syncing Xero","Reconciling 42 transactions in the background…")}>Background sync</Button>
            </div>
            <Banner tone="ai" title="Provvy AI suggestion">Enable Autonomous Reconciliation to save ~14 hours per month.</Banner>
            <Banner tone="warning" title="Two invoices overdue">A$18,400 in receivables past 30 days.</Banner>
            <Banner tone="info">Xero sync last ran 3 minutes ago.</Banner>
          </div>
        </Section>

        <Section id="modal" title="Modal system">
          <Button variant="secondary" onClick={()=>setModal(true)}>Open modal</Button>
          <Modal
            open={modal}
            onOpenChange={setModal}
            title="Connect Xero"
            description="Provvy will read your ledger, invoices and payments. Read-only by default."
            primaryLabel="Continue to Xero"
            onPrimary={()=>{ setModal(false); notify.sync("Redirecting","Establishing secure connection…"); }}
          >
            <ul className="space-y-2 text-ink-soft">
              <li>• Live sync of invoices &amp; bills</li>
              <li>• Bank-grade OAuth via Xero</li>
              <li>• Disconnect at any time</li>
            </ul>
          </Modal>
        </Section>

        <Section id="table" title="Data table" description="Sortable, expandable, inline status.">
          <DataTable
            columns={[
              { key:"invoice", header:"Invoice", sortable:true },
              { key:"customer", header:"Customer", sortable:true },
              { key:"amount", header:"Amount", sortable:true, align:"right", render:(r)=><span className="tabular-nums font-medium">{r.amount}</span> },
              { key:"status", header:"Status", render:(r)=><StatusBadge status={r.status as never} /> },
            ]}
            rows={[
              { id:1, invoice:"INV-1042", customer:"Northline Group", amount:"A$4,820.00", status:"completed" },
              { id:2, invoice:"INV-1043", customer:"Harbour Freight", amount:"A$12,480.00", status:"processing" },
              { id:3, invoice:"INV-1044", customer:"Kite Studio", amount:"A$1,290.00", status:"pending" },
              { id:4, invoice:"INV-1045", customer:"Meridian Legal", amount:"A$8,200.00", status:"failed" },
            ]}
            expandable={(r)=>(<div>Ledger match confidence 96% · Payment rail: Pinch · Reference {r.invoice}.</div>)}
          />
        </Section>

        <Section id="skeleton" title="Skeleton primitives">
          <Surface className="p-5 space-y-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-2/3" />
          </Surface>
        </Section>

        <footer className="pt-4 pb-16 text-[12px] text-ink-soft">
          <div className="inline-flex items-center gap-2"><Sparkles className="size-3.5 text-primary" /> Provvy Commercial OS · Design System</div>
        </footer>
      </div>
    </div>
  );
}
