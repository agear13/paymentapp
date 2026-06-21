import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  Users,
  Package,
  Palette,
  Megaphone,
  Sparkles,
} from 'lucide-react';

export type CompanyBrainStatus = 'Built' | 'Pending Build';
export type SectionCompletionStatus = 'Pending' | 'Complete';

export type MarketingActivityItem = {
  id: string;
  label: string;
  completed: boolean;
};

export type CompanyBrainCategory = {
  id: string;
  title: string;
  description: string;
  status: SectionCompletionStatus;
  icon: LucideIcon;
};

export type CampaignTypeOption = {
  value: string;
  label: string;
};

export type MembershipPlan = {
  id: string;
  name: string;
  creditsLabel: string;
  description?: string;
  features: string[];
  ctaLabel: string;
  stripeCheckoutUrl: string;
  featured?: boolean;
};

export type AiTeamReportRow = {
  id: string;
  campaign: string;
  date: string;
  status: 'Completed' | 'In progress' | 'Pending';
};

/** Placeholder dashboard metrics — replace with API data later. */
export const MARKETING_DASHBOARD_PLACEHOLDER = {
  companyBrainStatus: 'Built' as CompanyBrainStatus,
  campaignCreditsRemaining: 2,
  campaignsGenerated: 14,
  assetsGenerated: 187,
  hoursSaved: 63,
};

export const MARKETING_RECENT_ACTIVITY: MarketingActivityItem[] = [
  { id: '1', label: 'Company Brain completed', completed: true },
  { id: '2', label: 'Summer campaign delivered', completed: true },
  { id: '3', label: 'AI Team Report generated', completed: true },
  { id: '4', label: 'Autumn campaign submitted', completed: false },
  { id: '5', label: 'Awaiting review', completed: false },
];

export const COMPANY_BRAIN_CATEGORIES: CompanyBrainCategory[] = [
  {
    id: 'business',
    title: 'Business',
    description: 'Company overview, mission, values, and positioning.',
    status: 'Complete',
    icon: Building2,
  },
  {
    id: 'customers',
    title: 'Customers',
    description: 'Ideal customer profiles, segments, and pain points.',
    status: 'Complete',
    icon: Users,
  },
  {
    id: 'products',
    title: 'Products',
    description: 'Product catalog, features, pricing, and differentiators.',
    status: 'Pending',
    icon: Package,
  },
  {
    id: 'brand',
    title: 'Brand',
    description: 'Voice, tone, messaging pillars, and key narratives.',
    status: 'Pending',
    icon: Palette,
  },
  {
    id: 'marketing',
    title: 'Marketing',
    description: 'Channels, past campaigns, and performance insights.',
    status: 'Pending',
    icon: Megaphone,
  },
  {
    id: 'visual-identity',
    title: 'Visual Identity',
    description: 'Logos, colours, typography, and brand assets.',
    status: 'Pending',
    icon: Sparkles,
  },
];

export const CAMPAIGN_TYPE_OPTIONS: CampaignTypeOption[] = [
  { value: 'blog', label: 'Blog' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'product-launch', label: 'Product Launch' },
  { value: 'seasonal', label: 'Seasonal Campaign' },
  { value: 'social', label: 'Social Campaign' },
  { value: 'event', label: 'Event Promotion' },
  { value: 'multi-channel', label: 'Multi-channel Campaign' },
];

export const STRIPE_CHECKOUT_PLACEHOLDER_URL = 'https://checkout.stripe.com/pay/placeholder';

export const CAMPAIGN_MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    creditsLabel: '2 Campaign Credits / Month',
    features: [
      'AI Marketing Team',
      'Campaign Reports',
      'Support',
      'Content Deliverables',
    ],
    ctaLabel: 'Subscribe',
    stripeCheckoutUrl: STRIPE_CHECKOUT_PLACEHOLDER_URL,
  },
  {
    id: 'growth',
    name: 'Growth',
    creditsLabel: '4 Campaign Credits / Month',
    features: [
      'AI Marketing Team',
      'Campaign Reports',
      'Support',
      'Content Deliverables',
    ],
    ctaLabel: 'Subscribe',
    stripeCheckoutUrl: STRIPE_CHECKOUT_PLACEHOLDER_URL,
    featured: true,
  },
  {
    id: 'one-off',
    name: 'One-Off Campaign',
    creditsLabel: '1 Campaign Credit',
    description: 'Perfect for occasional campaigns.',
    features: [
      'AI Marketing Team',
      'Campaign Reports',
      'Support',
      'Content Deliverables',
    ],
    ctaLabel: 'Purchase Campaign',
    stripeCheckoutUrl: STRIPE_CHECKOUT_PLACEHOLDER_URL,
  },
];

export const AI_TEAM_REPORTS_PLACEHOLDER: AiTeamReportRow[] = [
  { id: '1', campaign: 'Summer Campaign', date: '2026-05-12', status: 'Completed' },
  { id: '2', campaign: 'Product Launch', date: '2026-04-03', status: 'Completed' },
  { id: '3', campaign: 'Winter Promotion', date: '2026-02-18', status: 'Completed' },
];
