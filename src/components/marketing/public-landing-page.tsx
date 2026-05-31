import Link from 'next/link';

const PROBLEM_POINTS = [
  'Agreements not documented',
  'Different terms across channels',
  'Unclear who is owed what',
  'Missing invoices and receipts',
  'Manual spreadsheets',
  'Payment disputes and delays',
] as const;

const AI_FEATURES = [
  'Extract commercial terms automatically',
  'Detect revenue shares, fees and obligations',
  'Identify participants',
  'Generate draft agreements',
  'Preserve supporting conversation history',
  'Connect agreements to settlement workflows',
] as const;

const WORKFLOW_CARDS = [
  {
    step: '01',
    label: 'Capture',
    title: 'Import conversations from anywhere.',
    description: 'WhatsApp, email, meeting notes and commercial discussions.',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  },
  {
    step: '02',
    label: 'Structure',
    title: 'Extract terms and generate agreements.',
    description: 'Automatically identify participants, obligations and compensation structures.',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    step: '03',
    label: 'Coordinate',
    title: 'Track obligations through settlement.',
    description: 'Monitor approvals, funding readiness and payout coordination.',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  },
] as const;

const PRICING_SECTIONS = [
  {
    name: 'Payment Links',
    plans: [
      { name: 'Starter', price: 'Free', popular: false },
      { name: 'Growth', price: '$29/month', popular: false },
      { name: 'Expand', price: '$79/month', popular: false },
    ],
  },
  {
    name: 'Revenue Share',
    badge: 'Most Popular',
    plans: [
      { name: 'Launch', price: '$149/month', popular: false },
      { name: 'Growth', price: '$349/month', popular: true },
      { name: 'Multi-Entity', price: "Let's Talk", popular: false },
    ],
  },
  {
    name: 'Accountant Partner',
    plans: [
      { name: 'Partner', price: '$149/month', popular: false },
    ],
  },
  {
    name: 'Payments Intelligence Layer',
    badge: 'Coming Soon',
    plans: [
      { name: 'Enterprise', price: 'Talk To Us', popular: false },
    ],
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

function HeroAgreementMockup() {
  return (
    <div className="relative bg-white rounded-2xl shadow-2xl border overflow-hidden">
      <div className="bg-muted/40 border-b px-5 py-3 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Agreement Intelligence
        </div>
        <div className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-semibold border border-emerald-200">
          Processing
        </div>
      </div>

      <div className="p-5 lg:p-6 space-y-5">
        <div className="space-y-2">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Source conversation · WhatsApp
          </div>
          <div className="rounded-lg bg-muted/30 border p-3 space-y-2 text-xs">
            <div className="flex gap-2">
              <div className="w-5 h-5 rounded-full bg-emerald-100 flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-emerald-700">G</div>
              <div className="bg-white rounded-lg px-2.5 py-1.5 border text-[11px] leading-relaxed max-w-[85%]">
                Hi — confirming the energy management agreement. GreenField Solar at 5% monthly fee, 3-year term with 2-year extension option. Net 15 payment terms.
              </div>
            </div>
            <div className="flex gap-2 flex-row-reverse">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-primary">P</div>
              <div className="bg-primary/5 rounded-lg px-2.5 py-1.5 border border-primary/10 text-[11px] leading-relaxed max-w-[85%]">
                Confirmed. ProvvyPay Energy agrees to those terms.
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <div className="flex flex-col items-center gap-1">
            <div className="text-[10px] text-muted-foreground font-medium">Agreement Intelligence</div>
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Extracted agreement
          </div>
          <div className="rounded-lg border bg-muted/20 p-3 space-y-2 text-xs">
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="font-semibold text-sm">Energy Management Agreement</span>
              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-medium rounded border border-emerald-200">High confidence</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <div>
                <div className="text-[10px] text-muted-foreground">Operator</div>
                <div className="font-medium">GreenField Solar</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">Counterparty</div>
                <div className="font-medium">ProvvyPay Energy</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">Fee structure</div>
                <div className="font-medium text-primary">5% monthly</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">Payment terms</div>
                <div className="font-medium">Net 15 days</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">Term</div>
                <div className="font-medium">3 years</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">Extension</div>
                <div className="font-medium">2 years optional</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 rounded-lg border bg-primary text-primary-foreground px-3 py-2 text-center text-xs font-semibold">
            Generate Agreement
          </div>
          <div className="flex-1 rounded-lg border px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
            Edit Terms
          </div>
        </div>
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
          {/* Left — conversation */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
              Conversation
            </div>
            <div className="rounded-2xl border bg-muted/20 p-5 space-y-3">
              {[
                { side: 'left', initial: 'S', color: 'bg-blue-100 text-blue-700', text: "We'll pay you 10% of ticket sales for Saturday." },
                { side: 'right', initial: 'D', color: 'bg-emerald-100 text-emerald-700', text: 'Sounds good.' },
                { side: 'left', initial: 'S', color: 'bg-blue-100 text-blue-700', text: 'Agreed.' },
              ].map((msg, i) => (
                <div key={i} className={`flex gap-2.5 ${msg.side === 'right' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${msg.color}`}>
                    {msg.initial}
                  </div>
                  <div className={`rounded-xl px-3.5 py-2.5 text-sm max-w-[75%] ${
                    msg.side === 'left'
                      ? 'bg-white border'
                      : 'bg-primary/10 border border-primary/10'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Flow */}
            <div className="flex items-center justify-center gap-2 pt-4 text-xs text-muted-foreground font-medium">
              {['Conversation', 'Agreement', 'Approval', 'Settlement'].map((step, i, arr) => (
                <span key={step} className="flex items-center gap-2">
                  <span className={i === 0 ? 'text-primary font-semibold' : ''}>{step}</span>
                  {i < arr.length - 1 && (
                    <svg className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Right — output */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
              Agreement Intelligence output
            </div>
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
              <div className="bg-primary/5 border-b px-5 py-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-primary">Agreement extracted</span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 font-medium">Ready for approval</span>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Participant', value: 'DJ Alex' },
                    { label: 'Agreement type', value: 'Revenue share' },
                    { label: 'Amount', value: '10%', highlight: true },
                    { label: 'Basis', value: 'Ticket sales' },
                    { label: 'Event', value: 'Saturday event' },
                    { label: 'Status', value: 'Ready for approval', green: true },
                  ].map((row) => (
                    <div key={row.label}>
                      <div className="text-[10px] text-muted-foreground mb-0.5">{row.label}</div>
                      <div className={`text-sm font-semibold ${row.highlight ? 'text-primary' : row.green ? 'text-emerald-700' : 'text-foreground'}`}>
                        {row.value}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-4 flex gap-2">
                  <div className="flex-1 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-center text-xs font-semibold">
                    Send for approval
                  </div>
                  <div className="rounded-lg border px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
                    Edit
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
              <Link href="/auth/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Sign in
              </Link>
              <Link href="/auth/signup" className="bg-primary text-primary-foreground hover:bg-[rgb(61,92,224)] px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-6 pt-20 pb-16 lg:pt-32 lg:pb-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full text-sm font-medium text-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              Agreement Intelligence
            </div>

            <h1 className="text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              Every commercial agreement starts in a{' '}
              <span className="text-primary">conversation.</span>
            </h1>

            <p className="text-xl text-muted-foreground leading-relaxed">
              Import WhatsApp messages, emails, meeting notes and commercial discussions.
              <br className="hidden lg:block" />
              Provvypay extracts terms, generates agreements, tracks obligations and coordinates settlement.
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
                href="/auth/login"
                className="border-2 border-input hover:border-primary/50 bg-background px-8 py-4 rounded-lg text-base font-semibold transition-all inline-flex items-center justify-center gap-2"
              >
                Watch Demo
              </Link>
            </div>

            <div className="flex items-center gap-8 pt-4">
              <div className="text-sm">
                <div className="font-semibold text-foreground">Any conversation channel</div>
                <div className="text-muted-foreground">WhatsApp, email, Slack, SMS, meetings</div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="text-sm">
                <div className="font-semibold text-foreground">Agreement to settlement</div>
                <div className="text-muted-foreground">Obligations, approvals and payout tracking</div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent rounded-3xl blur-3xl" />
            <div className="relative">
              <HeroAgreementMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Problem section */}
      <section className="py-20 lg:py-24 border-t bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-14">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">
              Commercial agreements happen everywhere.
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed">
              WhatsApp.<br />
              Email.<br />
              Messenger.<br />
              Slack.<br />
              Phone calls.<br />
              Meeting notes.
            </p>
            <p className="text-lg text-muted-foreground mt-6 font-medium">
              But finance and operations teams still reconcile them manually.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {PROBLEM_POINTS.map((point) => (
              <div
                key={point}
                className="flex items-center gap-3 rounded-xl border bg-red-50/40 border-red-100 px-4 py-3.5"
              >
                <div className="w-6 h-6 rounded-full bg-red-100 flex-shrink-0 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-foreground/80">{point}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agreement Intelligence centerpiece */}
      <section className="py-20 lg:py-28 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-primary-foreground/60 mb-3">
                  The core product
                </p>
                <h2 className="text-4xl lg:text-5xl font-bold mb-5">Agreement Intelligence</h2>
                <p className="text-xl text-primary-foreground/80 leading-relaxed">
                  Import WhatsApp messages, emails and meeting notes.
                  Provvypay identifies participants, extracts commercial terms, creates draft agreements
                  and connects them to settlement workflows.
                </p>
              </div>

              <ul className="space-y-3">
                {AI_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary-foreground/20 flex-shrink-0 flex items-center justify-center mt-0.5">
                      <svg className="w-3 h-3 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-primary-foreground/90 text-base">{feature}</span>
                  </li>
                ))}
              </ul>

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

            {/* Channel logos */}
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-primary-foreground/60 mb-6">
                Import from any channel
              </p>
              {[
                { name: 'WhatsApp', desc: 'Voice notes, messages and group chats' },
                { name: 'Email', desc: 'Threads, attachments and replies' },
                { name: 'Slack', desc: 'Direct messages and channels' },
                { name: 'Messenger', desc: 'Facebook and Instagram business messages' },
                { name: 'Meeting notes', desc: 'Minutes, call summaries and documents' },
                { name: 'SMS', desc: 'Text messages and confirmations' },
              ].map((channel) => (
                <div
                  key={channel.name}
                  className="flex items-center gap-4 rounded-xl bg-primary-foreground/10 border border-primary-foreground/10 px-4 py-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-primary-foreground">{channel.name}</div>
                    <div className="text-xs text-primary-foreground/60">{channel.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Demo section */}
      <DemoSection />

      {/* CAPTURE / STRUCTURE / COORDINATE */}
      <section className="bg-muted/50 py-20 border-t">
        <div className="container mx-auto px-6">
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">How it works</p>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Simple by design</h2>
            <p className="text-lg text-muted-foreground">
              Three steps from conversation to coordinated settlement.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {WORKFLOW_CARDS.map((card, i) => (
              <div key={card.label} className="rounded-2xl border bg-background p-8 shadow-sm relative">
                <div className="absolute top-6 right-6 text-4xl font-black text-muted-foreground/10 select-none">
                  {card.step}
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
                  </svg>
                </div>
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">{card.label}</div>
                <h3 className="text-lg font-bold mb-2 leading-snug">{card.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{card.description}</p>
                {i < WORKFLOW_CARDS.length - 1 && (
                  <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-background border items-center justify-center">
                    <svg className="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-background py-20 border-t">
        <div className="container mx-auto px-6">
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">Pricing</p>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
            <p className="text-lg text-muted-foreground">Start free and scale as your operation grows.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {PRICING_SECTIONS.map((section) => (
              <div
                key={section.name}
                className={`rounded-xl border bg-background p-6 shadow-sm ${
                  section.name === 'Revenue Share' ? 'ring-2 ring-primary/20 border-primary/30' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-4">
                  <h3 className="font-semibold text-base leading-tight">{section.name}</h3>
                  {'badge' in section && section.badge ? (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                      section.badge === 'Most Popular'
                        ? 'bg-primary/10 text-primary border-primary/20'
                        : 'bg-muted text-muted-foreground border-border'
                    }`}>
                      {section.badge}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-3">
                  {section.plans.map((plan) => (
                    <div
                      key={plan.name}
                      className={`rounded-lg border px-3 py-2.5 ${plan.popular ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'}`}
                    >
                      <div className="text-xs text-muted-foreground">{plan.name}</div>
                      <div className="font-semibold text-sm mt-0.5">{plan.price}</div>
                    </div>
                  ))}
                </div>
                {section.name === 'Revenue Share' && (
                  <p className="text-[11px] text-muted-foreground mt-3">Agreement Intelligence included</p>
                )}
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-10">
            No transaction fees shown. No AI credit pricing.{' '}
            <Link href="/auth/signup" className="text-primary hover:underline font-medium">Start free</Link>{' '}
            and upgrade as you grow.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-3xl p-12 lg:p-16 text-center border-2 border-primary/20">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Stop managing commercial agreements in spreadsheets.
            </h2>
            <p className="text-lg text-muted-foreground mb-2 max-w-2xl mx-auto">
              Capture agreements where they happen.
            </p>
            <p className="text-lg text-muted-foreground mb-2 max-w-2xl mx-auto">
              Track obligations automatically.
            </p>
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
              Coordinate settlement with confidence.
            </p>
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

      {/* Footer */}
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
                Agreement Intelligence for commercial operations. Turn conversations into
                structured obligations, approvals and settlement workflows.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {FOOTER_PRODUCT_LINKS.map((label) => (
                  <li key={label}>
                    <Link href="/auth/signup" className="hover:text-primary transition-colors">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/legal/privacy" className="hover:text-primary transition-colors">Privacy</Link></li>
                <li><Link href="/legal/terms" className="hover:text-primary transition-colors">Terms</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/auth/login" className="hover:text-primary transition-colors">Sign In</Link></li>
                <li><Link href="/auth/signup" className="hover:text-primary transition-colors">Sign Up</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>© 2026 Provvypay. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href="/legal/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
              <Link href="/legal/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}