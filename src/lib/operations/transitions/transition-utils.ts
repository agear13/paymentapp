/**
 * Shared transition validation for all operational state machines.
 */

export type TransitionMap<S extends string> = Readonly<Record<S, readonly S[]>>;

export function canTransitionState<S extends string>(
  map: TransitionMap<S>,
  current: S,
  target: S
): boolean {
  const allowed = map[current];
  if (!allowed) return false;
  return allowed.includes(target);
}

export function allowedTransitionsFrom<S extends string>(
  map: TransitionMap<S>,
  current: S
): readonly S[] {
  return map[current] ?? [];
}

export function assertTransition<S extends string>(
  map: TransitionMap<S>,
  current: S,
  target: S,
  entityLabel: string
): { ok: true } | { ok: false; reason: string } {
  if (current === target) return { ok: true };
  if (canTransitionState(map, current, target)) return { ok: true };
  return {
    ok: false,
    reason: `Invalid ${entityLabel} transition: ${current} → ${target}`,
  };
}
