import { AI_CREATIVE_TEAM, VISUAL_JOB_TOTAL_DURATION_MS } from '@/lib/marketing-jobs/creative-team';

export { VISUAL_JOB_TOTAL_DURATION_MS };

export const MARKETING_JOBS_STORAGE_KEY_PREFIX = 'provvypay:marketing-jobs:';

/** Poll interval for reconciling in-flight demo jobs in the UI. */
export const MARKETING_JOBS_RECONCILE_INTERVAL_MS = 250;

/** Re-export for consumers that referenced the old timeline constant name. */
export const VISUAL_JOB_TIMELINE = AI_CREATIVE_TEAM;
