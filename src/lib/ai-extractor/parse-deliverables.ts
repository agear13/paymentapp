import type {
  ExtractedDeliverable,
  ExtractedParty,
  ExtractionConfidence,
  ExtractionField,
} from './extraction-types';
import {
  normalizeServiceCategories,
  type ServiceCategory,
} from './service-category';
import { inferServiceCategoriesForParty } from './service-category-detection';

function field<T>(value: T, confidence: ExtractionConfidence = 'medium'): ExtractionField<T> {
  return { value, confidence };
}

function inferCategoryFromDescription(description: string): ServiceCategory | null {
  const categories = inferServiceCategoriesForParty({
    id: 'tmp',
    name: field(''),
    email: field(null, 'absent'),
    role: field(''),
    participationModel: field('fixed_payout'),
    fixedAmount: field(null, 'absent'),
    revenueSharePct: field(null, 'absent'),
    deliverables: [],
    milestones: [],
    serviceCategories: field([]),
    conditionalPayments: [],
    conditions: [],
    dependencies: [],
    notes: field(null, 'absent'),
    deliverablesLegacy: field([description]),
  });
  return categories[0] ?? null;
}

export function parseDeliverableItem(raw: unknown): ExtractedDeliverable | null {
  if (typeof raw === 'string' && raw.trim()) {
    const description = raw.trim();
    return {
      description: field(description, 'medium'),
      category: field(inferCategoryFromDescription(description), 'medium'),
    };
  }

  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  const descriptionRaw = obj.description;
  let description: string | null = null;
  let descriptionConfidence: ExtractionConfidence = 'medium';

  if (typeof descriptionRaw === 'string') {
    description = descriptionRaw.trim() || null;
  } else if (typeof descriptionRaw === 'object' && descriptionRaw !== null && 'value' in descriptionRaw) {
    const d = descriptionRaw as { value: unknown; confidence?: ExtractionConfidence };
    description = typeof d.value === 'string' ? d.value.trim() || null : null;
    descriptionConfidence = d.confidence ?? 'medium';
  }

  if (!description) return null;

  let category: ServiceCategory | null = null;
  let categoryConfidence: ExtractionConfidence = 'medium';
  const categoryRaw = obj.category;
  if (typeof categoryRaw === 'string') {
    category = normalizeServiceCategories([categoryRaw])[0] ?? null;
  } else if (typeof categoryRaw === 'object' && categoryRaw !== null && 'value' in categoryRaw) {
    const c = categoryRaw as { value: unknown; confidence?: ExtractionConfidence };
    category =
      typeof c.value === 'string'
        ? normalizeServiceCategories([c.value])[0] ?? null
        : null;
    categoryConfidence = c.confidence ?? 'medium';
  }

  if (!category) {
    category = inferCategoryFromDescription(description);
    categoryConfidence = 'medium';
  }

  return {
    description: field(description, descriptionConfidence),
    category: field(category, categoryConfidence),
  };
}

export function parseDeliverablesNonBlocking(raw: unknown): {
  items: ExtractedDeliverable[];
  droppedCount: number;
} {
  if (raw === undefined || raw === null) {
    return { items: [], droppedCount: 0 };
  }

  // Legacy: { value: string[], confidence }
  if (typeof raw === 'object' && raw !== null && 'value' in raw && Array.isArray((raw as { value: unknown }).value)) {
    const list = (raw as { value: unknown[] }).value;
    const items: ExtractedDeliverable[] = [];
    let droppedCount = 0;
    for (const item of list) {
      const parsed = parseDeliverableItem(item);
      if (parsed) items.push(parsed);
      else droppedCount += 1;
    }
    return { items, droppedCount };
  }

  if (Array.isArray(raw)) {
    const items: ExtractedDeliverable[] = [];
    let droppedCount = 0;
    for (const item of raw) {
      const parsed = parseDeliverableItem(item);
      if (parsed) items.push(parsed);
      else droppedCount += 1;
    }
    return { items, droppedCount };
  }

  return { items: [], droppedCount: 1 };
}

// Canonical definition lives in the deliverable domain leaf to avoid the
// parse-deliverables ↔ service-category-detection circular dependency.
// Re-exported here so existing callers don't need to update their imports.
export { deliverableDescriptions } from './deliverable/deliverable-descriptions';

export function normalizePartyDeliverables(party: ExtractedParty): ExtractedParty {
  if (party.deliverables.length > 0) {
    return party;
  }

  const legacy = party.deliverablesLegacy?.value ?? [];
  if (legacy.length === 0) {
    return { ...party, deliverables: [] };
  }

  const { items } = parseDeliverablesNonBlocking(legacy);
  return { ...party, deliverables: items };
}
