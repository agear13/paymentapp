import type { MerchantSetupStatusResult } from '@/lib/copilot/tools/get-merchant-setup-status';

/** Successful GET /api/copilot/onboarding-status */
export type CopilotOnboardingStatusSuccess = {
  ok: true;
  result: MerchantSetupStatusResult;
};

export type CopilotOnboardingStatusError = {
  ok: false;
  error: string;
};

export type CopilotOnboardingStatusResponse = CopilotOnboardingStatusSuccess | CopilotOnboardingStatusError;
