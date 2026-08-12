import type { LucideIcon } from 'lucide-react';
import {
  Brain,
  CheckCircle2,
  Clock,
  FileText,
  Layers,
  Mail,
  Megaphone,
  Palette,
  Search,
  Target,
  Users,
  Workflow,
} from 'lucide-react';

export const LABS_CALENDLY_URL = 'https://calendly.com/provvy/consultation';

export const LABS_WORKFLOWS_HREF = '/journey#workflow-library';

export const LABS_NAV_ITEMS = [
  { label: 'Company Brain', href: '#company-brain' },
  { label: 'AI Teams', href: '#ai-teams' },
  { label: 'Campaign Report', href: '#campaign-report' },
  { label: 'How It Works', href: '#how-it-works' },
] as const;

export const LABS_CHAIN = [
  { label: 'Business Knowledge', desc: 'What your business already knows.', icon: FileText },
  { label: 'Company Brain', desc: 'Structured, AI-ready source of truth.', icon: Brain },
  { label: 'AI Teams', desc: 'Deployed to do defined work.', icon: Users },
  { label: 'Workflows', desc: 'Outputs connected into operations.', icon: Workflow },
  { label: 'Business Outcomes', desc: 'Measurable commercial results.', icon: Target },
] as const;

export const LABS_BRAIN_CARDS = [
  { label: 'Brand', desc: 'Voice, positioning and messaging.' },
  { label: 'Customers', desc: 'Segments, needs and objections.' },
  { label: 'Products', desc: 'Offers, pricing and differentiators.' },
  { label: 'Sales', desc: 'Pipeline, funnels and conversion.' },
  { label: 'Marketing', desc: 'Channels, campaigns and assets.' },
  { label: 'Operations', desc: 'Systems, tools and responsibilities.' },
  { label: 'Processes', desc: 'How work actually gets done.' },
  { label: 'Industry Knowledge', desc: 'Market context and constraints.' },
] as const;

export const LABS_DIFFERENTIATORS = [
  { label: 'Context', desc: 'Knows your business.', icon: Brain },
  { label: 'Process', desc: 'Follows defined workflows.', icon: Workflow },
  { label: 'Review', desc: 'Outputs are checked before delivery.', icon: CheckCircle2 },
] as const;

export const LABS_MARKETING_CAPABILITIES = [
  'Research',
  'Strategy',
  'Creation',
  'Optimisation',
  'Review',
  'Repurposing',
] as const;

export const LABS_CREDIT_TIERS = [
  { name: 'Starter', credits: '2 Campaign Credits', price: 'A$297', popular: false },
  { name: 'Growth', credits: '4 Campaign Credits', price: 'A$547', popular: false },
  { name: 'Scale', credits: '6 Campaign Credits', price: 'A$747', popular: true },
] as const;

export const LABS_CAMPAIGN_OUTPUTS: { label: string; icon: LucideIcon }[] = [
  { label: 'Campaign Strategy', icon: Target },
  { label: 'SEO Content', icon: Search },
  { label: 'Social Content', icon: Megaphone },
  { label: 'Email', icon: Mail },
  { label: 'Repurposed Content', icon: Layers },
  { label: 'Content Calendar', icon: Clock },
  { label: 'Creative Concepts', icon: Palette },
  { label: 'Campaign Report', icon: FileText },
];

export const LABS_REPORT_SECTIONS = [
  { label: 'Strategy', detail: 'Objective, audience and positioning' },
  { label: 'Research', detail: 'Market, competitor and keyword inputs' },
  { label: 'Content', detail: 'Assets produced in this campaign' },
  { label: 'SEO', detail: 'Target terms and on-page guidance' },
  { label: 'Distribution', detail: 'Channels, sequencing and calendar' },
  { label: 'Recommendations', detail: 'What to do next' },
  { label: 'QA / Review', detail: 'Human review notes and sign-off' },
] as const;

export const LABS_MORE_TEAMS = [
  { name: 'AI Sales Team', tag: 'Coming Soon' },
  { name: 'AI Client Management', tag: 'Coming Soon' },
  { name: 'AI Operations Team', tag: 'Coming Soon' },
  { name: 'AI Research Team', tag: 'Coming Soon' },
  { name: 'Custom AI Team', tag: 'Available by consultation' },
] as const;

export const LABS_HOW_IT_WORKS_STEPS = [
  'Build your Company Brain',
  'Choose an AI Team',
  'Purchase credits',
  'Submit a brief',
  'AI Team executes',
  'Receive your report and assets',
] as const;
