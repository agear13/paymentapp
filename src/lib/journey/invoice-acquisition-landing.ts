import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { JOURNEY_ROUTES } from '@/lib/journey/hackathon-journey';
import { landingBusinessFlowItems } from '@/lib/journey/landing-business-flows';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';
import { PLAN_CATALOG } from '@/lib/plans/plan-catalog';
import { PROFESSIONAL_TRIAL_DAYS } from '@/lib/entitlements/professional-trial';

export const INVOICE_ACQUISITION_LANDING_PATH = '/invoice';

export const INVOICE_LANDING_METADATA = {
  title: 'Free Invoice Generator | Create & Download Invoices | Provvy',
  description:
    'Create and download professional invoices free forever. Turn invoices into payment links and unlock payment intelligence with Provvy.',
} as const;

export const INVOICE_LANDING_TRIAL_CTA_HREF = COMMERCIAL_OS_ROUTES.assessment;
export const INVOICE_LANDING_CREATOR_HREF = '#invoice-creator';
export const INVOICE_LANDING_HOW_IT_WORKS_HREF = '#how-it-works';
export const INVOICE_LANDING_COMPARE_HREF = `${JOURNEY_ROUTES.landing}#compare`;

export const INVOICE_LANDING_TRIAL_DAYS = PROFESSIONAL_TRIAL_DAYS;
export const INVOICE_LANDING_PLAN_NAME = PLAN_CATALOG.professional.name;
export const INVOICE_LANDING_TRIAL_CTA_LABEL = 'Start your 30-day free trial';
export const INVOICE_LANDING_PRIMARY_CTA_LABEL = 'Create an invoice free';
export const INVOICE_LANDING_SECONDARY_CTA_LABEL = 'See how it works';
export const INVOICE_LANDING_OFFER_LINE = 'Free forever · No account required to create or download';
export const INVOICE_LANDING_TRIAL_OFFER_LINE = '30 days free · Professional package';

export const INVOICE_LANDING_OBJECTIVE = 'paid-faster';

/** Merchant-facing labels already used on Create Invoice. */
export const INVOICE_LANDING_PAYMENT_ROUTES = [
  'Credit / debit card',
  'Bank transfer',
  'Wise checkout',
  'HashPack',
  'MetaMask',
] as const;

export const INVOICE_LANDING_SITE_NAV = [
  { label: 'Explore', href: `${JOURNEY_ROUTES.landing}#compare` },
  { label: 'Intelligence', href: `${JOURNEY_ROUTES.landing}#payment-intelligence` },
  { label: 'How it works', href: `${JOURNEY_ROUTES.landing}#how-it-works` },
  { label: 'Workflows', href: `${JOURNEY_ROUTES.landing}#workflow-library` },
  { label: 'Pricing', href: `${JOURNEY_ROUTES.landing}#pricing` },
  { label: 'Provvy Labs', href: '/labs' },
] as const;

export const INVOICE_LANDING_COPY = {
  eyebrow: 'Get paid smarter.',
  headline: 'Create invoices for free.',
  headlineAccent: 'Get paid smarter with Provvy.',
  supporting:
    'Create a professional invoice in seconds — manually or from a conversation. Download it free forever, or connect Provvy to turn your invoice into a payment workflow with payment intelligence and business coordination.',
  heroSupporting: 'Create a professional invoice in seconds — manually or from a conversation.',
} as const;

export const INVOICE_LANDING_HOW_IT_WORKS = {
  headline: 'From invoice to paid, when you are ready.',
  steps: [
    {
      n: '01',
      title: 'Create the invoice',
      body: 'Enter the details yourself, or paste a conversation. Provvy fills only what it can identify clearly.',
    },
    {
      n: '02',
      title: 'Preview and download',
      body: 'Review a professional invoice and download it for free — no Provvy account required.',
    },
    {
      n: '03',
      title: 'Turn it into a payment',
      body: 'When you want a payment link, Xero sync or personalised intelligence, create a Provvy account.',
    },
  ],
} as const;

export const INVOICE_LANDING_EXAMPLE_CONVERSATION =
  "Hey Sarah, confirming we'll deliver the campaign by October 15 for $12,000. 50% upfront and the remaining 50% on completion. The remaining balance is due within 14 days of delivery.";

export const INVOICE_LANDING_COMPARISON = {
  headline: 'Start free. Upgrade when you need more.',
  free: {
    title: 'Free invoice',
    price: '$0 forever',
    items: [
      'Create invoices',
      'Create from a conversation',
      'Preview invoices',
      'Download invoices',
      'No account required',
    ],
    cta: 'Create an invoice',
    href: INVOICE_LANDING_CREATOR_HREF,
  },
  professional: {
    title: 'Provvy Professional',
    price: `${INVOICE_LANDING_TRIAL_DAYS} days free`,
    items: professionalInvoiceUpgradeItems(),
    cta: INVOICE_LANDING_TRIAL_CTA_LABEL,
    href: INVOICE_LANDING_TRIAL_CTA_HREF,
  },
};

export const INVOICE_LANDING_PAYMENT_FLOW = {
  headline: 'Your invoice can do more than ask to be paid.',
  body: 'Turn your invoice into a payment link and give your customer more ways to pay through the payment infrastructure available to your business.',
  cta: 'Turn this invoice into a payment link',
  stages: [
    { label: 'Invoice', value: '$12,000 AUD', note: 'Example invoice' },
    { label: 'Payment link', value: 'Pay securely', note: 'Requires a Provvy account' },
    {
      label: 'Available payment routes',
      value: INVOICE_LANDING_PAYMENT_ROUTES.join(' · '),
      note: 'Rails already supported in Provvy',
    },
    { label: 'Payment', value: 'Collected through your connected rails', note: null },
    { label: 'Accounting record', value: 'Xero', note: 'Push when Xero is connected' },
  ],
} as const;

export const INVOICE_LANDING_XERO = {
  headline: 'Already use Xero?',
  subhead: 'Make the invoice flow into your accounting automatically.',
  body: 'Connect Xero to push the invoice into your accounting workflow instead of entering it twice.',
  cta: 'Connect Xero',
} as const;

export const INVOICE_LANDING_INTELLIGENCE = {
  headline: 'The more Provvy knows, the smarter it gets.',
  body: 'Your invoice tells Provvy about the transaction. Connecting your accounting, payment and business systems gives it the context to understand what is happening around it.',
  steps: [
    { label: 'Invoice', question: 'What am I asking to be paid?' },
    { label: 'Connected accounting', question: 'What am I still owed?' },
    { label: 'Payment history', question: 'How does this customer usually pay?' },
    { label: 'Payment infrastructure', question: 'What is the best way to collect or move this money?' },
    { label: 'Business context', question: 'What should I do next?' },
  ],
  advisorLine: 'Here are the opportunities I found.',
  note: 'Provvy can only use information from systems you explicitly connect.',
} as const;

export const INVOICE_LANDING_EXAMPLE_INSIGHTS = {
  headline: 'What Provvy can help you see.',
  eyebrow: 'Example recommendations',
  note: 'These are examples of the kinds of recommendations Provvy can make from an invoice and connected systems. They are not based on your customer data until you connect those systems.',
  items: [
    {
      title: 'Get paid sooner',
      body: 'This invoice uses 30-day terms. You could consider a shorter payment window or an early-payment incentive.',
    },
    {
      title: 'Payment route',
      body: 'This payment may have alternative collection routes available.',
    },
    {
      title: 'Cash flow',
      body: 'Your connected records show upcoming obligations before this invoice is expected to settle.',
    },
    {
      title: 'Commercial terms',
      body: 'Your agreement contains a revenue-share obligation that should be tracked alongside the payment.',
    },
  ],
} as const;

export const INVOICE_LANDING_WORKFLOWS = {
  headline: 'An invoice is one part of the commercial relationship.',
  body: 'Provvy can help coordinate what happens around the money — agreements, people, referrals, revenue sharing, supplier payments and other business workflows.',
  slugs: [
    'revenue-sharing',
    'supplier-payments',
    'referral-management',
    'commercial-operations',
    'autonomous-reconciliation',
  ] as const,
} as const;

export const INVOICE_LANDING_BUSINESSES = {
  headline: 'Built around real business workflows.',
  body: "We've worked with businesses across communities, events, consumer brands and Web3 to coordinate the way money moves through their operations.",
} as const;

export const INVOICE_LANDING_TRIAL = {
  headline: 'Ready to make your invoices work harder?',
  body: `Create your first invoice free forever. When you're ready for payment links, connected systems and personalised intelligence, start your ${INVOICE_LANDING_TRIAL_DAYS}-day Professional trial.`,
  daysLabel: `${INVOICE_LANDING_TRIAL_DAYS} days free`,
  planLabel: INVOICE_LANDING_PLAN_NAME,
  secondaryLabel: 'Keep using the free invoice tool',
} as const;

export const INVOICE_LANDING_FINAL = {
  headline: 'Start with one invoice.',
  body: 'Create it free. Download it. And when you are ready, connect Provvy to the systems around your business.',
  primary: INVOICE_LANDING_PRIMARY_CTA_LABEL,
  secondary: INVOICE_LANDING_TRIAL_CTA_LABEL,
} as const;

export const INVOICE_LANDING_FAQS = [
  {
    question: "Is Provvy's invoice generator free?",
    answer:
      'Yes. You can create, preview and download invoices with Provvy’s free invoice tool forever. A Provvy account is not required for that.',
  },
  {
    question: 'Can I download invoices without creating an account?',
    answer:
      'Yes. Download the invoice PDF from this page without signing up. Create a Provvy account only if you want payment links, Xero, or the rest of Professional.',
  },
  {
    question: 'Can I create an invoice from a conversation?',
    answer:
      'Yes. Paste a WhatsApp, Slack, email or other conversation. Provvy extracts the invoice details it can identify clearly — such as customer, amount, currency, description, dates and payment timing — and leaves anything uncertain for you to review.',
  },
  {
    question: 'Can I turn my invoice into a payment link?',
    answer:
      'Yes. Payment Links are included on Professional. Create a Provvy account to turn the invoice into a payment link using the payment rails available to your business.',
  },
  {
    question: 'Can I connect Xero?',
    answer:
      'Yes. Xero is included on Professional. After you create a Provvy account you can connect Xero and push invoices into your accounting workflow. Connecting Xero uses Provvy’s existing Xero connection — not a separate login built for this page.',
  },
  {
    question: 'What does the 30-day Professional trial include?',
    answer: professionalTrialFaqAnswer(),
  },
  {
    question: "How does Provvy's commercial intelligence work?",
    answer:
      'Your invoice tells Provvy about the transaction in front of you. Connecting accounting, payment and business systems gives Provvy more context so recommendations can become more personalised. Provvy does not use customer or payment history until those systems are connected.',
  },
  {
    question: 'Can Provvy suggest better payment terms?',
    answer:
      'Provvy can notice payment timing in the invoice or conversation — for example delayed terms — and you could consider shorter windows, deposits, milestones or an early-payment incentive. Recommendations stay suggestions until you choose to apply them. They are not a guarantee that a customer will pay sooner.',
  },
  {
    question: 'Can I use Provvy to manage referral or revenue-sharing arrangements?',
    answer:
      'Yes. Referral Management is included on Professional, and Provvy also coordinates revenue sharing, supplier payments and other commercial workflows from the same workspace.',
  },
];

function professionalInvoiceUpgradeItems(): string[] {
  const features = PLAN_CATALOG.professional.features;
  const items: string[] = [];
  if (features.some((feature) => /payment links/i.test(feature))) {
    items.push('Turn invoices into payment links');
    items.push('Add available payment rails');
  }
  if (features.some((feature) => /xero/i.test(feature))) {
    items.push('Connect Xero');
    items.push('Push invoices into Xero');
  }
  items.push('Get personalised payment and commercial intelligence when systems are connected');
  if (features.some((feature) => /referral management/i.test(feature))) {
    items.push('Referral Management');
  }
  if (features.some((feature) => /settlement/i.test(feature))) {
    items.push('Automated settlement tracking');
  }
  items.push('Coordinate broader payment workflows');
  return items;
}

function professionalTrialFaqAnswer(): string {
  const features = PLAN_CATALOG.professional.features.join(', ');
  return `When you start with Provvy you get ${INVOICE_LANDING_TRIAL_DAYS} days of the ${INVOICE_LANDING_PLAN_NAME} package. Professional currently includes ${features}. The free invoice tool stays available without an account.`;
}

export function invoiceLandingPaymentRouteLabels(): string[] {
  return [...INVOICE_LANDING_PAYMENT_ROUTES];
}

export function invoiceLandingWorkflows() {
  return INVOICE_LANDING_WORKFLOWS.slugs
    .map((slug) => getWorkflowBySlug(slug))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .map((entry) => ({
      slug: entry.slug,
      name: entry.name,
      summary: entry.summary,
      href: COMMERCIAL_OS_ROUTES.publicWorkflowDetail(entry.slug),
    }));
}

export function invoiceLandingBusinesses() {
  return landingBusinessFlowItems();
}

export function professionalIncludesPaymentLinks(): boolean {
  return PLAN_CATALOG.professional.features.some((feature) => /payment links/i.test(feature));
}

export function professionalIncludesXero(): boolean {
  return PLAN_CATALOG.professional.features.some((feature) => /xero/i.test(feature));
}

export function professionalIncludesReferralManagement(): boolean {
  return PLAN_CATALOG.professional.features.some((feature) =>
    feature.toLowerCase().includes('referral management')
  );
}
