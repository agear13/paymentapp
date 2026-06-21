import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  Users,
  Package,
  Palette,
  Megaphone,
  Sparkles,
} from 'lucide-react';
import { MARKETING_DEMO_BRAND } from '@/lib/marketing-jobs/demo-brand';

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

export type CampaignHistoryRow = {
  id: string;
  title: string;
  date: string;
  status: 'Complete' | 'In progress' | 'Ready for Publishing';
  assets: number;
};

/** Thirsty Turtl demo dashboard metrics. */
export const MARKETING_DASHBOARD_PLACEHOLDER = {
  companyBrainStatus: 'Built' as CompanyBrainStatus,
  campaignCreditsRemaining: 2,
  campaignsGenerated: 14,
  assetsGenerated: 187,
  hoursSaved: 63,
};

export const MARKETING_RECENT_ACTIVITY: MarketingActivityItem[] = [
  { id: '1', label: `${MARKETING_DEMO_BRAND} Company Brain completed`, completed: true },
  { id: '2', label: 'Gentle Cleanser Education Campaign delivered', completed: true },
  { id: '3', label: 'AI Team Performance Report generated', completed: true },
  { id: '4', label: 'Sensitive Skin Mistakes campaign in progress', completed: false },
  { id: '5', label: 'Publishing approval pending', completed: false },
];

export const THIRSTY_TURTL_CAMPAIGN_HISTORY: CampaignHistoryRow[] = [
  {
    id: '1',
    title: 'Gentle Cleanser Education Campaign',
    date: '2026-06-18',
    status: 'In progress',
    assets: 12,
  },
  {
    id: '2',
    title: 'Daily SPF Awareness Campaign',
    date: '2026-05-04',
    status: 'Complete',
    assets: 11,
  },
  {
    id: '3',
    title: 'Barrier Repair Serum Launch',
    date: '2026-03-22',
    status: 'Complete',
    assets: 14,
  },
];

export const COMPANY_BRAIN_CATEGORIES: CompanyBrainCategory[] = [
  {
    id: 'business',
    title: 'Business',
    description: `${MARKETING_DEMO_BRAND} — barrier-respecting skincare rooted in science and simplicity.`,
    status: 'Complete',
    icon: Building2,
  },
  {
    id: 'customers',
    title: 'Customers',
    description: 'Sensitive-skin beginners and ingredient-aware customers seeking gentle routines.',
    status: 'Complete',
    icon: Users,
  },
  {
    id: 'products',
    title: 'Products',
    description: 'Gentle Cleanser, Hydrating Serum, Daily SPF — education-led hero SKUs.',
    status: 'Complete',
    icon: Package,
  },
  {
    id: 'brand',
    title: 'Brand',
    description: 'Calm confidence. Science-backed, approachable, never clinical.',
    status: 'Complete',
    icon: Palette,
  },
  {
    id: 'marketing',
    title: 'Marketing',
    description: 'Educational-first content across Instagram, Pinterest, email, and LinkedIn.',
    status: 'Complete',
    icon: Megaphone,
  },
  {
    id: 'visual-identity',
    title: 'Visual Identity',
    description: 'Soft natural light, muted earth tones, turtle-inspired brand accents.',
    status: 'Complete',
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
      'Client Report',
      'AI Team Performance Report',
      'Creative Assets',
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
      'Client Report',
      'AI Team Performance Report',
      'Creative Assets',
    ],
    ctaLabel: 'Subscribe',
    stripeCheckoutUrl: STRIPE_CHECKOUT_PLACEHOLDER_URL,
    featured: true,
  },
  {
    id: 'one-off',
    name: 'One-Off Campaign',
    creditsLabel: '1 Campaign Credit',
    description: `Perfect for a single ${MARKETING_DEMO_BRAND} campaign push.`,
    features: [
      'AI Marketing Team',
      'Client Report',
      'AI Team Performance Report',
      'Creative Assets',
    ],
    ctaLabel: 'Purchase Campaign',
    stripeCheckoutUrl: STRIPE_CHECKOUT_PLACEHOLDER_URL,
  },
];

export const AI_TEAM_REPORTS_PLACEHOLDER: AiTeamReportRow[] = [
  {
    id: '1',
    campaign: `${MARKETING_DEMO_BRAND} — Daily SPF Awareness`,
    date: '2026-05-04',
    status: 'Completed',
  },
  {
    id: '2',
    campaign: `${MARKETING_DEMO_BRAND} — Barrier Repair Launch`,
    date: '2026-03-22',
    status: 'Completed',
  },
  {
    id: '3',
    campaign: `${MARKETING_DEMO_BRAND} — Gentle Cleanser Education`,
    date: '2026-06-18',
    status: 'In progress',
  },
];
