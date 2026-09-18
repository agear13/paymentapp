import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';

export const LANDING_BUSINESS_FLOW_COPY = {
  eyebrow: 'Built around real business flows',
  headline: 'Different businesses. Different payment flows. One coordination layer.',
  body: "We've worked with businesses across communities, events, consumer brands and Web3 to coordinate the way money moves through their operations.",
  ctaLabel: 'Explore workflows',
  ctaHref: '#workflow-library',
} as const;

type LandingBusinessFlowDefinition = {
  business: string;
  workflow: string;
  description: string;
  /** Catalog slug when a public workflow page already exists. */
  workflowSlug: string | null;
};

const LANDING_BUSINESS_FLOW_DEFINITIONS: readonly LandingBusinessFlowDefinition[] = [
  {
    business: 'The Collective',
    workflow: 'Partner payments',
    description:
      'Coordinating partner payments and revenue sharing for an entrepreneurship community.',
    workflowSlug: 'revenue-sharing',
  },
  {
    business: 'Weso',
    workflow: 'Referral management',
    description:
      'Managing referral relationships and revenue-share obligations for an events community.',
    workflowSlug: 'referral-management',
  },
  {
    business: 'Thirsty Turtl',
    workflow: 'Affiliate & creator programs',
    description: 'Managing affiliate, influencer and UGC programs for a consumer brand.',
    workflowSlug: 'referral-management',
  },
  {
    business: 'EvolvH34',
    workflow: 'Web3 payment reconciliation',
    description:
      'Automated reconciliation of Web3 payments and connected payment activity back to business records.',
    workflowSlug: 'autonomous-reconciliation',
  },
];

export type LandingBusinessFlowItem = LandingBusinessFlowDefinition & {
  href: string | null;
};

function publicWorkflowHref(slug: string | null): string | null {
  if (!slug) return null;
  if (!getWorkflowBySlug(slug)) return null;
  return COMMERCIAL_OS_ROUTES.publicWorkflowDetail(slug);
}

export function landingBusinessFlowItems(): LandingBusinessFlowItem[] {
  return LANDING_BUSINESS_FLOW_DEFINITIONS.map((item) => ({
    ...item,
    href: publicWorkflowHref(item.workflowSlug),
  }));
}
