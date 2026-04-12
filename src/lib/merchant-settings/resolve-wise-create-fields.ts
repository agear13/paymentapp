/**
 * Wise columns for new `merchant_settings` rows (POST create only).
 *
 * Policy: never auto-enable Wise or inject profile/currency from environment.
 * Defaults: disabled, no profile, no Wise currency — until the client explicitly enables Wise.
 */

export type WiseCreateBody = {
  wiseProfileId?: string;
  wiseEnabled?: boolean;
  wiseCurrency?: string;
};

export type ResolvedWiseDbFields = {
  wise_profile_id: string | null;
  wise_enabled: boolean;
  wise_currency: string | null;
};

export function resolveWiseFieldsForCreate(body: WiseCreateBody): ResolvedWiseDbFields {
  const wise_enabled = body.wiseEnabled === true;

  if (!wise_enabled) {
    return {
      wise_enabled: false,
      wise_profile_id: null,
      wise_currency: null,
    };
  }

  const rawProfile = body.wiseProfileId;
  const wise_profile_id =
    rawProfile !== undefined && String(rawProfile).trim() !== ''
      ? String(rawProfile).trim()
      : null;

  const rawCur = body.wiseCurrency;
  const wise_currency =
    rawCur !== undefined && /^[A-Za-z]{3}$/.test(String(rawCur).trim())
      ? String(rawCur).trim().toUpperCase()
      : null;

  return {
    wise_enabled: true,
    wise_profile_id,
    wise_currency,
  };
}
