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

/**
 * Additional workspace under an already-entitled Enterprise operator.
 * Copies the primary plan/status only — never starts a new trial or Stripe id.
 */
export function additionalWorkspaceSubscriptionCreate(primary: {
  subscription_plan: string;
  subscription_status: string;
}) {
  return {
    subscription_plan: primary.subscription_plan,
    subscription_status: primary.subscription_status,
  };
}
