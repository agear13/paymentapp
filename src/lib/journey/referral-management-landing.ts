import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { JOURNEY_ROUTES } from '@/lib/journey/hackathon-journey';
import { landingBusinessFlowItems } from '@/lib/journey/landing-business-flows';
import { LANDING_PROVIDER_OFFERINGS } from '@/lib/journey/landing-provider-catalog';
import { PLAN_CATALOG } from '@/lib/plans/plan-catalog';
import { PROFESSIONAL_TRIAL_DAYS } from '@/lib/entitlements/professional-trial';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';

export const REFERRAL_MANAGEMENT_LANDING_PATH = '/referral-management';

export const REFERRAL_LANDING_METADATA = {
  title: 'Referral Management Software | Provvy',
  description:
    'Manage referral programs, partner commissions and referral payouts in one workflow with Provvy. Try Professional free for 30 days.',
} as const;

export const REFERRAL_LANDING_TRIAL_CTA_HREF = COMMERCIAL_OS_ROUTES.assessment;
export const REFERRAL_LANDING_HOW_IT_WORKS_HREF = '#how-it-works';
export const REFERRAL_LANDING_COMPARE_HREF = `${JOURNEY_ROUTES.landing}#compare`;
export const REFERRAL_LANDING_EXPLORE_HREF = '#how-it-works';

export const REFERRAL_LANDING_TRIAL_DAYS = PROFESSIONAL_TRIAL_DAYS;
export const REFERRAL_LANDING_PLAN_NAME = PLAN_CATALOG.professional.name;

export const REFERRAL_LANDING_TRIAL_CTA_LABEL = 'Start your 30-day free trial';
export const REFERRAL_LANDING_SECONDARY_CTA_LABEL = 'See how it works';
export const REFERRAL_LANDING_OFFER_LINE = '30 days free · Professional package';

export const REFERRAL_LANDING_SITE_NAV = [
  { label: 'Explore', href: `${JOURNEY_ROUTES.landing}#compare` },
  { label: 'Intelligence', href: `${JOURNEY_ROUTES.landing}#payment-intelligence` },
  { label: 'How it works', href: `${JOURNEY_ROUTES.landing}#how-it-works` },
  { label: 'Workflows', href: `${JOURNEY_ROUTES.landing}#workflow-library` },
  { label: 'Pricing', href: `${JOURNEY_ROUTES.landing}#pricing` },
  { label: 'Provvy Labs', href: '/labs' },
] as const;

export const REFERRAL_LANDING_COPY = {
  eyebrow: 'Referral management',
  headline: 'Referral management without the spreadsheet.',
  supporting:
    'Create referral programs, give partners unique links, track referred revenue and manage the commissions you owe — all in one workflow.',
  audience:
    'Built for referral, affiliate, influencer, UGC, partner and revenue-share programs — connected to the commercial and payment workflow, not a standalone affiliate tracker.',
} as const;

export const REFERRAL_LANDING_WORKFLOW = {
  headline: 'From referral to reward. Without the manual work.',
  steps: [
    {
      n: '01',
      title: 'Create your program',
      body: 'Set your commission, customer discount and program rules.',
    },
    {
      n: '02',
      title: 'Invite your partners',
      body: 'Give each partner their own referral link.',
    },
    {
      n: '03',
      title: 'Track referrals',
      body: 'Connect referred customers and resulting activity to the right partner.',
    },
    {
      n: '04',
      title: 'Calculate commissions',
      body: 'Know exactly what each partner is owed.',
    },
    {
      n: '05',
      title: 'Coordinate the payout',
      body: 'Move from referral activity to the payment obligation that follows.',
    },
  ],
} as const;

export const REFERRAL_LANDING_SPREADSHEET = {
  headline: 'Still managing referrals in spreadsheets?',
  body: 'Provvy connects the commercial terms, referral activity and payment workflow instead of leaving them scattered across spreadsheets, messages and payment systems.',
  before: [
    'Customer purchase',
    'Check referral',
    'Open spreadsheet',
    'Calculate commission',
    'Message partner',
    'Work out payout',
    'Update spreadsheet',
    'Reconcile',
  ],
  after: [
    'Referral',
    'Attribution',
    'Commission',
    'Partner obligation',
    'Payout',
    'Record',
  ],
} as const;

export const REFERRAL_LANDING_FEATURES = {
  headline: 'Everything behind the referral.',
  items: [
    {
      title: 'Referral links',
      body: 'Give partners unique referral links and track referral activity.',
    },
    {
      title: 'Partner management',
      body: 'Keep referral partners and their activity organised.',
    },
    {
      title: 'Referral attribution',
      body: 'Connect referred customers and resulting revenue to the right partner.',
    },
    {
      title: 'Commission rules',
      body: 'Define the commercial terms that determine what partners earn.',
    },
    {
      title: 'Commission tracking',
      body: 'See what each partner has earned and what remains payable.',
    },
    {
      title: 'Partner payouts',
      body: 'Move from referral activity to the payment obligation that follows.',
    },
  ],
} as const;

export const REFERRAL_LANDING_AGREEMENT = {
  headline: "Your referral agreements shouldn't live in your inbox.",
  conversation:
    'Danielle receives 2% of revenue generated from customers she refers.',
  structuresLabel: 'Provvy structures the obligation',
  fields: [
    { label: 'Partner', value: 'Danielle' },
    { label: 'Type', value: 'Revenue share' },
    { label: 'Rate', value: '2%' },
    { label: 'Applies to', value: 'Referred customers' },
    { label: 'Status', value: 'Active' },
  ],
  customerPaysLabel: 'Customer pays',
  customerPaysValue: '$1,000',
  commissionLabel: 'Commission',
  commissionValue: 'Danielle earns $20',
  payableLabel: 'Partner payable',
  payableValue: '$20',
  note: 'Paste an agreement or conversation, then review the structured terms before the partner is added. Provvy does not silently extract and activate a program without you.',
} as const;

export const REFERRAL_LANDING_PAYOUT = {
  headline: "Referral management shouldn't stop at calculating the commission.",
  body: 'Once a partner is owed money, Provvy can coordinate the payment workflow that follows.',
  message:
    "Provvy doesn't just tell you who earned money. It connects the referral obligation to the payment workflow.",
  partner: 'Danielle',
  corridor: 'Australia → Indonesia',
  amountLabel: 'Amount owed',
  amountValue: '$148 AUD',
  routesLabel: 'Available payment routes',
  ctaLabel: 'Compare payout routes',
} as const;

/** Labels that already exist in the public payment-route catalog. */
export const REFERRAL_LANDING_PAYOUT_ROUTES = [
  'Wise',
  'Bank transfer',
  'Digital-dollar transfer',
] as const;

export const REFERRAL_LANDING_BUSINESSES = {
  headline: 'Built around real referral workflows.',
  body: "We've built Provvy around real business workflows across events, consumer brands, communities and partner-led businesses.",
  names: ['Weso', 'Thirsty Turtl', 'The Collective'] as const,
} as const;

export const REFERRAL_LANDING_AUDIENCES = {
  headline: 'Built for businesses that grow through partners.',
  items: [
    {
      title: 'Events',
      body: 'Manage promoters, referral partners and revenue-share arrangements.',
    },
    {
      title: 'Communities',
      body: 'Reward members who bring new customers or business.',
    },
    {
      title: 'Consumer brands',
      body: 'Manage affiliate, influencer and UGC programs.',
    },
    {
      title: 'Hospitality',
      body: 'Coordinate referral relationships and partner rewards.',
    },
    {
      title: 'B2B',
      body: 'Track partner-generated revenue and commissions.',
    },
    {
      title: 'Web3',
      body: 'Manage referral and partner relationships across different payment environments.',
    },
  ],
} as const;

export const REFERRAL_LANDING_COMPARISON = {
  headline: 'More than referral tracking.',
  traditionalTitle: 'Traditional manual workflow',
  traditional: [
    'Referral tracking',
    'Commission calculation',
    'Partner messages',
    'Spreadsheet obligations',
    'Separate payout process',
    'Separate reconciliation',
  ],
  provvyTitle: 'Provvy',
  provvy: [
    'Referral tracking',
    'Commission calculation',
    'Partner obligations',
    'Payout coordination',
    'Payment infrastructure',
    'Financial records',
  ],
} as const;

export const REFERRAL_LANDING_OFFER = {
  headline: 'Try Professional free for 30 days.',
  body: "Get access to Provvy's Professional package and try referral management with your own business.",
  daysLabel: '30 days free',
  planLabel: 'Professional',
  included: 'Referral management included',
} as const;

export const REFERRAL_LANDING_FINAL = {
  headline: 'Ready to stop managing referrals manually?',
  body: 'Start with Provvy Professional free for 30 days and see how your referral workflow works in practice.',
  secondaryLabel: 'Explore how Provvy works',
} as const;

export const REFERRAL_LANDING_EXAMPLE_PROGRAM = {
  eyebrow: 'Example program',
  programLabel: 'Referral program',
  programName: 'Summer Referral Program',
  fields: [
    { label: 'Partner', value: 'Danielle' },
    { label: 'Referral link', value: 'provvy.com/r/danielle' },
    { label: 'Customer discount', value: '10%' },
    { label: 'Partner commission', value: '2%' },
    { label: 'Referrals', value: '14' },
    { label: 'Referred revenue', value: '$7,400' },
    { label: 'Commission owed', value: '$148' },
  ],
  manageLabel: 'Manage program',
} as const;

export const REFERRAL_LANDING_FAQS = [
  {
    question: 'What is referral management software?',
    answer:
      'Referral management software helps a business create a referral program, issue partner links, track referred customers and revenue, and manage the commissions those partners are owed. Provvy does this inside the same commercial and payment workflow as the rest of the business — not as a standalone affiliate tracker.',
  },
  {
    question: 'How do I track referral partners?',
    answer:
      'Add partners to your referral program, give each partner their own referral link, and track referred customers and resulting activity against the right partner. Provvy keeps partners, links and attributed revenue in one program view.',
  },
  {
    question: 'How do I calculate referral commissions?',
    answer:
      'Set commission terms when you create the program or add a partner — including revenue-share rates. Provvy then tracks what each partner has earned from attributed referral activity and what remains payable.',
  },
  {
    question: 'Can each partner have their own referral link?',
    answer:
      'Yes. Each partner can receive their own referral link, and Provvy can also issue a QR code for that link.',
  },
  {
    question: 'Can I manage different commission rates?',
    answer:
      'Yes. You define the commercial terms that determine what each partner earns, including different revenue-share rates or fixed amounts.',
  },
  {
    question: 'Can Provvy manage revenue-sharing arrangements?',
    answer:
      'Yes. Referral Management supports revenue-share compensation on referred customers. Provvy also coordinates partner payments and revenue sharing as a broader commercial workflow.',
  },
  {
    question: 'Can Provvy manage affiliate and influencer programs?',
    answer:
      'Yes. The same referral workflow is used for affiliate, influencer, UGC/creator and partner referral programs: unique links, attribution, commission tracking and payout coordination.',
  },
  {
    question: 'How does the 30-day free Professional trial work?',
    answer:
      'When you start with Provvy you get 30 days of the Professional package. Referral Management is included on Professional. After you create a workspace, you can try the referral workflow with your own business.',
  },
  {
    question: 'Can I manage partner payouts in Provvy?',
    answer:
      'Yes. Once a partner is owed money, Provvy hands the commission to Settlement so you can see what is owed and coordinate the payout that follows. Provvy does not automatically execute every payout.',
  },
  {
    question: 'Can Provvy connect referral activity to payment workflows?',
    answer:
      'Yes. Attributed referral activity becomes a partner obligation you can coordinate in the payment workflow — including comparing available payout routes.',
  },
] as const;

export function referralLandingBusinesses() {
  const items = landingBusinessFlowItems();
  return REFERRAL_LANDING_BUSINESSES.names
    .map((name) => items.find((item) => item.business === name))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export function referralLandingPayoutRoutesAreCatalogued(): boolean {
  const haystack = LANDING_PROVIDER_OFFERINGS.map((offering) =>
    [offering.providerName, offering.productName, ...offering.paymentMethods].join(' ')
  )
    .join(' ')
    .toLowerCase();

  return REFERRAL_LANDING_PAYOUT_ROUTES.every((label) => {
    if (label === 'Bank transfer') return haystack.includes('bank_transfer') || haystack.includes('bank transfer');
    return haystack.includes(label.toLowerCase());
  });
}

export function referralManagementWorkflowExists(): boolean {
  return Boolean(getWorkflowBySlug('referral-management'));
}

export function professionalIncludesReferralManagement(): boolean {
  return PLAN_CATALOG.professional.features.some((feature) =>
    feature.toLowerCase().includes('referral management')
  );
}
