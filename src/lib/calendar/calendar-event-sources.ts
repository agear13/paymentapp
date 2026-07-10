/**
 * Calendar event source registry.
 *
 * New providers register here to surface dated commercial events automatically.
 */

import type { CalendarDerivationContext, CalendarEvent } from '@/lib/calendar/types';

export type CalendarEventSourceDef<TInput = unknown> = {
  id: string;
  label: string;
  derive: (input: TInput, ctx: CalendarDerivationContext) => CalendarEvent[];
};

/** Registered sources — extend when adding Wise, Circle, Xero sync, etc. */
export const CALENDAR_EVENT_SOURCE_REGISTRY: CalendarEventSourceDef[] = [];

export function registerCalendarEventSource(source: CalendarEventSourceDef): void {
  const exists = CALENDAR_EVENT_SOURCE_REGISTRY.some((s) => s.id === source.id);
  if (!exists) {
    CALENDAR_EVENT_SOURCE_REGISTRY.push(source);
  }
}
