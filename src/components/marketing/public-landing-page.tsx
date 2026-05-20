import Link from 'next/link';

type PayoutStatusTone = 'green' | 'amber' | 'blue' | 'red' | 'muted';

const WORKFLOW_STEPS = [
  {
    step: '1',
    title: 'Venue creates the event',
    description:
      'Beach Club Bali opens Saturday Beach Event with date, venue entity, and ops owner assigned before tickets sell.',
    bridge: null,
    footer: 'Project live · finance team notified.',
    preview: {
      label: 'Saturday Beach Event',
      sublabel: 'Beach Club Bali (PT)',
      rows: [
        { k: 'Date', v: 'Sat, 24 May' },
        { k: 'Ops owner', v: 'Finance team' },
        { k: 'Status', v: 'Active', highlight: true },
      ],
    },
  },
  {
    step: '2',
    title: 'Participants are added',
    description:
      'Promoter, DJ, supplier, contractor, affiliate, and venue management linked to the event.',
    bridge: 'Six parties on one event.',
    footer: 'Roles and payout terms recorded.',
    preview: {
      label: 'Participants (6)',
      rows: [
        { k: 'Promoter', v: 'Island Events', status: 'Terms agreed' },
        { k: 'DJ', v: 'DJ Alex', status: 'Fixed fee' },
        { k: 'Supplier', v: 'Elite Beverages', status: 'Invoice on file' },
        { k: 'Contractor', v: 'Stage & Production', status: 'Onboarding incomplete' },
        { k: 'Affiliate', v: 'Coastal Media', status: 'Referral % set' },
        { k: 'Venue mgmt', v: 'Beach Club Bali', status: 'Operator' },
      ],
    },
  },
  {
    step: '3',
    title: 'Revenue is collected',
    description:
      'Ticketing, bookings, sponsorship, and table sales post to the project ledger.',
    bridge: 'Revenue posts against the event.',
    footer: '$66,500 collected · linked to project.',
    preview: {
      label: 'Revenue streams',
      total: '$66,500',
      rows: [
        { k: 'Ticketing', v: '$18,750' },
        { k: 'Bookings', v: '$22,300' },
        { k: 'Sponsorship', v: '$10,000' },
        { k: 'Table sales', v: '$15,450' },
      ],
    },
  },
  {
    step: '4',
    title: 'Obligations are structured',
    description:
      'Promoter share, DJ fee, supplier INV-1045, contractor %, and venue split each carry a payout state.',
    bridge: 'INV-1045 attached to the event.',
    footer: 'Obligations linked · payout states assigned.',
    preview: {
      label: 'Obligations on event',
      rows: [
        { k: 'Promoter', v: '$7,425', note: '15% net', status: 'Payout ready' },
        { k: 'DJ', v: '$5,000', note: 'Fixed', status: 'Partially funded' },
        { k: 'Supplier', v: '$6,800', note: 'INV-1045', status: 'Pending approval' },
        { k: 'Contractor', v: '$4,950', note: '10% net', status: 'Payout blocked' },
      ],
    },
  },
  {
    step: '5',
    title: 'Finance reviews settlement',
    description:
      'Ops sees what can be paid, what is unfunded, and what is waiting on onboarding or reconciliation.',
    bridge: 'Finance signs off before release.',
    footer: 'Settlement queue ready for review.',
    preview: {
      label: 'Settlement queue',
      bars: [
        { label: 'Can pay now', value: '$12,425', pct: 19, tone: 'green' as const },
        { label: 'Partially funded', value: '$5,000', pct: 8, tone: 'blue' as const },
        { label: 'Still unfunded', value: '$23,275', pct: 35, tone: 'amber' as const },
        { label: 'Held / blocked', value: '$4,950', pct: 7, tone: 'red' as const },
      ],
      status: '2 awaiting reconciliation',
      audit: true,
    },
  },
] as const;

const OUTCOME_HIGHLIGHTS = [
  { title: 'Know what can be paid', description: 'Payout-ready lines separated from blocked or pending.' },
  { title: 'See what remains unfunded', description: 'Outstanding obligations with amounts, not guesses.' },
  { title: 'Track payout readiness', description: 'Funded, partial, and held states per participant.' },
  { title: 'Reduce reconciliation work', description: 'Fewer manual Xero checks and spreadsheet exports.' },
  { title: 'Records for your accountant', description: 'Structured history per event and per party.' },
] as const;

const FEATURES = [
  {
    outcome: 'No more chasing payout spreadsheets',
    title: 'One register for every party on the event',
    description:
      'Promoters, DJs, suppliers, contractors, and affiliates with obligations and amounts in one register.',
    iconPaths: [
      'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    ],
  },
  {
    outcome: 'No more manual reconciliation checks',
    title: 'Xero sync tied to the event',
    description:
      'Postings follow the project structure your finance team already uses. Less end-of-week matching and fewer “which event was this?” emails.',
    iconPaths: [
      'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    ],
    emphasized: true,
  },
  {
    outcome: 'No more uncertainty around supplier obligations',
    title: 'Invoices and payouts on the same event',
    description:
      'Supplier INV-1045 sits next to promoter commission and DJ fees. Funded, unfunded, and approval status stay visible before you release payment.',
    iconPaths: [
      'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
      'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
    ],
  },
  {
    outcome: 'No more fragmented settlement tracking',
    title: 'Settlement queue per event',
    description:
      'See partial payouts, pending approvals, onboarding holds, and reconciliation flags before money leaves.',
    iconPaths: [
      'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    ],
  },
  {
    outcome: 'Revenue posted to the right event',
    title: 'Collection without losing the thread',
    description:
      'Stripe and payment links attach to the project so ticketing and table sales stay tied to the obligations they fund.',
    iconPaths: ['M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z'],
  },
] as const;

const EVENT_PARTIES = [
  'Venue',
  'Promoter',
  'DJ',
  'Supplier',
  'Contractor',
  'Affiliate',
] as const;

const OBLIGATION_ROWS: Array<{
  role: string;
  detail: string;
  amount: string;
  funding: string;
  payoutState: string;
  tone: PayoutStatusTone;
}> = [
  {
    role: 'Promoter · Island Events',
    detail: '15% net revenue share',
    amount: '$7,425',
    funding: 'Funded',
    payoutState: 'Payout ready',
    tone: 'green',
  },
  {
    role: 'DJ · DJ Alex',
    detail: 'Fixed fee agreement',
    amount: '$5,000',
    funding: 'Partially funded',
    payoutState: 'Partially paid',
    tone: 'blue',
  },
  {
    role: 'Supplier · Elite Beverages',
    detail: 'INV-1045 attached',
    amount: '$6,800',
    funding: 'Unfunded',
    payoutState: 'Pending approval',
    tone: 'amber',
  },
  {
    role: 'Contractor · Stage & Production',
    detail: '10% net allocation',
    amount: '$4,950',
    funding: 'Unfunded',
    payoutState: 'Onboarding incomplete',
    tone: 'red',
  },
  {
    role: 'Affiliate · Coastal Media',
    detail: 'Referral commission',
    amount: '$1,200',
    funding: 'Funded',
    payoutState: 'Awaiting reconciliation',
    tone: 'muted',
  },
];

const FOOTER_PRODUCT_LINKS = [
  'Projects',
  'Participants',
  'Obligations',
  'Payouts',
  'Reconciliation',
  'Reporting',
] as const;

function FeatureIcon({ paths }: { paths: string[] }) {
  return (
    <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {paths.map((d) => (
        <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
      ))}
    </svg>
  );
}

function WorkflowStepPreview({
  preview,
}: {
  preview: (typeof WORKFLOW_STEPS)[number]['preview'];
}) {
  if ('bars' in preview) {
    return (
      <div className="mt-4 rounded-lg border bg-muted/30 p-3 space-y-3 text-sm">
        <div className="font-medium text-foreground">{preview.label}</div>
        {preview.bars.map((bar) => (
          <div key={bar.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">{bar.label}</span>
              <span className="font-mono font-medium">{bar.value}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  bar.tone === 'green'
                    ? 'bg-green-600'
                    : bar.tone === 'amber'
                      ? 'bg-amber-500'
                      : bar.tone === 'blue'
                        ? 'bg-blue-500'
                        : bar.tone === 'red'
                          ? 'bg-red-400'
                          : 'bg-primary/40'
                }`}
                style={{ width: `${bar.pct}%` }}
              />
            </div>
          </div>
        ))}
        <div className="flex justify-between pt-1 border-t text-xs">
          <span className="text-muted-foreground">Status</span>
          <span className="text-green-700 font-medium">{preview.status}</span>
        </div>
        {preview.audit ? (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Audit-ready</span>
            <span className="text-primary font-medium">Yes · Exportable</span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
      <div>
        <div className="font-medium text-foreground">{preview.label}</div>
        {'sublabel' in preview && preview.sublabel ? (
          <div className="text-xs text-muted-foreground">{preview.sublabel}</div>
        ) : null}
      </div>
      {preview.rows.map((row) => (
        <div key={row.k} className="flex justify-between gap-2 text-xs items-start">
          <span className="text-muted-foreground shrink-0">{row.k}</span>
          <div className="text-right min-w-0">
            <span
              className={`font-medium ${
                'highlight' in row && row.highlight ? 'text-green-700' : 'font-mono'
              }`}
            >
              {row.v}
            </span>
            {'note' in row && row.note ? (
              <span className="block text-[10px] text-muted-foreground font-sans">{row.note}</span>
            ) : null}
            {'status' in row && row.status ? (
              <span className="block text-[10px] text-primary font-medium mt-0.5">{row.status}</span>
            ) : null}
          </div>
        </div>
      ))}
      {'total' in preview && preview.total ? (
        <div className="flex justify-between pt-2 border-t text-xs font-semibold">
          <span>Total revenue</span>
          <span className="font-mono text-primary">{preview.total}</span>
        </div>
      ) : null}
    </div>
  );
}

const FUNDING_BADGE: Record<PayoutStatusTone, string> = {
  green: 'text-green-700 bg-green-50 border-green-200',
  amber: 'text-amber-700 bg-amber-50 border-amber-200',
  blue: 'text-blue-700 bg-blue-50 border-blue-200',
  red: 'text-red-700 bg-red-50 border-red-200',
  muted: 'text-muted-foreground bg-muted border-border',
};

function HeroCoordinationMockup() {
  return (
    <div className="relative bg-white rounded-2xl shadow-2xl p-6 lg:p-8 border">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3 pb-4 border-b">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Multi-party settlement · Saturday Beach Event
            </div>
            <div className="font-semibold mt-1">Beach Club Bali</div>
            <div className="text-sm text-muted-foreground">6 parties · finance review pending</div>
          </div>
          <div className="px-2.5 py-1 bg-amber-50 text-amber-800 rounded-full text-[10px] font-semibold border border-amber-200 whitespace-nowrap">
            2 pending release
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {EVENT_PARTIES.map((party) => (
            <span
              key={party}
              className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-medium text-muted-foreground border"
            >
              {party}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/50 p-2.5">
            <div className="text-[10px] text-muted-foreground">Revenue in</div>
            <div className="font-semibold font-mono text-base mt-0.5">$66,500</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5">
            <div className="text-[10px] text-muted-foreground">Payout ready</div>
            <div className="font-semibold font-mono text-base mt-0.5 text-green-700">$12,425</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5">
            <div className="text-[10px] text-muted-foreground">Unfunded</div>
            <div className="font-semibold font-mono text-base mt-0.5 text-amber-700">$28,225</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Obligations by participant
            </div>
            <span className="text-[10px] text-muted-foreground">Mixed payout states</span>
          </div>
          {OBLIGATION_ROWS.map((row) => (
            <div
              key={row.role}
              className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{row.role}</div>
                <div className="text-muted-foreground truncate">{row.detail}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono font-semibold">{row.amount}</div>
                <div className="flex flex-col items-end gap-0.5 mt-0.5">
                  <span
                    className={`px-1.5 py-0 rounded text-[10px] font-medium border ${FUNDING_BADGE[row.tone]}`}
                  >
                    {row.funding}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{row.payoutState}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded border px-2.5 py-2">
            <span className="text-muted-foreground">Xero</span>
            <div className="font-medium text-foreground mt-0.5">Synced</div>
          </div>
          <div className="rounded border px-2.5 py-2">
            <span className="text-muted-foreground">Reconciliation</span>
            <div className="font-medium text-amber-700 mt-0.5">2 lines awaiting</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PublicLandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
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

      <section className="container mx-auto px-6 pt-20 pb-16 lg:pt-32 lg:pb-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full text-sm font-medium text-primary">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Multi-party payout coordination
            </div>

            <h1 className="text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              Coordinate payouts in{' '}
              <span className="text-primary">real time</span>
            </h1>

            <p className="text-xl text-muted-foreground leading-relaxed">
              Track what is funded, owed, and ready to settle across venues, promoters, DJs,
              suppliers, and contractors. One workspace for obligations, payout readiness, and Xero
              reconciliation. Built for finance and operations teams managing multi-party events.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/auth/signup"
                className="bg-primary text-primary-foreground hover:bg-[rgb(61,92,224)] px-8 py-4 rounded-lg text-base font-semibold transition-all shadow-sm inline-flex items-center justify-center gap-2"
              >
                Start for Free
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </Link>
              <Link
                href="/auth/login"
                className="border-2 border-input hover:border-primary/50 bg-background px-8 py-4 rounded-lg text-base font-semibold transition-all inline-flex items-center justify-center gap-2"
              >
                Sign In
              </Link>
            </div>

            <div className="flex items-center gap-8 pt-4">
              <div className="text-sm">
                <div className="font-semibold text-foreground">6+ parties per event</div>
                <div className="text-muted-foreground">Venues, promoters, suppliers</div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="text-sm">
                <div className="font-semibold text-foreground">Xero sync included</div>
                <div className="text-muted-foreground">Fewer manual reconciliation checks</div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent rounded-3xl blur-3xl" />
            <div className="relative">
              <HeroCoordinationMockup />
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 border-t bg-background">
        <div className="container mx-auto px-6">
          <div className="text-center mb-6 max-w-3xl mx-auto">
            <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">
              How Provvypay works
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Beach club event lifecycle
            </h2>
            <p className="text-lg text-muted-foreground">
              How a venue runs Saturday Beach Event from setup through settlement: six parties,
              mixed payout states, and finance sign-off before release.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-5 lg:gap-4 mt-14">
            {WORKFLOW_STEPS.map((item, index) => (
              <div key={item.step} className="relative flex flex-col">
                {item.bridge && index > 0 ? (
                  <p className="hidden lg:block text-[11px] text-muted-foreground mb-3 -mt-2 leading-snug">
                    {item.bridge}
                  </p>
                ) : (
                  <div className="hidden lg:block h-5 mb-3" aria-hidden />
                )}

                <div className="flex flex-col h-full rounded-xl border bg-card p-5 shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-base font-semibold mb-2 leading-snug">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                    {item.description}
                  </p>
                  <WorkflowStepPreview preview={item.preview} />
                  <p className="text-xs text-muted-foreground mt-3 pt-3 border-t italic">
                    {item.footer}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {OUTCOME_HIGHLIGHTS.map((item) => (
              <div
                key={item.title}
                className="rounded-lg border bg-muted/30 px-4 py-4 text-center sm:text-left"
              >
                <div className="text-sm font-semibold mb-1">{item.title}</div>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-10 max-w-2xl mx-auto">
            Used by venues, event operators, and agencies that coordinate payouts across multiple
            parties beyond merchant-to-customer payments alone.
          </p>
        </div>
      </section>

      <section className="bg-muted/50 py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">What your team stops doing manually</h2>
            <p className="text-lg text-muted-foreground">
              The work finance and ops teams currently spread across spreadsheets, inboxes, and
              payment tools, handled in one operational register.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className={`rounded-xl p-8 shadow-sm border bg-background ${
                  'emphasized' in feature && feature.emphasized
                    ? 'ring-2 ring-primary/20 border-primary/30'
                    : ''
                }`}
              >
                <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">
                  {feature.outcome}
                </p>
                <div className="w-11 h-11 bg-primary/10 rounded-lg flex items-center justify-center mb-5">
                  <FeatureIcon paths={[...feature.iconPaths]} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-3xl p-12 lg:p-16 text-center border-2 border-primary/20">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Ready for structured financial operations?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Bring multi-party obligations, payout coordination, and reconciliation into one
              workspace aligned with how your finance team runs events.
            </p>
            <Link
              href="/auth/signup"
              className="bg-primary text-primary-foreground hover:bg-[rgb(61,92,224)] px-8 py-4 rounded-lg text-base font-semibold transition-all shadow-sm inline-flex items-center gap-2"
            >
              Get Started Free
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Link>
            <p className="text-sm text-muted-foreground mt-6">
              No credit card required · Set up your workspace in minutes
            </p>
          </div>
        </div>
      </section>

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
                Infrastructure for coordinating financial obligations across venues, promoters,
                suppliers, contractors, and finance teams.
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
