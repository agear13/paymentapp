/**
 * Wise fields on NEW merchant_settings (POST) — no env injection, explicit enable only.
 */

import { describe, it, expect } from 'vitest';
import { resolveWiseFieldsForCreate } from '@/lib/merchant-settings/resolve-wise-create-fields';

describe('resolveWiseFieldsForCreate', () => {
  it('defaults to Wise disabled and clears profile/currency when wiseEnabled omitted', () => {
    expect(resolveWiseFieldsForCreate({})).toEqual({
      wise_enabled: false,
      wise_profile_id: null,
      wise_currency: null,
    });
  });

  it('defaults to disabled when wiseEnabled is false', () => {
    expect(
      resolveWiseFieldsForCreate({
        wiseEnabled: false,
        wiseProfileId: 'should-be-ignored',
        wiseCurrency: 'USD',
      })
    ).toEqual({
      wise_enabled: false,
      wise_profile_id: null,
      wise_currency: null,
    });
  });

  it('enables Wise only when wiseEnabled is true', () => {
    expect(
      resolveWiseFieldsForCreate({
        wiseEnabled: true,
        wiseProfileId: 'prof-1',
        wiseCurrency: 'aud',
      })
    ).toEqual({
      wise_enabled: true,
      wise_profile_id: 'prof-1',
      wise_currency: 'AUD',
    });
  });

  it('does not inject profile when enabled but profile empty', () => {
    expect(
      resolveWiseFieldsForCreate({
        wiseEnabled: true,
        wiseProfileId: '',
      })
    ).toEqual({
      wise_enabled: true,
      wise_profile_id: null,
      wise_currency: null,
    });
  });

  it('omits wise_currency when enabled but invalid length', () => {
    expect(
      resolveWiseFieldsForCreate({
        wiseEnabled: true,
        wiseProfileId: 'p',
        wiseCurrency: 'US',
      })
    ).toEqual({
      wise_enabled: true,
      wise_profile_id: 'p',
      wise_currency: null,
    });
  });
});
