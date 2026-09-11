import {
  canFetchConnectedWiseEconomics,
  toConsentState,
  type MerchantWiseSettingsRow,
} from '@/lib/connected-intelligence/consent';

function row(overrides: Partial<MerchantWiseSettingsRow> = {}): MerchantWiseSettingsRow {
  return {
    organization_id: 'org-a',
    wise_enabled: true,
    wise_profile_id: 'profile-a',
    wise_intelligence_consent: false,
    wise_intelligence_consented_at: null,
    wise_intelligence_revoked_at: null,
    ...overrides,
  };
}

describe('Wise intelligence consent', () => {
  it('does not allow a fetch when the organisation has not consented', () => {
    const state = toConsentState(row());
    expect(state.connected).toBe(true);
    expect(state.consented).toBe(false);
    expect(canFetchConnectedWiseEconomics(state)).toBe(false);
  });

  it('allows a fetch only when connected and consented', () => {
    const state = toConsentState(
      row({
        wise_intelligence_consent: true,
        wise_intelligence_consented_at: new Date('2026-09-11T00:00:00.000Z'),
      })
    );
    expect(canFetchConnectedWiseEconomics(state)).toBe(true);
  });

  it('blocks a fetch after consent is revoked', () => {
    const state = toConsentState(
      row({
        wise_intelligence_consent: false,
        wise_intelligence_revoked_at: new Date('2026-09-11T02:00:00.000Z'),
      })
    );
    expect(state.consented).toBe(false);
    expect(canFetchConnectedWiseEconomics(state)).toBe(false);
  });

  it('does not treat a Wise collection connection as intelligence consent', () => {
    const connectedOnly = toConsentState(row({ wise_enabled: true, wise_intelligence_consent: false }));
    expect(connectedOnly.connected).toBe(true);
    expect(canFetchConnectedWiseEconomics(connectedOnly)).toBe(false);
  });
});
