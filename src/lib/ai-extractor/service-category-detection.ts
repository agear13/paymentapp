import type { ExtractedParty } from './extraction-types';

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
]);

const CATEGORY_PATTERNS: Array<{ category: string; patterns: RegExp[] }> = [
  {
    category: 'Photography',
    patterns: [/photo/i, /image/i, /edited/i, /camera/i, /shoot/i, /portrait/i],
  },
  {
    category: 'Videography',
    patterns: [/video/i, /reel/i, /drone/i, /recap/i, /footage/i, /film/i],
  },
  {
    category: 'Marketing',
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
    category: 'Graphic Design',
    patterns: [/poster/i, /template/i, /banner/i, /graphic/i, /design/i, /brand/i, /asset/i],
  },
  {
    category: 'Venue',
    patterns: [/venue/i, /hosting/i, /hire/i, /event space/i, /bar revenue/i, /operations/i],
  },
  {
    category: 'Creative Production',
    patterns: [/creative/i, /production/i, /content/i, /deliverable/i],
  },
];

const ROLE_CATEGORY_MAP: Record<string, string> = {
  promoter: 'Marketing',
  promotion: 'Marketing',
  photography: 'Photography',
  photographer: 'Photography',
  videography: 'Videography',
  videographer: 'Videography',
  design: 'Graphic Design',
  designer: 'Graphic Design',
  graphic: 'Graphic Design',
  venue: 'Venue',
  'co-founder': 'Partnership',
  partner: 'Partnership',
  dj: 'Performance',
  performer: 'Performance',
  artist: 'Performance',
};

function collectSearchText(party: ExtractedParty): string {
  const deliverables = party.deliverables?.value ?? [];
  const notes = party.notes?.value ?? '';
  const role = party.role?.value ?? '';
  const milestoneText = (party.milestones ?? [])
    .map((m) => `${m.description.value} ${m.deadline.value ?? ''}`)
    .join(' ');
  return [role, notes, milestoneText, ...deliverables].join(' ').trim();
}

function inferCategoriesFromText(text: string): string[] {
  const found = new Set<string>();
  for (const { category, patterns } of CATEGORY_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(text))) {
      found.add(category);
    }
  }
  return [...found];
}

function inferCategoryFromRole(role: string): string | null {
  const normalized = role.trim().toLowerCase();
  if (!normalized || GENERIC_ROLE_LABELS.has(normalized)) return null;
  return ROLE_CATEGORY_MAP[normalized] ?? formatRoleAsCategory(role);
}

function formatRoleAsCategory(role: string): string | null {
  const normalized = role.trim().toLowerCase();
  if (!normalized || GENERIC_ROLE_LABELS.has(normalized)) return null;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function inferServiceCategoriesForParty(party: ExtractedParty): string[] {
  const extracted = party.serviceCategories?.value ?? [];
  if (extracted.length > 0) return [...new Set(extracted)];

  const fromText = inferCategoriesFromText(collectSearchText(party));
  if (fromText.length > 0) return fromText;

  const fromRole = inferCategoryFromRole(party.role.value ?? '');
  return fromRole ? [fromRole] : [];
}

export function inferServiceCategoriesForParties(parties: ExtractedParty[]): string[] {
  const categories = new Set<string>();
  for (const party of parties) {
    for (const category of inferServiceCategoriesForParty(party)) {
      categories.add(category);
    }
  }
  return [...categories];
}

export function formatServiceCategoryList(categories: string[]): string {
  if (categories.length === 0) return '';
  const labels = categories.map((c) => c.toLowerCase());
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}
