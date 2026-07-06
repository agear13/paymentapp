export const ANALYTICS_WINDOW_DAYS = 30;

/** Mirrors production rolling-window anchor so fixtures stay inside the analytics window. */
export function startOfAnalyticsWindowForFixtures(): Date {
  const start = new Date();
  start.setDate(start.getDate() - (ANALYTICS_WINDOW_DAYS - 1));
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Returns a UTC day value whose formatDateKey matches the day bucket that
 * buildDailySeries emits for windowStart + dayOffset (production uses UTC ISO keys).
 */
export function dailyCountFixtureDay(windowStart: Date, dayOffset = 0): Date {
  const cursor = new Date(windowStart);
  cursor.setDate(cursor.getDate() + dayOffset);
  const dayKey = cursor.toISOString().slice(0, 10);
  return new Date(`${dayKey}T00:00:00.000Z`);
}

/** Returns a local Date offset from now (negative = past, positive = future). */
export function fixtureDateRelativeToNow(dayOffset: number, hour = 12): Date {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, 0, 0, 0);
  return date;
}

/** Coherent lead-detail timestamps preserving activity timeline sort order. */
export function buildLeadDetailActivityFixtures() {
  const anchor = fixtureDateRelativeToNow(-10, 10);
  const hour = 60 * 60 * 1000;
  const minute = 60 * 1000;

  return {
    leadCreatedAt: anchor,
    leadUpdatedAt: new Date(anchor.getTime() + 50 * hour),
    uploadedAt: new Date(anchor.getTime() + 5 * minute),
    uploadCreatedAt: anchor,
    reportCreatedAt: new Date(anchor.getTime() + hour),
    deliveredAt: new Date(anchor.getTime() + 90 * minute),
    openedAt: new Date(anchor.getTime() + 22 * hour),
    viewedAt: new Date(anchor.getTime() + 23 * hour),
    meetingTime: fixtureDateRelativeToNow(-2, 10),
    demoBookingCreatedAt: new Date(anchor.getTime() + 50 * hour),
  };
}
