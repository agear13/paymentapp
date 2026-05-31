import Link from 'next/link';

const PROBLEM_CHANNELS = [
  { name: 'WhatsApp', tone: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  { name: 'Email', tone: 'bg-blue-50 border-blue-200 text-blue-800' },
  { name: 'Messenger', tone: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
  { name: 'Slack', tone: 'bg-purple-50 border-purple-200 text-purple-800' },
  { name: 'Phone calls', tone: 'bg-amber-50 border-amber-200 text-amber-900' },
  { name: 'Meeting notes', tone: 'bg-slate-50 border-slate-200 text-slate-800' },
] as const;

const RECONCILIATION_PAIN = [
  'Agreements not documented',
  'Different terms across channels',
  'Unclear who is owed what',
  'Missing invoices and receipts',
  'Manual spreadsheets',
  'Payment disputes and delays',
] as const;

const TRANSFORMATION_STEPS = [
  'Conversation',
  'Agreement Intelligence',
  'Agreement',
  'Obligations',
  'Settlement',
] as const;

const WORKFLOW_CARDS = [
  {
    step: '01',
    label: 'Capture',
    title: 'Import conversations from anywhere.',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  },
  {
    step: '02',
    label: 'Structure',
    title: 'Extract terms and generate agreements.',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    step: '03',
    label: 'Coordinate',
    title: 'Track obligations through settlement.',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  },
] as const;

const PRICING_SECTIONS = [
  {
    name: 'Payment Links',
    featured: false,
    plans: [
      { name: 'Starter', price: 'Free', popular: false },
      { name: 'Growth', price: '$29/month', popular: false },
      { name: 'Expand', price: '$79/month', popular: false },
    ],
  },
  {
    name: 'Revenue Share',
    badge: 'Most Popular',
    featured: true,
    plans: [
      { name: 'Launch', price: '$149/month', popular: false },
      { name: 'Growth', price: '$349/month', popular: true },
      { name: 'Multi-Entity', price: "Let's Talk", popular: false },
    ],
  },
  {
    name: 'Accountant Partner',
    featured: false,
    plans: [{ name: 'Partner', price: '$149/month', popular: false }],
  },
  {
    name: 'Payments Intelligence Layer',
    badge: 'Coming Soon',
    featured: false,
    plans: [{ name: 'Enterprise', price: 'Talk To Us', popular: false }],
  },
] as const;

const FOOTER_PRODUCT_LINKS = [
  'Agreement Intelligence',
  'Participants',
  'Obligations',
  'Settlement',
  'Reconciliation',
  'Reporting',
] as const;

function ChannelGlyph({ name }: { name: string }) {
  const paths: Record<string, string> = {
    WhatsApp:
      'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    Email: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    Messenger:
      'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
    Slack:
      'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    'Phone calls': 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
    'Meeting notes':
      'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  };
  const d = paths[name] ?? paths.Email;
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={d} />
    </svg>
  );
}

function FlowArrow({ className = 'text-primary/40' }: { className?: string }) {
  return (
    <div className="flex justify-center py-2">
      <svg className={`w-5 h-5 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    </div>
  );
}

/** Hero visual — transformation arc, not a SaaS dashboard. */
function HeroTransformationVisual() {
  return (
    <div className="relative space-y-0">
      <div className="rounded-2xl border bg-white shadow-lg p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Conversation · WhatsApp
          </span>
        </div>
        <div className="space-y-2.5">
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center text-xs font-bold text-blue-700">
              S
            </div>
            <div className="bg-muted/60 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm max-w-[85%]">
              We&apos;ll pay DJ Alex 10% of ticket sales for the event.
            </div>
          </div>
          <div className="flex gap-2.5 flex-row-reverse">
            <div className="w-7 h-7 rounded-full bg-emerald-100 flex-shrink-0 flex items-center justify-center text-xs font-bold text-emerald-700">
              A
            </div>
            <div className="bg-emerald-50 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm max-w-[85%] text-emerald-900">
              Agreed. 10% of tickets sounds right.
            </div>
          </div>
        </div>
      </div>

      <FlowArrow />

      <div className="flex items-center justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-5 py-2.5 shadow-sm">
          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <span className="text-sm font-semibold text-primary">Agreement Intelligence</span>
        </div>
      </div>

      <FlowArrow />

      <div className="rounded-2xl border bg-white shadow-lg overflow-hidden">
        <div className="bg-primary/5 border-b px-5 py-3">
          <span className="text-xs font-semibold text-primary">Agreement</span>
        </div>
        <div className="p-5 grid grid-cols-2 gap-x-6 gap-y-3">
          {[
            { label: 'Participant', value: 'DJ Alex' },
            { label: 'Type', value: 'Revenue share' },
            { label: 'Amount', value: '10%', accent: true },
            { label: 'Basis', value: 'Ticket sales' },
          ].map((row) => (
            <div key={row.label}>
              <div className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wide">{row.label}</div>
              <div className={`text-sm font-semibold ${row.accent ? 'text-primary' : 'text-foreground'}`}>
                {row.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <FlowArrow />

      <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/80 px-5 py-4 text-center">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700/70 mb-1">
          Settlement
        </div>
        <div className="text-sm font-semibold text-emerald-900">Obligations coordinated · Ready to release</div>
      </div>
    </div>
  );
}

function DemoSection() {
  return (
    <section className="py-20 lg:py-28 border-t bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-14 max-w-2xl mx-auto">
          <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">Live example</p>
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">See Agreement Intelligence in action</h2>
          <p className="text-lg text-muted-foreground">Paste a conversation. Generate a structured agreement.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start max-w-5xl mx-auto">
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">Conversation</div>
            <div className="rounded-2xl border bg-muted/20 p-5 space-y-3">
              {[
                { side: 'left' as const, initial: 'S', color: 'bg-blue-100 text-blue-700', text: "We'll pay you 10% of ticket sales for Saturday." },
                { side: 'right' as const, initial: 'D', color: 'bg-emerald-100 text-emerald-700', text: 'Sounds good.' },
                { side: 'left' as const, initial: 'S', color: 'bg-blue-100 text-blue-700', text: 'Agreed.' },
              ].map((msg, i) => (
                <div key={i} className={`flex gap-2.5 ${msg.side === 'right' ? 'flex-row-reverse' : ''}`}>
                  <div
                    className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${msg.color}`}
                  >
                    {msg.initial}
                  </div>
                  <div
                    className={`rounded-xl px-3.5 py-2.5 text-sm max-w-[75%] ${
                      msg.side === 'left' ? 'bg-white border' : 'bg-primary/10 border border-primary/10'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
              Agreement Intelligence output
            </div>
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
              <div className="bg-primary/5 border-b px-5 py-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-primary">Agreement extracted</span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 font-medium">
                  Ready for approval
                </span>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Participant', value: 'DJ Alex' },
                    { label: 'Agreement type', value: 'Revenue share' },
                    { label: 'Amount', value: '10%', highlight: true },
                    { label: 'Basis', value: 'Ticket sales' },
                  ].map((row) => (
                    <div key={row.label}>
                      <div className="text-[10px] text-muted-foreground mb-0.5">{row.label}</div>
                      <div className={`text-sm font-semibold ${row.highlight ? 'text-primary' : 'text-foreground'}`}>
                        {row.value}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-4">
                  <div className="w-full rounded-lg bg-primary text-primary-foreground px-3 py-2 text-center text-xs font-semibold">
                    Send for approval
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PublicLandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Nav */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <span className="text-xl font-bold text-primary-foreground">P</span>
              </div>
              <span className="text-2xl font-bold">Provvypay</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/auth/login"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="bg-primary text-primary-foreground hover:bg-[rgb(61,92,224)] px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* 1. Hero */}
      <section className="container mx-auto px-6 pt-20 pb-16 lg:pt-32 lg:pb-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full text-sm font-medium text-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              Agreement Intelligence
            </div>

            <h1 className="text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              Every commercial agreement starts in a <span className="text-primary">conversation.</span>
            </h1>

            <p className="text-xl text-muted-foreground leading-relaxed max-w-xl">
              Provvypay structures what was agreed in chat, email and calls — then coordinates obligations through
              settlement.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/auth/signup"
                className="bg-primary text-primary-foreground hover:bg-[rgb(61,92,224)] px-8 py-4 rounded-lg text-base font-semibold transition-all shadow-sm inline-flex items-center justify-center gap-2"
              >
                Start Free
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                href="#demo"
                className="border-2 border-input hover:border-primary/50 bg-background px-8 py-4 rounded-lg text-base font-semibold transition-all inline-flex items-center justify-center gap-2"
              >
                Watch Demo
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent rounded-3xl blur-3xl" />
            <div className="relative">
              <HeroTransformationVisual />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Positioning statement */}
      <section className="border-t border-b bg-muted/30 py-14 lg:py-16">
        <div className="container mx-auto px-6 text-center">
          <p className="text-2xl lg:text-3xl font-semibold text-foreground max-w-3xl mx-auto leading-snug">
            Commercial agreements are created in conversations.
          </p>
          <p className="text-2xl lg:text-3xl font-semibold text-primary max-w-3xl mx-auto leading-snug mt-2">
            Provvypay turns them into structured financial operations.
          </p>
        </div>
      </section>

      {/* 3. Commercial agreements happen everywhere */}
      <section className="py-24 lg:py-32 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-4xl lg:text-5xl font-bold mb-12 leading-tight">
              Commercial agreements happen everywhere.
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              {PROBLEM_CHANNELS.map((ch) => (
                <div
                  key={ch.name}
                  className={`flex flex-col items-center gap-3 rounded-2xl border-2 px-5 py-6 shadow-sm ${ch.tone}`}
                >
                  <ChannelGlyph name={ch.name} />
                  <span className="text-base font-semibold">{ch.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Reconciliation problem */}
      <section className="py-20 lg:py-28 bg-muted/40 border-y">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-sm font-semibold text-red-600/80 uppercase tracking-wide mb-4">The reconciliation problem</p>
              <h2 className="text-3xl lg:text-4xl font-bold mb-6 leading-tight">
                But finance and operations teams still reconcile them manually.
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Deals agreed in messages become spreadsheets, disputes and delayed payouts.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {RECONCILIATION_PAIN.map((point) => (
                <div
                  key={point}
                  className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50/60 px-5 py-4 shadow-sm"
                >
                  <div className="w-8 h-8 rounded-full bg-red-100 flex-shrink-0 flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-foreground/85">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Before vs After */}
      <section className="py-20 lg:py-28 bg-background">
        <div className="container mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl lg:text-4xl font-bold">From conversation chaos to structured operations.</h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
            <div className="rounded-2xl border bg-muted/30 p-8">
              <div className="flex items-center gap-2 mb-8">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <span className="font-bold text-xl text-foreground">Before</span>
              </div>

              <div className="space-y-2">
                {(['WhatsApp', 'Email', 'Messenger', 'Slack', 'Phone calls'] as const).map((ch) => (
                  <div key={ch} className="flex items-center gap-3 rounded-xl bg-background border px-4 py-3">
                    <ChannelGlyph name={ch} />
                    <span className="text-sm font-medium">{ch}</span>
                  </div>
                ))}
              </div>

              <FlowArrow className="text-red-300" />

              <div className="space-y-2">
                {(['Spreadsheets', 'Manual tracking', 'Payment disputes', 'Delayed settlement'] as const).map(
                  (item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50/70 px-4 py-3"
                    >
                      <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                      <span className="text-sm font-semibold text-red-900">{item}</span>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="rounded-2xl border-2 border-primary/30 bg-primary/[0.03] p-8 shadow-md">
              <div className="flex items-center gap-2 mb-8">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="font-bold text-xl text-foreground">After</span>
              </div>

              <div className="space-y-0">
                {TRANSFORMATION_STEPS.map((step, i) => (
                  <div key={step}>
                    <div
                      className={`rounded-xl border px-5 py-4 text-center ${
                        i === 1
                          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                          : i === TRANSFORMATION_STEPS.length - 1
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                            : 'border-border bg-background'
                      }`}
                    >
                      <span className="text-sm font-bold tracking-wide">{step}</span>
                    </div>
                    {i < TRANSFORMATION_STEPS.length - 1 ? <FlowArrow className="text-primary/25" /> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Agreement Intelligence */}
      <section className="py-20 lg:py-28 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center max-w-5xl mx-auto">
            <div className="space-y-8">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-primary-foreground/60 mb-3">
                  The core product
                </p>
                <h2 className="text-4xl lg:text-5xl font-bold mb-5">Agreement Intelligence</h2>
                <p className="text-xl text-primary-foreground/80 leading-relaxed">
                  Import conversations from any channel. Provvypay extracts commercial terms, generates agreements and
                  connects them to settlement workflows.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  'Extract terms',
                  'Identify participants',
                  'Generate agreements',
                  'Connect to settlement',
                ].map((outcome) => (
                  <div
                    key={outcome}
                    className="rounded-xl bg-primary-foreground/10 border border-primary-foreground/10 px-4 py-3 text-sm font-semibold text-primary-foreground/90"
                  >
                    {outcome}
                  </div>
                ))}
              </div>

              <Link
                href="/auth/signup"
                className="inline-flex items-center gap-2 bg-primary-foreground text-primary px-7 py-3.5 rounded-lg font-semibold transition-all hover:bg-primary-foreground/90"
              >
                Try Agreement Intelligence
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>

            <div className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-6 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/50 mb-4">
                The transformation
              </p>
              {TRANSFORMATION_STEPS.map((step, i) => (
                <div key={step} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-foreground/15 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <span className="text-base font-semibold">{step}</span>
                  {i < TRANSFORMATION_STEPS.length - 1 ? (
                    <svg
                      className="w-4 h-4 text-primary-foreground/30 ml-auto hidden sm:block"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 7. Demo */}
      <div id="demo">
        <DemoSection />
      </div>

      {/* 8. Capture → Structure → Coordinate */}
      <section className="bg-muted/50 py-20 border-t">
        <div className="container mx-auto px-6">
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">How it works</p>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Capture → Structure → Coordinate</h2>
            <p className="text-lg text-muted-foreground">Three steps from conversation to settlement.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {WORKFLOW_CARDS.map((card, i) => (
              <div key={card.label} className="rounded-2xl border bg-background p-8 shadow-sm relative text-center md:text-left">
                <div className="absolute top-6 right-6 text-4xl font-black text-muted-foreground/10 select-none">
                  {card.step}
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 mx-auto md:mx-0">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
                  </svg>
                </div>
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">{card.label}</div>
                <h3 className="text-lg font-bold leading-snug">{card.title}</h3>
                {i < WORKFLOW_CARDS.length - 1 ? (
                  <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-background border items-center justify-center">
                    <svg className="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Pricing */}
      <section className="bg-background py-20 border-t">
        <div className="container mx-auto px-6">
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">Pricing</p>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
            <p className="text-lg text-muted-foreground">Start free and scale as your operation grows.</p>
          </div>

          <div className="max-w-5xl mx-auto">
            {PRICING_SECTIONS.filter((s) => s.featured).map((section) => (
              <div
                key={section.name}
                className="mb-8 rounded-3xl border-[3px] border-primary bg-gradient-to-br from-primary/8 via-primary/5 to-background p-8 lg:p-10 shadow-xl ring-4 ring-primary/10 scale-[1.02] origin-center"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl lg:text-3xl font-bold">{section.name}</h3>
                      <span className="bg-primary text-primary-foreground text-xs font-bold px-3.5 py-1.5 rounded-full shadow-sm">
                        {section.badge}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Agreement Intelligence included. The natural starting point for revenue share operations.
                    </p>
                  </div>
                  <Link
                    href="/auth/signup"
                    className="bg-primary text-primary-foreground hover:bg-[rgb(61,92,224)] px-8 py-3 rounded-lg text-sm font-semibold transition-all whitespace-nowrap shadow-md"
                  >
                    Get started
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {section.plans.map((plan) => (
                    <div
                      key={plan.name}
                      className={`rounded-xl border px-5 py-4 ${
                        plan.popular
                          ? 'bg-primary text-primary-foreground border-primary shadow-lg scale-105'
                          : 'bg-background border-border'
                      }`}
                    >
                      <div className={`text-xs mb-1 ${plan.popular ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {plan.name}
                        {plan.popular ? ' · Popular' : ''}
                      </div>
                      <div className="font-bold text-lg">{plan.price}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="grid md:grid-cols-3 gap-4 opacity-90">
              {PRICING_SECTIONS.filter((s) => !s.featured).map((section) => (
                <div key={section.name} className="rounded-xl border bg-background p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <h3 className="font-semibold text-base leading-tight">{section.name}</h3>
                    {'badge' in section && section.badge ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border whitespace-nowrap">
                        {section.badge}
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-2.5">
                    {section.plans.map((plan) => (
                      <div key={plan.name} className="rounded-lg border bg-muted/30 px-3 py-2.5">
                        <div className="text-xs text-muted-foreground">{plan.name}</div>
                        <div className="font-semibold text-sm mt-0.5">{plan.price}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-center text-sm text-muted-foreground mt-8">
              No transaction fees shown. No AI credit pricing.{' '}
              <Link href="/auth/signup" className="text-primary hover:underline font-medium">
                Start free
              </Link>{' '}
              and upgrade as you grow.
            </p>
          </div>
        </div>
      </section>

      {/* 10. CTA */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-3xl p-12 lg:p-16 text-center border-2 border-primary/20">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Stop managing commercial agreements in spreadsheets.
            </h2>
            <p className="text-lg text-muted-foreground mb-2 max-w-2xl mx-auto">Capture agreements where they happen.</p>
            <p className="text-lg text-muted-foreground mb-2 max-w-2xl mx-auto">Track obligations automatically.</p>
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">Coordinate settlement with confidence.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth/signup"
                className="bg-primary text-primary-foreground hover:bg-[rgb(61,92,224)] px-8 py-4 rounded-lg text-base font-semibold transition-all shadow-sm inline-flex items-center justify-center gap-2"
              >
                Start Free
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                href="/auth/login"
                className="border-2 border-input hover:border-primary/50 bg-background px-8 py-4 rounded-lg text-base font-semibold transition-all inline-flex items-center justify-center"
              >
                Book Demo
              </Link>
            </div>
            <p className="text-sm text-muted-foreground mt-6">No credit card required · Set up your workspace in minutes</p>
          </div>
        </div>
      </section>

      {/* 11. Footer */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <span className="text-lg font-bold text-primary-foreground">P</span>
                </div>
                <span className="text-xl font-bold">Provvypay</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Agreement Intelligence for commercial operations. Turn conversations into structured obligations,
                approvals and settlement workflows.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {FOOTER_PRODUCT_LINKS.map((label) => (
                  <li key={label}>
                    <Link href="/auth/signup" className="hover:text-primary transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/legal/privacy" className="hover:text-primary transition-colors">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/legal/terms" className="hover:text-primary transition-colors">
                    Terms
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/auth/login" className="hover:text-primary transition-colors">
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link href="/auth/signup" className="hover:text-primary transition-colors">
                    Sign Up
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>© 2026 Provvypay. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href="/legal/privacy" className="hover:text-primary transition-colors">
                Privacy Policy
              </Link>
              <Link href="/legal/terms" className="hover:text-primary transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
