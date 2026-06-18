import type { ExtractedParty } from './extraction-types';
import {
  normalizeServiceCategories,
  type ServiceCategory,
} from './service-category';
// Import from the domain leaf, not from parse-deliverables, to break the
// parse-deliverables ↔ service-category-detection circular dependency.
import { deliverableDescriptions } from './deliverable/deliverable-descriptions';

export const GENERIC_ROLE_LABELS = new Set([
  'contractor',
  'contributor',
  'partner',
  'stakeholder',
  'referrer',
  'supplier',
  'staff',
  'performer',
  'freelancer',
  'helper',
  'assistant',
  'promoter',
]);

const CATEGORY_PATTERNS: Array<{ category: ServiceCategory; patterns: RegExp[] }> = [
  {
    category: 'PHOTOGRAPHY',
    patterns: [/photo/i, /image/i, /edited/i, /camera/i, /shoot/i, /portrait/i, /crowd shot/i],
  },
  {
    category: 'VIDEOGRAPHY',
    patterns: [/video/i, /reel/i, /drone/i, /recap/i, /footage/i, /film/i],
  },
  {
    category: 'MARKETING',
    patterns: [
      /promot/i,
      /influencer/i,
      /social media/i,
      /partnership/i,
      /outreach/i,
      /campaign/i,
      /ticket sales/i,
      /commission/i,
      /attribution/i,
    ],
  },
  {
    category: 'GRAPHIC_DESIGN',
    patterns: [/poster/i, /template/i, /banner/i, /graphic/i, /design/i, /brand/i, /asset/i, /sponsor asset/i],
  },
  {
    category: 'VENUE',
    patterns: [/venue/i, /hosting/i, /hire/i, /event space/i, /bar revenue/i, /operations/i],
  },
  {
    category: 'EVENT_MANAGEMENT',
    patterns: [/event management/i, /coordination/i, /production/i, /logistics/i],
  },
  {
    category: 'TALENT',
    patterns: [/dj/i, /performer/i, /artist/i, /talent/i, /headline/i],
  },
  {
    category: 'SPONSORSHIP',
    patterns: [/sponsor/i, /brand partner/i],
  },
  {
    category: 'OPERATIONS',
    patterns: [/operations/i, /stage manager/i, /security/i],
  },
];

const ROLE_CATEGORY_MAP: Record<string, ServiceCategory> = {
  promoter: 'MARKETING',
  promotion: 'MARKETING',
  marketing: 'MARKETING',
  photography: 'PHOTOGRAPHY',
  photographer: 'PHOTOGRAPHY',
  videography: 'VIDEOGRAPHY',
  videographer: 'VIDEOGRAPHY',
  design: 'GRAPHIC_DESIGN',
  designer: 'GRAPHIC_DESIGN',
  graphic: 'GRAPHIC_DESIGN',
  venue: 'VENUE',
  'event management': 'EVENT_MANAGEMENT',
  'co-founder': 'OTHER',
  partner: 'OTHER',
  dj: 'TALENT',
  performer: 'TALENT',
  artist: 'TALENT',
};

function collectSearchText(party: ExtractedParty): string {
  const deliverables = deliverableDescriptions(party);
  const notes = party.notes?.value ?? '';
  const role = party.role?.value ?? '';
  const milestoneText = (party.milestones ?? [])
    .map((m) => `${m.description.value} ${m.deadline.value ?? ''}`)
    .join(' ');
  return [role, notes, milestoneText, ...deliverables].join(' ').trim();
}

function inferCategoriesFromText(text: string): ServiceCategory[] {
  const found = new Set<ServiceCategory>();
  for (const { category, patterns } of CATEGORY_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(text))) {
      found.add(category);
    }
  }
  return [...found];
}

function inferCategoryFromRole(role: string): ServiceCategory | null {
  const normalized = role.trim().toLowerCase();
  if (!normalized || GENERIC_ROLE_LABELS.has(normalized)) return null;
  return ROLE_CATEGORY_MAP[normalized] ?? null;
}

export function inferServiceCategoriesForParty(party: ExtractedParty): ServiceCategory[] {
  const extracted = normalizeServiceCategories(
    (party.serviceCategories?.value ?? []).map(String)
  );
  if (extracted.length > 0) return extracted;

  const fromText = inferCategoriesFromText(collectSearchText(party));
  if (fromText.length > 0) return fromText;

  const fromRole = inferCategoryFromRole(party.role.value ?? '');
  return fromRole ? [fromRole] : [];
}

export function inferServiceCategoriesForParties(parties: ExtractedParty[]): ServiceCategory[] {
  const categories = new Set<ServiceCategory>();
  for (const party of parties) {
    for (const category of inferServiceCategoriesForParty(party)) {
      categories.add(category);
    }
  }
  return [...categories];
}

export { formatServiceCategoryLabels as formatServiceCategoryList } from './service-category';
