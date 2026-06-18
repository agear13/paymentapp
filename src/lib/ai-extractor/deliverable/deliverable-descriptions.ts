/**
 * Leaf module — no imports from within ai-extractor except shared types.
 * Both parse-deliverables and service-category-detection consume this.
 * It must never import either of those modules (that would recreate the cycle).
 */
import type { ExtractedParty } from '../extraction-types';

/**
 * Returns the plain-text descriptions of a party's deliverables.
 * Falls back to the legacy flat string array when the structured deliverables
 * field is empty (pre-v5 schema compatibility).
 */
export function deliverableDescriptions(party: ExtractedParty): string[] {
  if ((party.deliverables ?? []).length > 0) {
    return party.deliverables
      .map((d) => d.description.value?.trim())
      .filter((d): d is string => Boolean(d));
  }
  return party.deliverablesLegacy?.value ?? [];
}
