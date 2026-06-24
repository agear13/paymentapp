import 'server-only';

/** Extensible suspicious-login rule engine. */
export type SuspiciousLoginContext = {
  userId: string;
  previousLocation?: string | null;
  previousLoginAt?: Date | null;
  currentLocation?: string | null;
  now?: Date;
};

export type SuspiciousLoginResult = {
  suspicious: boolean;
  ruleId?: string;
  reason?: string;
};

const IMPOSSIBLE_TRAVEL_WINDOW_MS = 2 * 60 * 60 * 1000;

const REGION_DISTANCE: Record<string, Record<string, number>> = {
  Australia: { Germany: 16000, 'United States': 15000, 'United Kingdom': 17000 },
  Germany: { Australia: 16000, 'United States': 7000, 'United Kingdom': 900 },
  'United States': { Australia: 15000, Germany: 7000, 'United Kingdom': 6000 },
};

type Rule = (ctx: SuspiciousLoginContext) => SuspiciousLoginResult;

const impossibleTravelRule: Rule = (ctx) => {
  const now = ctx.now ?? new Date();
  if (!ctx.previousLocation || !ctx.currentLocation || !ctx.previousLoginAt) {
    return { suspicious: false };
  }

  if (ctx.previousLocation === ctx.currentLocation) {
    return { suspicious: false };
  }

  const elapsed = now.getTime() - ctx.previousLoginAt.getTime();
  if (elapsed > IMPOSSIBLE_TRAVEL_WINDOW_MS) {
    return { suspicious: false };
  }

  const distanceKm =
    REGION_DISTANCE[ctx.previousLocation]?.[ctx.currentLocation] ??
    REGION_DISTANCE[ctx.currentLocation]?.[ctx.previousLocation] ??
    5000;

  if (distanceKm >= 3000) {
    return {
      suspicious: true,
      ruleId: 'impossible_travel',
      reason: `Sign-in from ${ctx.currentLocation} shortly after ${ctx.previousLocation}.`,
    };
  }

  return { suspicious: false };
};

const RULES: Rule[] = [impossibleTravelRule];

export function evaluateSuspiciousLogin(ctx: SuspiciousLoginContext): SuspiciousLoginResult {
  for (const rule of RULES) {
    const result = rule(ctx);
    if (result.suspicious) {
      return result;
    }
  }
  return { suspicious: false };
}
