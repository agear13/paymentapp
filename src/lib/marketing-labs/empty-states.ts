export type MarketingEmptyStateContent = {
  id: string;
  title: string;
  description: string;
  whyItMatters: string;
  nextStep: string;
  ctaLabel?: string;
};

export const MARKETING_EMPTY_STATES = {
  commandCentre: {
    id: 'command-centre',
    title: 'Your AI Marketing Team is ready',
    description:
      'Thirsty Turtl\'s Company Brain is loaded. Start the AI Marketing Team to plan your next campaign.',
    whyItMatters:
      'The AI Marketing Team turns Company Brain knowledge into a complete Campaign Package — strategy, copy, SEO, and creative direction.',
    nextStep: 'Start the AI Marketing Team to begin campaign planning.',
    ctaLabel: 'Start AI Marketing Team',
  },
  creativeAssets: {
    id: 'creative-assets',
    title: 'Creative Assets will appear here',
    description:
      'After the AI Creative Team finishes, import your assets to unlock previews and downloads.',
    whyItMatters:
      'Creative Assets are the visual deliverables your audience sees — carousels, pins, stories, and newsletter headers.',
    nextStep: 'Dispatch the Campaign Package to the AI Creative Team, then import assets when ready.',
    ctaLabel: 'Go to Command Centre',
  },
  creativeAssetsQueued: {
    id: 'creative-assets-queued',
    title: 'Creative Assets in production',
    description:
      'The AI Creative Team is preparing Thirsty Turtl visual deliverables from your Campaign Package.',
    whyItMatters:
      'Each asset is designed to match your brand voice and campaign strategy.',
    nextStep: 'Import assets.json when the AI Creative Team completes production.',
  },
  companyBrain: {
    id: 'company-brain',
    title: 'Build your Company Brain',
    description:
      'Thirsty Turtl\'s AI Marketing Team needs business knowledge before it can recommend campaigns.',
    whyItMatters:
      'Company Brain is the foundation — brand voice, products, customers, and positioning that every campaign draws from.',
    nextStep: 'Complete each knowledge category to unlock campaign generation.',
  },
  campaigns: {
    id: 'campaigns',
    title: 'No campaigns yet',
    description:
      'Your AI Marketing Team hasn\'t generated a campaign yet. Campaigns are created after analysing Company Brain.',
    whyItMatters:
      'Each campaign packages strategy, content, and Creative Assets into a coordinated marketing push.',
    nextStep: 'Start the AI Marketing Team from the Command Centre.',
    ctaLabel: 'Generate Campaign',
  },
  dashboardActivity: {
    id: 'dashboard-activity',
    title: 'Activity will build as you go',
    description:
      'Track Thirsty Turtl\'s marketing progress — from Company Brain through publishing.',
    whyItMatters:
      'A single timeline shows where you are in the full marketing operating cycle.',
    nextStep: 'Start the AI Marketing Team to see live activity.',
  },
  aiPerformance: {
    id: 'ai-performance',
    title: 'Performance metrics unlock after production',
    description:
      'AI Team Performance scores appear once the AI Marketing Team completes campaign planning.',
    whyItMatters:
      'The AI Team Performance Report shows quality, compliance, and time saved for client review.',
    nextStep: 'Complete a campaign cycle to generate your first report.',
  },
  campaignInsights: {
    id: 'campaign-insights',
    title: 'Campaign Insights arrive after Creative Assets',
    description:
      'AI projections for reach, traffic, and leads appear once Creative Assets are imported.',
    whyItMatters:
      'Insights help you plan publishing and set expectations before going live.',
    nextStep: 'Import Creative Assets to unlock Campaign Insights.',
  },
  nextCampaign: {
    id: 'next-campaign',
    title: 'Next campaign recommendation pending',
    description:
      'After publishing approval, the AI Marketing Team will recommend your next highest-value topic.',
    whyItMatters:
      'Continuous campaigns compound SEO authority and customer education over time.',
    nextStep: 'Complete Marketing Operations to unlock the next recommendation.',
  },
  reports: {
    id: 'reports',
    title: 'Reports generate after campaign completion',
    description:
      'Client Report and AI Team Performance Report are produced when a campaign cycle finishes.',
    whyItMatters:
      'Reports give stakeholders a clear summary of deliverables, quality, and time saved.',
    nextStep: 'Complete Creative Asset production to download reports.',
  },
} satisfies Record<string, MarketingEmptyStateContent>;
