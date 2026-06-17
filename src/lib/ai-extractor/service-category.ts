import type { ExtractionConfidence } from './extraction-types';

/** Normalized commercial service categories for obligation modeling. */
export const SERVICE_CATEGORIES = [
  'MARKETING',
  'PHOTOGRAPHY',
  'VIDEOGRAPHY',
  'GRAPHIC_DESIGN',
  'VENUE',
  'EVENT_MANAGEMENT',
  'TALENT',
  'SPONSORSHIP',
  'OPERATIONS',
  'OTHER',
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

const CATEGORY_ALIASES: Record<string, ServiceCategory> = {
  marketing: 'MARKETING',
  promotion: 'MARKETING',
  promotions: 'MARKETING',
  promoter: 'MARKETING',
  photography: 'PHOTOGRAPHY',
  photographer: 'PHOTOGRAPHY',
  photo: 'PHOTOGRAPHY',
  videography: 'VIDEOGRAPHY',
  videographer: 'VIDEOGRAPHY',
  video: 'VIDEOGRAPHY',
  'graphic design': 'GRAPHIC_DESIGN',
  graphic: 'GRAPHIC_DESIGN',
  design: 'GRAPHIC_DESIGN',
  designer: 'GRAPHIC_DESIGN',
  venue: 'VENUE',
  hosting: 'VENUE',
  'event management': 'EVENT_MANAGEMENT',
  production: 'EVENT_MANAGEMENT',
  talent: 'TALENT',
  performer: 'TALENT',
  dj: 'TALENT',
  artist: 'TALENT',
  sponsorship: 'SPONSORSHIP',
  sponsor: 'SPONSORSHIP',
  operations: 'OPERATIONS',
  other: 'OTHER',
};

const DISPLAY_LABELS: Record<ServiceCategory, string> = {
  MARKETING: 'marketing',
  PHOTOGRAPHY: 'photography',
  VIDEOGRAPHY: 'videography',
  GRAPHIC_DESIGN: 'graphic design',
  VENUE: 'venue',
  EVENT_MANAGEMENT: 'event management',
  TALENT: 'talent',
  SPONSORSHIP: 'sponsorship',
  OPERATIONS: 'operations',
  OTHER: 'other',
};

export function normalizeServiceCategory(raw: string | null | undefined): ServiceCategory | null {
  if (!raw?.trim()) return null;
  const key = raw.trim().toLowerCase().replace(/_/g, ' ');
  if (CATEGORY_ALIASES[key]) return CATEGORY_ALIASES[key]!;
  const upper = raw.trim().toUpperCase().replace(/\s+/g, '_');
  if (SERVICE_CATEGORIES.includes(upper as ServiceCategory)) {
    return upper as ServiceCategory;
  }
  return null;
}

export function normalizeServiceCategories(raw: string[]): ServiceCategory[] {
  const found = new Set<ServiceCategory>();
  for (const item of raw) {
    const normalized = normalizeServiceCategory(item);
    if (normalized) found.add(normalized);
  }
  return [...found];
}

export function serviceCategoryDisplayLabel(category: ServiceCategory): string {
  return DISPLAY_LABELS[category];
}

export function formatServiceCategoryLabels(categories: ServiceCategory[]): string {
  if (categories.length === 0) return '';
  const labels = categories.map(serviceCategoryDisplayLabel);
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

export function field<T>(value: T, confidence: ExtractionConfidence = 'high') {
  return { value, confidence };
}
