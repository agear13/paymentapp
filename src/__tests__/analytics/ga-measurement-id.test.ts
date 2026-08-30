import { getGaMeasurementId } from '@/lib/analytics/ga-measurement-id';

describe('getGaMeasurementId', () => {
  it('accepts a valid GA4 web measurement ID', () => {
    expect(getGaMeasurementId('G-CW6D3T5BHF')).toBe('G-CW6D3T5BHF');
  });

  it('rejects empty, GTM, and malformed values', () => {
    expect(getGaMeasurementId(undefined)).toBeNull();
    expect(getGaMeasurementId('')).toBeNull();
    expect(getGaMeasurementId('GTM-XXXX')).toBeNull();
    expect(getGaMeasurementId('UA-123456-1')).toBeNull();
    expect(getGaMeasurementId('G-CW6D3T5BHF;alert(1)')).toBeNull();
  });
});
