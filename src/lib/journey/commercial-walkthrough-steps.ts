export type CommercialWalkthroughStage =
  | 'agreement'
  | 'extraction'
  | 'review'
  | 'approvals'
  | 'collection'
  | 'settlement'
  | 'complete';

export type CommercialWalkthroughPhase = 'welcome' | 'active' | 'complete';

export type CommercialWalkthroughStep = {
  id: string;
  stage: CommercialWalkthroughStage;
  stageNumber: number;
  stageLabel: string;
  guidance: string;
  aiActivity: string;
};

export const COMMERCIAL_WALKTHROUGH_WELCOME = {
  title: 'Welcome to Provvy.',
  body: "Over the next two minutes I'll show you how we transform commercial agreements into automated business workflows.",
  cta: 'Start Tour',
};

export const COMMERCIAL_WALKTHROUGH_STEPS: CommercialWalkthroughStep[] = [
  {
    id: 'agreement',
    stage: 'agreement',
    stageNumber: 1,
    stageLabel: 'Agreement',
    guidance: "Let's begin by bringing a commercial agreement into Provvy.",
    aiActivity: 'Reading commercial context…',
  },
  {
    id: 'extraction',
    stage: 'extraction',
    stageNumber: 2,
    stageLabel: 'AI Extraction',
    guidance:
      "I've analysed the agreement and extracted the commercial terms, participants and payment obligations.",
    aiActivity: 'Extracting obligations…',
  },
  {
    id: 'review',
    stage: 'review',
    stageNumber: 3,
    stageLabel: 'AI Commercial Review',
    guidance:
      "Here's my commercial assessment. I've highlighted potential risks, uncertainties and settlement requirements for your review.",
    aiActivity: 'Analysing agreement…',
  },
  {
    id: 'approvals',
    stage: 'approvals',
    stageNumber: 4,
    stageLabel: 'Approvals',
    guidance:
      "The agreement is ready for participant approval. Once everyone agrees, we'll coordinate payment.",
    aiActivity: 'Waiting for participant approvals…',
  },
  {
    id: 'collection',
    stage: 'collection',
    stageNumber: 5,
    stageLabel: 'Payment Collection',
    guidance:
      "Every participant has approved. I'll now collect the agreed project value from the client.",
    aiActivity: 'Collecting client payment…',
  },
  {
    id: 'settlement',
    stage: 'settlement',
    stageNumber: 6,
    stageLabel: 'Settlement',
    guidance:
      "Payment has been received. I'm now coordinating settlement, updating financial records and synchronising connected systems.",
    aiActivity: 'Updating ledger…',
  },
  {
    id: 'complete',
    stage: 'complete',
    stageNumber: 7,
    stageLabel: 'Complete',
    guidance:
      "This workflow is now complete. I've already identified opportunities to automate similar work in the future.",
    aiActivity: 'Learning business patterns…',
  },
];

export const COMMERCIAL_WALKTHROUGH_COMPLETION = {
  title: 'Commercial Workflow Complete',
  subtitle: "You've just seen how Provvy:",
  outcomes: [
    'Understood a commercial agreement',
    'Coordinated participant approvals',
    'Managed commercial payment',
    'Executed settlement',
    'Learned a repeatable business workflow',
  ],
  nextPrompt: 'What would you like to do next?',
  actions: [
    { label: 'Start Your Assessment', href: '/journey/assessment' },
    { label: 'Explore Workflow Library', href: '/workspace/workflows' },
    {
      label: 'Book a Consultation',
      href: 'https://calendly.com/provvy/consultation',
      external: true,
    },
  ] as const,
};

export const COMMERCIAL_WALKTHROUGH_STORAGE_KEY = 'provvy:commercial-walkthrough-dismissed';
