const PARTY_NAME_FIELDS = ['name', 'party', 'beneficiary', 'company', 'entity'] as const;
const PARTY_ROLE_FIELDS = ['role', 'alias', 'partyRole', 'type', 'title'] as const;
const SPLIT_PARTY_FIELDS = ['party', 'beneficiary', 'payee', 'recipient'] as const;
const SPLIT_PERCENTAGE_FIELDS = ['percentage', 'percent', 'share', 'split'] as const;
const SPLIT_BASIS_FIELDS = ['basis', 'metric', 'definition', 'netDefinition', 'description'] as const;
const SPLIT_TRIGGER_FIELDS = ['trigger'] as const;

const ROLE_SYNONYM_GROUPS = [
  ['venue operator', 'venue', 'venue provider', 'venue lessor', 'licensee', 'lessor'],
  ['promoter', 'exclusive promoter', 'event promoter'],
  ['hirer', 'event hirer', 'engaging party', 'client', 'customer'],
  ['contractor', 'independent contractor', 'independent av technician', 'av contractor', 'service provider'],
  ['dj', 'performing dj', 'artist', 'performer', 'entertainment'],
  ['organiser', 'organizer', 'event organiser', 'event organizer', 'rights holder', 'event rights holder'],
  ['sponsor', 'gold sponsor', 'sponsoring party'],
  ['supplier', 'vendor', 'beverage supplier', 'food vendor'],
] as const;

const RELATIONSHIP_KEYWORDS: Record<string, string[]> = {
  'promoter-revenue-share': ['promoter', 'revenue', 'share', 'door', 'receipts', 'nightlife', 'promotion'],
  'promoter-dj-revenue-share': ['promoter', 'dj', 'revenue', 'share', 'artist', 'guarantee'],
  'venue-sponsorship': ['venue', 'sponsorship', 'sponsor'],
  'dj-performance': ['dj', 'performance', 'bar', 'participation', 'entertainment'],
  'ticketing-partnership': ['ticketing', 'partnership', 'ticket', 'distribution'],
  'venue-hire': ['venue', 'hire', 'hall', 'lessor', 'hirer'],
  'entertainment-booking': ['entertainment', 'booking', 'performer', 'artist'],
  'beach-club-event': ['beach', 'club', 'event'],
  'event-management': ['event', 'management', 'services'],
  'festival-partnership': ['festival', 'partnership'],
  contractor: ['contractor', 'independent', 'services', 'av'],
  'security-services': ['security', 'services', 'guard'],
  'food-vendor': ['food', 'vendor', 'catering'],
  'beverage-supplier': ['beverage', 'supplier', 'drinks'],
  photographer: ['photographer', 'photography'],
  sponsorship: ['sponsorship', 'sponsor', 'event'],
  'event-partnership': ['event', 'partnership'],
  'marketing-agency': ['marketing', 'agency'],
  'influencer-partnership': ['influencer', 'partnership', 'creator'],
  'production-services': ['production', 'services', 'technical'],
};

export const SEMANTIC_ARRAY_MATCH_THRESHOLD = 0.45;
export const SEMANTIC_PARTY_NAME_THRESHOLD = 0.72;
export const SEMANTIC_PARTY_ROLE_THRESHOLD = 0.45;
export const SEMANTIC_RELATIONSHIP_THRESHOLD = 0.42;

function asRecord(item: unknown): Record<string, unknown> | null {
  return item && typeof item === 'object' && !Array.isArray(item)
    ? (item as Record<string, unknown>)
    : null;
}

function pickString(record: Record<string, unknown>, fields: readonly string[]): string {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function pickNumber(record: Record<string, unknown>, fields: readonly string[]): number | null {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value.replace(/[^0-9.]+/g, ''));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

export function normalizePartyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bproprietary limited\b/g, 'pty ltd')
    .replace(/\bpty\.?\s*ltd\.?\b/g, 'pty ltd')
    .replace(/\blimited\b/g, 'ltd')
    .replace(/\btrading as\b/g, ' t/a ')
    .replace(/[^a-z0-9%/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeRole(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const group of ROLE_SYNONYM_GROUPS) {
    if (group.some((candidate) => normalized === candidate || normalized.includes(candidate))) {
      return group[0];
    }
  }

  return normalized;
}

export function normalizeRelationshipType(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function tokenSet(text: string): Set<string> {
  return new Set(text.split(/[^a-z0-9%]+/).filter((token) => token.length > 1));
}

export function tokenOverlapScore(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.92;

  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }

  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

export function rolesAreEquivalent(left: string, right: string): boolean {
  const normalizedLeft = normalizeRole(left);
  const normalizedRight = normalizeRole(right);
  if (!normalizedLeft || !normalizedRight) return true;
  if (normalizedLeft === normalizedRight) return true;
  return tokenOverlapScore(normalizedLeft, normalizedRight) >= SEMANTIC_PARTY_ROLE_THRESHOLD;
}

export type PartySignature = {
  name: string;
  role: string;
};

export function extractPartySignature(item: unknown): PartySignature {
  const record = asRecord(item);
  if (!record) {
    return { name: '', role: '' };
  }

  return {
    name: normalizePartyName(pickString(record, PARTY_NAME_FIELDS)),
    role: normalizeRole(pickString(record, PARTY_ROLE_FIELDS)),
  };
}

export function partiesSemanticallyMatch(expectedItem: unknown, actualItem: unknown): boolean {
  const expected = extractPartySignature(expectedItem);
  const actual = extractPartySignature(actualItem);
  if (!expected.name || !actual.name) return false;

  const nameScore = tokenOverlapScore(expected.name, actual.name);
  if (nameScore < SEMANTIC_PARTY_NAME_THRESHOLD) {
    return false;
  }

  if (!expected.role || !actual.role) {
    return true;
  }

  return rolesAreEquivalent(expected.role, actual.role);
}

export type RevenueSplitSignature = {
  party: string;
  percentage: number | null;
  basis: string;
};

export function flattenRevenueSplitItems(items: unknown[]): unknown[] {
  const flattened: unknown[] = [];

  for (const item of items) {
    const record = asRecord(item);
    if (!record) continue;

    if (Array.isArray(record.splits)) {
      const parentBasis = pickString(record, ['basis', 'metric', 'definition', 'netDefinition']);
      for (const nestedSplit of record.splits) {
        const nestedRecord = asRecord(nestedSplit);
        if (!nestedRecord) continue;
        flattened.push({
          ...nestedRecord,
          basis:
            pickString(nestedRecord, SPLIT_BASIS_FIELDS) ||
            parentBasis ||
            pickString(nestedRecord, SPLIT_TRIGGER_FIELDS),
        });
      }
      continue;
    }

    flattened.push(item);
  }

  return flattened;
}

export function extractRevenueSplitSignature(item: unknown): RevenueSplitSignature {
  const record = asRecord(item);
  if (!record) {
    return { party: '', percentage: null, basis: '' };
  }

  const basis =
    pickString(record, SPLIT_BASIS_FIELDS) || pickString(record, SPLIT_TRIGGER_FIELDS);

  return {
    party: normalizePartyName(pickString(record, SPLIT_PARTY_FIELDS)),
    percentage: pickNumber(record, SPLIT_PERCENTAGE_FIELDS),
    basis: basis.toLowerCase(),
  };
}

export function percentagesAreEquivalent(
  expected: number | null,
  actual: number | null,
  tolerance = 0.5
): boolean {
  if (expected == null && actual == null) return true;
  if (expected == null || actual == null) return false;
  return Math.abs(expected - actual) <= tolerance;
}

export function revenueSplitsSemanticallyMatch(expectedItem: unknown, actualItem: unknown): boolean {
  const expected = extractRevenueSplitSignature(expectedItem);
  const actual = extractRevenueSplitSignature(actualItem);

  if (!expected.party || !actual.party) {
    return false;
  }

  const partyScore = tokenOverlapScore(expected.party, actual.party);
  if (partyScore < SEMANTIC_PARTY_NAME_THRESHOLD) {
    return false;
  }

  if (expected.percentage != null || actual.percentage != null) {
    if (!percentagesAreEquivalent(expected.percentage, actual.percentage)) {
      return false;
    }
  }

  if (!expected.basis || !actual.basis) {
    return true;
  }

  return tokenOverlapScore(expected.basis, actual.basis) >= 0.35;
}

export function scoreSemanticArrayAlignment(
  expectedItems: unknown[],
  actualItems: unknown[],
  matcher: (expectedItem: unknown, actualItem: unknown) => boolean
): { matchedCount: number; expectedCount: number; actualCount: number; score: number } {
  const expectedCount = expectedItems.length;
  const actualCount = actualItems.length;

  if (expectedCount === 0 && actualCount === 0) {
    return { matchedCount: 0, expectedCount, actualCount, score: 100 };
  }
  if (expectedCount === 0) {
    return { matchedCount: 0, expectedCount, actualCount, score: 100 };
  }

  const usedActual = new Set<number>();
  let matchedCount = 0;

  for (const expectedItem of expectedItems) {
    for (let index = 0; index < actualItems.length; index += 1) {
      if (usedActual.has(index)) continue;
      if (matcher(expectedItem, actualItems[index])) {
        matchedCount += 1;
        usedActual.add(index);
        break;
      }
    }
  }

  const recall = matchedCount / expectedCount;
  const precision =
    actualCount === 0 ? (matchedCount === 0 ? 1 : 0) : matchedCount / actualCount;
  const f1 =
    recall + precision === 0 ? 0 : (2 * recall * precision) / (recall + precision);

  return {
    matchedCount,
    expectedCount,
    actualCount,
    score: Math.round(f1 * 1000) / 10,
  };
}

export function scoreMinimumCountAlignment(
  expectedCount: number,
  actualCount: number
): { matchedCount: number; expectedCount: number; actualCount: number; score: number } {
  if (expectedCount === 0 && actualCount === 0) {
    return { matchedCount: 0, expectedCount, actualCount, score: 100 };
  }
  if (expectedCount === 0) {
    const penalty = Math.min(15, actualCount * 3);
    return {
      matchedCount: 0,
      expectedCount,
      actualCount,
      score: Math.max(70, Math.round((100 - penalty) * 10) / 10),
    };
  }

  if (actualCount >= expectedCount) {
    const overshoot = actualCount - expectedCount;
    const penalty = Math.min(20, overshoot * 2);
    return {
      matchedCount: expectedCount,
      expectedCount,
      actualCount,
      score: Math.round((100 - penalty) * 10) / 10,
    };
  }

  const score = Math.max(0, 100 * (actualCount / expectedCount));
  return {
    matchedCount: actualCount,
    expectedCount,
    actualCount,
    score: Math.round(score * 10) / 10,
  };
}

export function scoreRelationshipClassificationSemantic(
  expectedType: string,
  actualType?: string
): { score: number; expectedCount: number; actualCount: number; matchedCount: number } {
  if (!actualType) {
    return { score: 0, expectedCount: 1, actualCount: 0, matchedCount: 0 };
  }

  const expectedSlug = normalizeRelationshipType(expectedType);
  const actualSlug = normalizeRelationshipType(actualType);

  if (expectedSlug === actualSlug) {
    return { score: 100, expectedCount: 1, actualCount: 1, matchedCount: 1 };
  }

  const slugOverlap = tokenOverlapScore(expectedSlug.replace(/-/g, ' '), actualSlug.replace(/-/g, ' '));
  if (slugOverlap >= 0.75) {
    return { score: 95, expectedCount: 1, actualCount: 1, matchedCount: 1 };
  }

  const keywords = RELATIONSHIP_KEYWORDS[expectedSlug] ?? expectedSlug.split('-').filter(Boolean);
  const actualTokens = tokenSet(actualType.toLowerCase());
  const keywordHits = keywords.filter((keyword) => actualTokens.has(keyword)).length;
  const keywordScore = keywords.length === 0 ? 0 : keywordHits / keywords.length;

  const titleOverlap = tokenOverlapScore(expectedSlug.replace(/-/g, ' '), actualType.toLowerCase());
  const combined = Math.max(keywordScore, titleOverlap, slugOverlap);

  const score =
    combined >= 0.55 ? 90 : combined >= SEMANTIC_RELATIONSHIP_THRESHOLD ? 75 : Math.round(combined * 1000) / 10;

  return {
    score,
    expectedCount: 1,
    actualCount: 1,
    matchedCount: score >= 70 ? 1 : 0,
  };
}

export function normalizeComparableListItem(item: unknown): string {
  const record = asRecord(item);
  if (!record) return '';

  if (PARTY_NAME_FIELDS.some((field) => field in record)) {
    const party = extractPartySignature(record);
    return [party.name, party.role].filter(Boolean).join(' · ');
  }

  if (SPLIT_PARTY_FIELDS.some((field) => field in record) || SPLIT_PERCENTAGE_FIELDS.some((field) => field in record)) {
    const split = extractRevenueSplitSignature(record);
    return [split.party, split.percentage?.toString(), split.basis].filter(Boolean).join(' · ');
  }

  return Object.values(record)
    .map((value) => (typeof value === 'string' || typeof value === 'number' ? String(value) : ''))
    .filter(Boolean)
    .join(' · ')
    .toLowerCase();
}
