export const PROFESSIONAL_TRIAL_DAYS = 30;

export function computeProfessionalTrialEndsAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + PROFESSIONAL_TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

/** Explicit create payload for a new journey workspace. Does not change DB defaults. */
export function journeyWorkspaceSubscriptionCreate(from: Date = new Date()) {
  return {
    subscription_plan: 'professional' as const,
    subscription_status: 'trialing' as const,
    trial_ends_at: computeProfessionalTrialEndsAt(from),
  };
}
