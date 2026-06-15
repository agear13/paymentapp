import type { z } from 'zod';

export function parseArrayItemsNonBlocking<T>(
  itemSchema: z.ZodType<T>,
  raw: unknown,
  fieldLabel: string
): { items: T[]; droppedCount: number } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { items: [], droppedCount: 0 };
  }

  const items: T[] = [];
  let droppedCount = 0;

  for (const item of raw) {
    const result = itemSchema.safeParse(item);
    if (result.success) {
      items.push(result.data);
    } else {
      droppedCount += 1;
      console.error(
        `[ai-extractor] Dropped invalid ${fieldLabel}:`,
        JSON.stringify(result.error.issues)
      );
    }
  }

  return { items, droppedCount };
}
