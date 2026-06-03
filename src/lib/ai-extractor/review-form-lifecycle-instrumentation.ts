import type { ExtractedParty, ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import { traceBuildCompensationProfileFromReview } from '@/lib/ai-extractor/extraction-mapper';
import type { ReviewFormState, ReviewedParty } from '@/lib/ai-extractor/review-form-types';

/** Lifecycle checkpoints for the extraction review modal (React useState form, not RHF). */
export type ReviewFormLifecycleStage =
  | 'useState.initializer'
  | 'afterModalRender'
  | 'useEffect.reinit.afterReviewFormFromExtraction'
  | 'useEffect.reinit.afterDuplicateDetection'
  | 'useEffect.reinit.afterSetFormCommitted'
  | 'beforeHandleSave'
  | 'insideHandleSave'
  | 'party.onChange';

export type TrackedImportParty = 'island_djs' | 'coastal_promotions';

export type ReviewFormPartyLifecycleRow = {
  partyId: string;
  partyName: string;
  tracked: TrackedImportParty | null;
  participationModel: string;
  fixedAmount: number | null;
  revenueSharePct: number | null;
  compensationProfile: {
    compensationType?: string;
    fixedAmount?: number | null;
    percentage?: number | null;
    configured?: boolean;
    configuredAt?: string;
  } | null;
  duplicateResolution: 'update' | 'create' | null;
};

export type ReviewFormLifecycleFirstLoss = {
  islandDjsFixedAmount2500: ReviewFormLifecycleStage | null;
  coastalRevenueSharePct15: ReviewFormLifecycleStage | null;
};

export type ReviewFormLifecycleEvent = {
  sessionId: string;
  stage: ReviewFormLifecycleStage;
  timestamp: string;
  entryPoint: ReviewFormState['entryPoint'];
  open: boolean;
  extractedCurrencyUnsupported: boolean;
  extractedCurrencyCode: string | null;
  duplicateMatchCount: number;
  parties: ReviewFormPartyLifecycleRow[];
  expectations: {
    islandDjsFixedAmount: number | null;
    coastalRevenueSharePct: number | null;
  };
  firstLossInSession: ReviewFormLifecycleFirstLoss;
  meta?: Record<string, unknown>;
};

export type ReviewFormLifecycleSession = {
  sessionId: string;
  startedAt: string;
  expectations: ReviewFormLifecycleEvent['expectations'];
  events: ReviewFormLifecycleEvent[];
  firstLossInSession: ReviewFormLifecycleFirstLoss;
};

const LOG_PREFIX = '[review-form-lifecycle]';

let sessionCounter = 0;

export function classifyTrackedParty(name: string): TrackedImportParty | null {
  const n = name.trim().toLowerCase();
  if (n.includes('island') && (n.includes('dj') || n.includes('djs'))) return 'island_djs';
  if (n.includes('coastal')) return 'coastal_promotions';
  return null;
}

export function expectationsFromExtractionResult(result: ExtractionResult): {
  islandDjsFixedAmount: number | null;
  coastalRevenueSharePct: number | null;
} {
  let islandDjsFixedAmount: number | null = null;
  let coastalRevenueSharePct: number | null = null;
  for (const p of result.parties) {
    const tracked = classifyTrackedParty(p.name.value ?? '');
    if (tracked === 'island_djs') {
      islandDjsFixedAmount = p.fixedAmount.value;
    }
    if (tracked === 'coastal_promotions') {
      coastalRevenueSharePct = p.revenueSharePct.value;
    }
  }
  return { islandDjsFixedAmount, coastalRevenueSharePct };
}

function profileFromReview(
  party: ReviewedParty,
  originalsById: Map<string, ExtractedParty>
): ReviewFormPartyLifecycleRow['compensationProfile'] {
  const original = originalsById.get(party.id);
  const profile = traceBuildCompensationProfileFromReview(party, original);
  if (!profile) return null;
  return {
    compensationType: profile.compensationType,
    fixedAmount: profile.fixedAmount ?? null,
    percentage: profile.percentage ?? null,
    configured: profile.configured ?? undefined,
    configuredAt: profile.configuredAt,
  };
}

export function buildPartyLifecycleRows(
  form: ReviewFormState,
  originalsById: Map<string, ExtractedParty>
): ReviewFormPartyLifecycleRow[] {
  return form.parties.map((party) => ({
    partyId: party.id,
    partyName: party.name,
    tracked: classifyTrackedParty(party.name),
    participationModel: party.participationModel,
    fixedAmount: party.fixedAmount,
    revenueSharePct: party.revenueSharePct,
    compensationProfile: profileFromReview(party, originalsById),
    duplicateResolution: form.duplicateResolutions[party.id] ?? null,
  }));
}

function rowForTracked(
  rows: ReviewFormPartyLifecycleRow[],
  tracked: TrackedImportParty
): ReviewFormPartyLifecycleRow | undefined {
  return rows.find((r) => r.tracked === tracked);
}

export function computeFirstLossAtStage(
  stage: ReviewFormLifecycleStage,
  rows: ReviewFormPartyLifecycleRow[],
  expectations: ReviewFormLifecycleEvent['expectations'],
  prior: ReviewFormLifecycleFirstLoss
): ReviewFormLifecycleFirstLoss {
  const next = { ...prior };
  const island = rowForTracked(rows, 'island_djs');
  const coastal = rowForTracked(rows, 'coastal_promotions');

  if (
    next.islandDjsFixedAmount2500 == null &&
    expectations.islandDjsFixedAmount === 2500 &&
    island &&
    island.fixedAmount !== 2500
  ) {
    next.islandDjsFixedAmount2500 = stage;
  }

  if (
    next.coastalRevenueSharePct15 == null &&
    expectations.coastalRevenueSharePct === 15 &&
    coastal &&
    coastal.revenueSharePct !== 15
  ) {
    next.coastalRevenueSharePct15 = stage;
  }

  return next;
}

export function createReviewFormLifecycleSession(
  result: ExtractionResult
): ReviewFormLifecycleSession {
  sessionCounter += 1;
  const sessionId = `review-form-${Date.now()}-${sessionCounter}`;
  return {
    sessionId,
    startedAt: new Date().toISOString(),
    expectations: expectationsFromExtractionResult(result),
    events: [],
    firstLossInSession: {
      islandDjsFixedAmount2500: null,
      coastalRevenueSharePct15: null,
    },
  };
}

export function recordReviewFormLifecycleEvent(input: {
  session: ReviewFormLifecycleSession;
  stage: ReviewFormLifecycleStage;
  form: ReviewFormState;
  result: ExtractionResult;
  open: boolean;
  duplicateMatchCount?: number;
  meta?: Record<string, unknown>;
}): ReviewFormLifecycleEvent {
  const originalsById = new Map(input.result.parties.map((p) => [p.id, p]));
  const parties = buildPartyLifecycleRows(input.form, originalsById);
  const firstLossInSession = computeFirstLossAtStage(
    input.stage,
    parties,
    input.session.expectations,
    input.session.firstLossInSession
  );
  input.session.firstLossInSession = firstLossInSession;

  const event: ReviewFormLifecycleEvent = {
    sessionId: input.session.sessionId,
    stage: input.stage,
    timestamp: new Date().toISOString(),
    entryPoint: input.form.entryPoint,
    open: input.open,
    extractedCurrencyUnsupported: input.form.extractedCurrencyUnsupported,
    extractedCurrencyCode: input.form.extractedCurrencyCode,
    duplicateMatchCount: input.duplicateMatchCount ?? 0,
    parties,
    expectations: input.session.expectations,
    firstLossInSession,
    meta: input.meta,
  };

  input.session.events.push(event);
  logReviewFormLifecycleEvent(event);
  return event;
}

export function logReviewFormLifecycleEvent(event: ReviewFormLifecycleEvent): void {
  const summary = {
    sessionId: event.sessionId,
    stage: event.stage,
    firstLossInSession: event.firstLossInSession,
    tracked: event.parties
      .filter((p) => p.tracked != null)
      .map((p) => ({
        tracked: p.tracked,
        participationModel: p.participationModel,
        fixedAmount: p.fixedAmount,
        revenueSharePct: p.revenueSharePct,
        compensationProfile: p.compensationProfile,
        duplicateResolution: p.duplicateResolution,
      })),
  };

  if (typeof console !== 'undefined') {
    console.info(LOG_PREFIX, JSON.stringify({ ...event, consoleSummary: summary }, null, 2));
  }

  if (typeof window !== 'undefined') {
    const w = window as Window & {
      __REVIEW_FORM_LIFECYCLE_TRACES__?: ReviewFormLifecycleSession[];
    };
    const sessions = w.__REVIEW_FORM_LIFECYCLE_TRACES__ ?? [];
    const idx = sessions.findIndex((s) => s.sessionId === event.sessionId);
    const session =
      idx >= 0
        ? sessions[idx]
        : {
            sessionId: event.sessionId,
            startedAt: event.timestamp,
            expectations: event.expectations,
            events: [],
            firstLossInSession: {
              islandDjsFixedAmount2500: null,
              coastalRevenueSharePct15: null,
            },
          };
    session.events = [...session.events, event];
    session.firstLossInSession = event.firstLossInSession;
    if (idx >= 0) {
      sessions[idx] = session;
    } else {
      sessions.push(session);
    }
    w.__REVIEW_FORM_LIFECYCLE_TRACES__ = sessions;
  }
}

/** No-op when lifecycle tracing is disabled (tests). */
export const reviewFormLifecycleTracingEnabled =
  typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_REVIEW_FORM_LIFECYCLE_TRACE !== '0'
    : true;
