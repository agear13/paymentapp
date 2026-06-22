/**
 * Global demo mode for polished investor / pilot presentations.
 *
 * Set to `false` to restore dynamically generated reports and ZIP packages.
 * No other application logic needs to change when toggling this flag.
 */
export const DEMO_MODE = true;

/** Runtime check used by all download paths — avoids divergent demo routing. */
export function isDemoModeEnabled(): boolean {
  return DEMO_MODE;
}
