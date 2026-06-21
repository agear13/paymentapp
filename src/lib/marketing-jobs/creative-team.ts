import type { MarketingJobStage } from '@/lib/marketing-jobs/types';

/** Lucide icon name — resolved in UI via specialist icon registry. */
export type SpecialistIconName =
  | 'clock'
  | 'brain'
  | 'search'
  | 'layout-grid'
  | 'file-text'
  | 'file-search'
  | 'palette'
  | 'pen-tool'
  | 'shield-check'
  | 'badge-check'
  | 'package-check';

export type AiCreativeSpecialist = {
  id: string;
  role: string;
  responsibility: string;
  currentObjective: string;
  /** Past-tense summary shown in activity feed when stage completes. */
  completedActivity: string;
  /** Active-state feed message. */
  workingActivity: string;
  icon: SpecialistIconName;
  stageTitle: string;
  stageDescription: string;
  offsetMs: number;
  progress: number;
  confidence: number;
  estimatedDurationMinutes: number;
  reasoning: string;
  inputs: string[];
  outputs: string[];
};

/** Internal orchestration stage — excluded from client-facing pipeline display. */
const QUEUED_SPECIALIST: AiCreativeSpecialist = {
  id: 'queued',
  role: 'Orchestration',
  responsibility: 'Assign campaign to AI Marketing Team',
  currentObjective: 'Queue campaign for specialist coordination',
  completedActivity: 'Campaign assigned to AI Marketing Team',
  workingActivity: 'Assigning campaign…',
  icon: 'clock',
  stageTitle: 'Queued',
  stageDescription: 'Campaign queued for AI Marketing Team',
  offsetMs: 0,
  progress: 2,
  confidence: 100,
  estimatedDurationMinutes: 0,
  reasoning: 'Campaign intake validates Company Brain coverage before specialists begin.',
  inputs: ['Campaign brief'],
  outputs: ['Specialist assignments'],
};

/** Canonical AI Marketing Team pipeline — extend here without UI changes. */
export const AI_MARKETING_TEAM: AiCreativeSpecialist[] = [
  {
    id: 'business-knowledge-engineer',
    role: 'Business Knowledge Engineer',
    responsibility: 'Load and validate Company Brain knowledge',
    currentObjective: 'Load Company Brain and validate knowledge coverage',
    completedActivity: 'Loaded Company Brain',
    workingActivity: 'Loading Company Brain…',
    icon: 'brain',
    stageTitle: 'Business Knowledge Engineer',
    stageDescription: 'Loading Company Brain',
    offsetMs: 700,
    progress: 12,
    confidence: 97,
    estimatedDurationMinutes: 1,
    reasoning:
      'Company Brain is loaded first so every downstream specialist works from a single source of truth.',
    inputs: ['Company Brain', 'Brand Voice', 'Products', 'Positioning'],
    outputs: ['Knowledge coverage report'],
  },
  {
    id: 'seo-strategist',
    role: 'SEO Strategist',
    responsibility: 'Generate keyword and search strategy',
    currentObjective: 'Generate SEO keyword strategy for the campaign article',
    completedActivity: 'Generated keyword strategy',
    workingActivity: 'Generating keyword strategy…',
    icon: 'search',
    stageTitle: 'SEO Strategist',
    stageDescription: 'Generating keyword strategy',
    offsetMs: 1_400,
    progress: 24,
    confidence: 95,
    estimatedDurationMinutes: 2,
    reasoning:
      'Educational search intent aligns with the gentle cleanser topic and supports long-form content discovery.',
    inputs: ['Company Brain', 'Campaign objectives', 'Article outline'],
    outputs: ['SEO Strategy', 'Primary keywords', 'Meta description'],
  },
  {
    id: 'campaign-strategist',
    role: 'Campaign Strategist',
    responsibility: 'Structure the multi-channel campaign',
    currentObjective: 'Create campaign structure and channel plan',
    completedActivity: 'Created campaign structure',
    workingActivity: 'Creating campaign structure…',
    icon: 'layout-grid',
    stageTitle: 'Campaign Strategist',
    stageDescription: 'Creating campaign structure',
    offsetMs: 2_100,
    progress: 36,
    confidence: 96,
    estimatedDurationMinutes: 2,
    reasoning:
      'Multi-channel structure sequences educational content before conversion-led social placements.',
    inputs: ['SEO Strategy', 'Target audience', 'Business goal'],
    outputs: ['Campaign Strategy', 'Channel plan'],
  },
  {
    id: 'content-strategist',
    role: 'Content Strategist',
    responsibility: 'Review campaign objectives and content requirements',
    currentObjective: 'Review campaign objectives and content requirements',
    completedActivity: 'Reviewed campaign objectives and content requirements',
    workingActivity: 'Reviewing content requirements…',
    icon: 'file-text',
    stageTitle: 'Content Strategist',
    stageDescription: 'Reviewing campaign brief',
    offsetMs: 2_800,
    progress: 48,
    confidence: 96,
    estimatedDurationMinutes: 2,
    reasoning:
      'Content pillars prioritise educational value to match audience research on barrier-friendly skincare.',
    inputs: ['Campaign Strategy', 'Brand Voice', 'Personas'],
    outputs: ['Blog Article', 'Social Copy', 'Newsletter intro'],
  },
  {
    id: 'creative-director',
    role: 'Creative Director',
    responsibility: 'Plan visual concepts across social channels',
    currentObjective: 'Prepare visual production brief',
    completedActivity: 'Prepared visual concepts for Instagram, Facebook and Pinterest',
    workingActivity: 'Preparing visual brief…',
    icon: 'palette',
    stageTitle: 'Creative Director',
    stageDescription: 'Planning visual concepts',
    offsetMs: 3_600,
    progress: 62,
    confidence: 96,
    estimatedDurationMinutes: 3,
    reasoning:
      'Educational-first creative has been selected because previous campaigns indicate higher engagement than product-first messaging for this audience.',
    inputs: [
      'Company Brain',
      'Brand Voice',
      'Customer Personas',
      'Campaign Strategy',
      'Existing Photography',
      'Visual Recommendations',
    ],
    outputs: [
      'Instagram Carousel',
      'Pinterest Pins',
      'Facebook Creative',
      'Instagram Stories',
      'Newsletter Header',
    ],
  },
  {
    id: 'brand-designer',
    role: 'Brand Designer',
    responsibility: 'Prepare Canva-ready creative production package',
    currentObjective: 'Prepare Canva-ready asset specifications',
    completedActivity: 'Prepared creative production package',
    workingActivity: 'Preparing Canva creative…',
    icon: 'pen-tool',
    stageTitle: 'Brand Designer',
    stageDescription: 'Preparing Canva creative',
    offsetMs: 4_400,
    progress: 76,
    confidence: 97,
    estimatedDurationMinutes: 2,
    reasoning:
      'Canva templates mirror brand palette and typography rules to reduce manual rework during creative production.',
    inputs: ['Creative Brief', 'Visual Recommendations', 'Brand assets'],
    outputs: ['Asset Checklist', 'Canva template spec'],
  },
  {
    id: 'quality-assurance',
    role: 'Quality Assurance',
    responsibility: 'Verify recommendations against Company Brain',
    currentObjective: 'Verify brand compliance and knowledge coverage',
    completedActivity: 'Verified recommendations against the Company Brain',
    workingActivity: 'Checking against Company Brain…',
    icon: 'shield-check',
    stageTitle: 'Quality Assurance',
    stageDescription: 'Checking against Company Brain',
    offsetMs: 5_200,
    progress: 88,
    confidence: 98,
    estimatedDurationMinutes: 1,
    reasoning:
      'QA validates messaging, SEO, and visual briefs against Company Brain before package approval.',
    inputs: ['All campaign documents', 'Company Brain'],
    outputs: ['Brand compliance report', 'Knowledge coverage score'],
  },
  {
    id: 'marketing-lead',
    role: 'Marketing Lead',
    responsibility: 'Package campaign for client approval',
    currentObjective: 'Finalise campaign package for approval',
    completedActivity: 'Approved package for client review',
    workingActivity: 'Packaging campaign…',
    icon: 'badge-check',
    stageTitle: 'Marketing Lead',
    stageDescription: 'Packaging campaign',
    offsetMs: 6_000,
    progress: 100,
    confidence: 99,
    estimatedDurationMinutes: 1,
    reasoning:
      'Marketing Lead consolidates all specialist outputs into a dispatch-ready campaign package.',
    inputs: ['All specialist outputs'],
    outputs: ['Campaign Package', 'README', 'Dispatch manifest'],
  },
];

/** Full timeline including queued orchestration step. */
export const AI_CREATIVE_TEAM: AiCreativeSpecialist[] = [
  QUEUED_SPECIALIST,
  ...AI_MARKETING_TEAM,
];

export const VISUAL_JOB_TOTAL_DURATION_MS =
  AI_MARKETING_TEAM[AI_MARKETING_TEAM.length - 1]?.offsetMs ?? 6_000;

export const CREATIVE_PRODUCTION_ESTIMATE_MINUTES = 18;

export const DISPATCH_DEPLOYMENT_STEP_MS = 450;

export function buildInitialStages(): MarketingJobStage[] {
  return AI_CREATIVE_TEAM.map((specialist) => ({
    specialistId: specialist.id,
    title: specialist.stageTitle,
    description: specialist.stageDescription,
    icon: specialist.icon,
    status: specialist.id === 'queued' ? 'active' : 'pending',
    completedAt: undefined,
  }));
}

export function getSpecialistById(id: string): AiCreativeSpecialist | undefined {
  return AI_CREATIVE_TEAM.find((member) => member.id === id);
}

export function getPipelineSpecialists(): AiCreativeSpecialist[] {
  return AI_MARKETING_TEAM;
}

export function getDispatchManifestItems(): string[] {
  return [
    'Company Brain',
    'Brand Voice',
    'Customer Personas',
    'Messaging',
    'Campaign Strategy',
    'SEO Brief',
    'Blog Article',
    'Social Copy',
    'Visual Recommendations',
    'Required Creative Assets',
  ];
}

export function getMarketingLeadSpecialist(): AiCreativeSpecialist {
  return AI_MARKETING_TEAM[AI_MARKETING_TEAM.length - 1]!;
}
